use crate::summary::processor::transcript_is_cyrillic;
use crate::summary::templates;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

// Source of truth: NEXT_PUBLIC_AUTH_URL in frontend/.env.production
const SIPLINX_CLOUD_URL: &str = "https://siplinx-ai.vercel.app";

const CLOUD_REQUEST_TIMEOUT: Duration = Duration::from_secs(90);

#[derive(Deserialize)]
struct CloudSummaryResponse {
    summary_markdown: String,
    #[serde(default)]
    tokens_in: u64,
    #[serde(default)]
    tokens_out: u64,
}

/// Call the Siplinx cloud summary endpoint.
///
/// Returns `(summary_markdown, num_chunks)` on success, or an error string that
/// the caller (service.rs) can use to decide whether to fall back to local AI.
pub async fn call_siplinx_cloud(
    text: &str,
    template_id: &str,
    auth_token: Option<&str>,
    cancellation_token: Option<&CancellationToken>,
) -> Result<(String, i64), String> {
    let token = match auth_token {
        Some(t) if !t.is_empty() => t,
        _ => return Err("no auth token provided for cloud summary".to_string()),
    };

    // Determine summary kind from template
    let template = templates::get_template(template_id);
    let summary_kind = template
        .as_ref()
        .map(|t| t.summary_kind.clone())
        .unwrap_or_else(|_| "meeting".to_string());

    // Pass detected language so the server prompt includes an explicit language directive
    let is_cyrillic = transcript_is_cyrillic(text);
    let language: Option<&str> = if is_cyrillic { Some("ru") } else { None };

    let body = if let Some(lang) = language {
        serde_json::json!({
            "transcript": text,
            "summary_kind": summary_kind,
            "language": lang,
        })
    } else {
        serde_json::json!({
            "transcript": text,
            "summary_kind": summary_kind,
        })
    };

    info!(
        "Calling Siplinx cloud summary: kind={}, cyrillic={}, transcript_len={}",
        summary_kind,
        is_cyrillic,
        text.len()
    );

    let client = Client::builder()
        .timeout(CLOUD_REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let request_future = client
        .post(format!("{}/api/summary", SIPLINX_CLOUD_URL))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send();

    let response = if let Some(ct) = cancellation_token {
        tokio::select! {
            result = request_future => {
                result.map_err(|e| format!("Cloud request failed: {}", e))?
            }
            _ = ct.cancelled() => {
                return Err("cancelled".to_string());
            }
        }
    } else {
        request_future
            .await
            .map_err(|e| format!("Cloud request failed: {}", e))?
    };

    let status = response.status();
    if !status.is_success() {
        let detail = response.text().await.unwrap_or_default();
        error!("[cloud] Server returned {}: {}", status, detail);
        return Err(format!("Cloud API returned HTTP {}: {}", status.as_u16(), detail));
    }

    let data = response
        .json::<CloudSummaryResponse>()
        .await
        .map_err(|e| format!("Failed to parse cloud response: {}", e))?;

    info!(
        "Cloud summary received: tokens_in={}, tokens_out={}",
        data.tokens_in, data.tokens_out
    );

    Ok((data.summary_markdown, 1))
}
