use crate::database::repositories::{
    meeting::MeetingsRepository, setting::SettingsRepository, summary::SummaryProcessesRepository,
};
use crate::summary::llm_client::LLMProvider;
use crate::summary::processor::{extract_meeting_name_from_markdown, generate_meeting_summary};
use crate::ollama::metadata::ModelMetadataCache;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};
use once_cell::sync::Lazy;

// Global cache for model metadata (5 minute TTL)
static METADATA_CACHE: Lazy<ModelMetadataCache> = Lazy::new(|| {
    ModelMetadataCache::new(Duration::from_secs(300))
});

// Global registry for cancellation tokens (thread-safe)
static CANCELLATION_REGISTRY: Lazy<Arc<Mutex<HashMap<String, CancellationToken>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// Summary service - handles all summary generation logic
pub struct SummaryService;

impl SummaryService {
    /// Registers a new cancellation token for a meeting
    fn register_cancellation_token(meeting_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        if let Ok(mut registry) = CANCELLATION_REGISTRY.lock() {
            registry.insert(meeting_id.to_string(), token.clone());
            info!("Registered cancellation token for meeting: {}", meeting_id);
        }
        token
    }

    /// Cancels the summary generation for a meeting
    pub fn cancel_summary(meeting_id: &str) -> bool {
        if let Ok(registry) = CANCELLATION_REGISTRY.lock() {
            if let Some(token) = registry.get(meeting_id) {
                info!("Cancelling summary generation for meeting: {}", meeting_id);
                token.cancel();
                return true;
            }
        }
        warn!("No active summary generation found for meeting: {}", meeting_id);
        false
    }

    /// Cleans up the cancellation token after processing completes
    fn cleanup_cancellation_token(meeting_id: &str) {
        if let Ok(mut registry) = CANCELLATION_REGISTRY.lock() {
            if registry.remove(meeting_id).is_some() {
                info!("Cleaned up cancellation token for meeting: {}", meeting_id);
            }
        }
    }

    /// Saves a completed summary to the database (shared helper for both cloud and local paths).
    async fn save_completed(
        pool: &SqlitePool,
        meeting_id: &str,
        raw_markdown: &str,
        num_chunks: i64,
        duration: f64,
        cloud_fallback: bool,
    ) {
        let mut final_markdown = raw_markdown.to_string();

        // Extract and store meeting title from the first heading
        if let Some(name) = extract_meeting_name_from_markdown(&final_markdown) {
            if !name.is_empty() {
                info!("Updating meeting name to '{}' for meeting_id: {}", name, meeting_id);
                if let Err(e) = MeetingsRepository::update_meeting_title(pool, meeting_id, &name).await {
                    error!("Failed to update meeting name for {}: {}", meeting_id, e);
                }
                // Strip the title heading from the stored markdown body
                if let Some(hash_pos) = final_markdown.find('#') {
                    let body_start = final_markdown[hash_pos..]
                        .find('\n')
                        .map(|nl| hash_pos + nl)
                        .unwrap_or(final_markdown.len());
                    final_markdown = final_markdown[body_start..].trim_start().to_string();
                } else {
                    final_markdown.clear();
                }
            }
        }

        let result_json = serde_json::json!({
            "markdown": final_markdown,
            "cloud_fallback": cloud_fallback,
        });

        if let Err(e) = SummaryProcessesRepository::update_process_completed(
            pool, meeting_id, result_json, num_chunks, duration,
        )
        .await
        {
            error!("Failed to save completed process for {}: {}", meeting_id, e);
        } else {
            info!("Summary saved successfully for meeting_id: {}", meeting_id);
        }
    }

    /// Processes transcript in the background and generates summary.
    ///
    /// For the `siplinx-cloud` provider:
    ///   1. Tries the Siplinx cloud endpoint (server-side provider, PRO-only).
    ///   2. On error, fails with the cloud error instead of falling back to local
    ///      models. The product cloud path must not require Ollama/Gemma.
    pub async fn process_transcript_background<R: tauri::Runtime>(
        _app: AppHandle<R>,
        pool: SqlitePool,
        meeting_id: String,
        text: String,
        model_provider: String,
        model_name: String,
        custom_prompt: String,
        template_id: String,
        auth_token: Option<String>,
    ) {
        let start_time = Instant::now();
        info!("Starting background processing for meeting_id: {}", meeting_id);

        let cancellation_token = Self::register_cancellation_token(&meeting_id);

        // Parse the requested provider
        let requested_provider = match LLMProvider::from_str(&model_provider) {
            Ok(p) => p,
            Err(e) => {
                Self::update_process_failed(&pool, &meeting_id, &e).await;
                return;
            }
        };

        // --- SiplinxCloud fast path -------------------------------------------
        // Try cloud first; on failure switch to the user's saved local provider.
        if requested_provider == LLMProvider::SiplinxCloud {
            let cloud_result = crate::summary::cloud::call_siplinx_cloud(
                &text,
                &template_id,
                auth_token.as_deref(),
                Some(&cancellation_token),
            )
            .await;

            match cloud_result {
                Ok((markdown, _)) => {
                    let duration = start_time.elapsed().as_secs_f64();
                    Self::cleanup_cancellation_token(&meeting_id);
                    Self::save_completed(&pool, &meeting_id, &markdown, 1, duration, false).await;
                    return;
                }
                Err(ref e) if e.contains("cancelled") => {
                    Self::cleanup_cancellation_token(&meeting_id);
                    if let Err(db_err) = SummaryProcessesRepository::update_process_cancelled(
                        &pool, &meeting_id,
                    )
                    .await
                    {
                        error!(
                            "Failed to update DB status to cancelled for {}: {}",
                            meeting_id, db_err
                        );
                    }
                    return;
                }
                Err(e) => {
                    let err_msg = format!("Cloud summary failed: {}", e);
                    warn!("{}", err_msg);
                    Self::cleanup_cancellation_token(&meeting_id);
                    Self::update_process_failed(&pool, &meeting_id, &err_msg).await;
                    return;
                }
            }
        }

        // --- Standard local / cloud provider path ----------------------------
        Self::run_local_summary(
            _app,
            pool,
            meeting_id,
            text,
            requested_provider,
            model_name,
            custom_prompt,
            template_id,
            start_time,
            cancellation_token,
            false,
        )
        .await;
    }

    /// Inner function that runs the standard (non-SiplinxCloud) summary pipeline.
    async fn run_local_summary<R: tauri::Runtime>(
        _app: AppHandle<R>,
        pool: SqlitePool,
        meeting_id: String,
        text: String,
        provider: LLMProvider,
        model_name: String,
        custom_prompt: String,
        template_id: String,
        start_time: Instant,
        cancellation_token: CancellationToken,
        cloud_fallback: bool,
    ) {
        // Validate and setup api_key
        let api_key =
            if provider == LLMProvider::Ollama
                || provider == LLMProvider::BuiltInAI
                || provider == LLMProvider::CustomOpenAI
            {
                String::new()
            } else {
                // Use the provider string from the model_name context (not model_provider which
                // may be "siplinx-cloud"). Derive provider string from the enum for DB lookup.
                let provider_str = match &provider {
                    LLMProvider::OpenAI => "openai",
                    LLMProvider::Claude => "claude",
                    LLMProvider::Groq => "groq",
                    LLMProvider::OpenRouter => "openrouter",
                    _ => "openai",
                };
                match SettingsRepository::get_api_key(&pool, provider_str).await {
                    Ok(Some(key)) if !key.is_empty() => key,
                    Ok(None) | Ok(Some(_)) => {
                        let err_msg = format!("API key not found for {}", provider_str);
                        Self::update_process_failed(&pool, &meeting_id, &err_msg).await;
                        Self::cleanup_cancellation_token(&meeting_id);
                        return;
                    }
                    Err(e) => {
                        let err_msg =
                            format!("Failed to retrieve API key for {}: {}", provider_str, e);
                        Self::update_process_failed(&pool, &meeting_id, &err_msg).await;
                        Self::cleanup_cancellation_token(&meeting_id);
                        return;
                    }
                }
            };

        // Get Ollama endpoint if provider is Ollama
        let ollama_endpoint = if provider == LLMProvider::Ollama {
            match SettingsRepository::get_model_config(&pool).await {
                Ok(Some(config)) => config.ollama_endpoint,
                Ok(None) => None,
                Err(e) => {
                    info!("Failed to retrieve Ollama endpoint: {}, using default", e);
                    None
                }
            }
        } else {
            None
        };

        // Get CustomOpenAI config if provider is CustomOpenAI
        let (
            custom_openai_endpoint,
            custom_openai_api_key,
            custom_openai_max_tokens,
            custom_openai_temperature,
            custom_openai_top_p,
        ) = if provider == LLMProvider::CustomOpenAI {
            match SettingsRepository::get_custom_openai_config(&pool).await {
                Ok(Some(config)) => {
                    info!("✓ Using custom OpenAI endpoint: {}", config.endpoint);
                    (
                        Some(config.endpoint),
                        config.api_key,
                        config.max_tokens.map(|t| t as u32),
                        config.temperature,
                        config.top_p,
                    )
                }
                Ok(None) => {
                    let err_msg = "Custom OpenAI provider selected but no configuration found";
                    Self::update_process_failed(&pool, &meeting_id, err_msg).await;
                    Self::cleanup_cancellation_token(&meeting_id);
                    return;
                }
                Err(e) => {
                    let err_msg =
                        format!("Failed to retrieve custom OpenAI config: {}", e);
                    Self::update_process_failed(&pool, &meeting_id, &err_msg).await;
                    Self::cleanup_cancellation_token(&meeting_id);
                    return;
                }
            }
        } else {
            (None, None, None, None, None)
        };

        let final_api_key = if provider == LLMProvider::CustomOpenAI {
            custom_openai_api_key.unwrap_or_default()
        } else {
            api_key
        };

        // Dynamically determine token threshold
        let token_threshold = if provider == LLMProvider::Ollama {
            match METADATA_CACHE
                .get_or_fetch(&model_name, ollama_endpoint.as_deref())
                .await
            {
                Ok(metadata) => {
                    let optimal = metadata.context_size.saturating_sub(300);
                    info!(
                        "✓ Using dynamic context for {}: {} tokens (chunk size: {})",
                        model_name, metadata.context_size, optimal
                    );
                    optimal
                }
                Err(e) => {
                    warn!("Failed to fetch context for {}: {}. Using default 4000", model_name, e);
                    4000
                }
            }
        } else if provider == LLMProvider::BuiltInAI {
            use crate::summary::summary_engine::models;
            match models::get_model_by_name(&model_name) {
                Some(model_def) => {
                    let optimal = model_def.context_size.saturating_sub(300) as usize;
                    info!(
                        "✓ Using BuiltInAI context size: {} tokens (chunk size: {})",
                        model_def.context_size, optimal
                    );
                    optimal
                }
                None => {
                    warn!("Unknown model: {}, using default 2048", model_name);
                    1748
                }
            }
        } else {
            100_000
        };

        let app_data_dir = _app.path().app_data_dir().ok();

        let client = reqwest::Client::new();
        let result = generate_meeting_summary(
            &client,
            &provider,
            &model_name,
            &final_api_key,
            &text,
            &custom_prompt,
            &template_id,
            token_threshold,
            ollama_endpoint.as_deref(),
            custom_openai_endpoint.as_deref(),
            custom_openai_max_tokens,
            custom_openai_temperature,
            custom_openai_top_p,
            app_data_dir.as_ref(),
            Some(&cancellation_token),
        )
        .await;

        let duration = start_time.elapsed().as_secs_f64();
        Self::cleanup_cancellation_token(&meeting_id);

        match result {
            Ok((final_markdown, num_chunks)) => {
                if num_chunks == 0 && final_markdown.is_empty() {
                    Self::update_process_failed(
                        &pool,
                        &meeting_id,
                        "Summary generation failed: No content was processed.",
                    )
                    .await;
                    return;
                }

                info!(
                    "✓ Successfully processed {} chunks for meeting_id: {}. Duration: {:.2}s",
                    num_chunks, meeting_id, duration
                );

                Self::save_completed(
                    &pool,
                    &meeting_id,
                    &final_markdown,
                    num_chunks,
                    duration,
                    cloud_fallback,
                )
                .await;
            }
            Err(e) => {
                if e.contains("cancelled") {
                    info!("Summary generation was cancelled for meeting_id: {}", meeting_id);
                    if let Err(db_err) =
                        SummaryProcessesRepository::update_process_cancelled(&pool, &meeting_id)
                            .await
                    {
                        error!(
                            "Failed to update DB status to cancelled for {}: {}",
                            meeting_id, db_err
                        );
                    }
                } else {
                    Self::update_process_failed(&pool, &meeting_id, &e).await;
                }
            }
        }
    }

    async fn update_process_failed(pool: &SqlitePool, meeting_id: &str, error_msg: &str) {
        error!("Processing failed for meeting_id {}: {}", meeting_id, error_msg);
        if let Err(e) =
            SummaryProcessesRepository::update_process_failed(pool, meeting_id, error_msg).await
        {
            error!("Failed to update DB status to failed for {}: {}", meeting_id, e);
        }
    }
}
