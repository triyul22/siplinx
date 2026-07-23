#!/usr/bin/env node

/**
 * Lightweight P0 contract checks for the riskiest release flows.
 *
 * This intentionally avoids external dependencies and live services. It catches
 * regressions where a future edit removes a critical guard/header/fallback from
 * the code path before we get to manual desktop testing.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
let failures = 0;

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8").replace(/\r\n/g, "\n");
}

function pass(message) {
  console.log(`ok - ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`not ok - ${message}`);
}

function check(message, condition) {
  if (condition) pass(message);
  else fail(message);
}

function includes(relPath, needle, message) {
  check(message, read(relPath).includes(needle));
}

function matches(relPath, pattern, message) {
  check(message, pattern.test(read(relPath)));
}

console.log("P0 QA contract checks\n");

// Auth-service / login CORS: this has broken new-user login twice.
const nextConfig = read("auth-service/next.config.js");
check(
  "auth-service CORS allows X-Billing-Mode",
  nextConfig.includes("X-Billing-Mode")
);
check(
  "auth-service CORS allows X-Locale",
  nextConfig.includes("X-Locale")
);
check(
  "auth-service CORS allows OPTIONS preflight",
  nextConfig.includes("GET,POST,OPTIONS")
);

// Cloud summary: endpoint must be PRO-gated and use server-side OpenAI.
includes(
  "auth-service/src/app/api/summary/route.ts",
  "OPENAI_API_KEY",
  "Cloud summary uses server-side OpenAI key"
);
includes(
  "auth-service/src/app/api/summary/route.ts",
  "pro_required",
  "Cloud summary returns pro_required for non-PRO users"
);
matches(
  "auth-service/src/app/api/summary/route.ts",
  /status:\s*402/,
  "Cloud summary uses HTTP 402 for PRO gate"
);
includes(
  "auth-service/src/app/api/summary/route.ts",
  "https://api.openai.com/v1/responses",
  "Cloud summary uses OpenAI Responses API"
);
includes(
  "auth-service/src/app/api/summary/route.ts",
  "DEFAULT_OPENAI_SUMMARY_MODEL",
  "Cloud summary has configurable OpenAI model default"
);
includes(
  "auth-service/src/app/api/summary/route.ts",
  "store: false",
  "Cloud summary disables OpenAI response storage"
);
includes(
  "auth-service/src/app/api/chat/route.ts",
  "OPENAI_API_KEY",
  "Meeting chat uses server-side OpenAI key"
);
includes(
  "auth-service/src/app/api/chat/route.ts",
  "https://api.openai.com/v1/responses",
  "Meeting chat uses OpenAI Responses API"
);
includes(
  "auth-service/src/app/api/chat/route.ts",
  "store: false",
  "Meeting chat disables OpenAI response storage"
);
includes(
  "auth-service/src/app/api/chat/route.ts",
  "pro_required",
  "Meeting chat returns pro_required for non-PRO users"
);

// Billing: no second Polar trial after our no-card auto-trial.
includes(
  "auth-service/src/lib/entitlements.ts",
  "hasUsedAutoTrial",
  "Entitlements expose hasUsedAutoTrial guard"
);
matches(
  "auth-service/src/app/api/billing/checkout/route.ts",
  /if\s*\(!\(await hasUsedAutoTrial\(session\.user\.id\)\)\)\s*{[\s\S]*trial\s*=/,
  "trial7 checkout grants Polar trial only if auto-trial was not used"
);
matches(
  "auth-service/src/lib/entitlements.ts",
  /INSERT INTO user_entitlement[\s\S]*customer_id[\s\S]*VALUES \(\$1, NULL, 'pro', 'trialing'/,
  "No-card auto-trial stores customer_id NULL"
);

// Auth UI: closing the wrong browser must not strand the desktop on splash.
const authContext = read("frontend/src/contexts/AuthContext.tsx");
const loginBlock = authContext.match(/const login = useCallback\([\s\S]*?\n  \);\n\n  const logout/);
check(
  "Interactive login does not switch AuthGate to global loading",
  Boolean(loginBlock) && !loginBlock[0].includes('setStatus("loading")')
);
includes(
  "frontend/src/lib/authClient.ts",
  "signal?: AbortSignal",
  "Google login can be cancelled with AbortSignal"
);
includes(
  "frontend/src/lib/authClient.ts",
  "timeoutMs = 90 * 1000",
  "Google login timeout is short enough to retry"
);
includes(
  "frontend/src/components/auth/LoginScreen.tsx",
  "AbortController",
  "LoginScreen cancels stale Google login attempts"
);
includes(
  "frontend/src/components/auth/LoginScreen.tsx",
  'window.addEventListener("focus", autoCancelAfterReturn)',
  "LoginScreen auto-cancels Google login when app regains focus"
);
includes(
  "frontend/src/components/auth/LoginScreen.tsx",
  "RETURN_WITHOUT_AUTH_GRACE_MS = 8000",
  "LoginScreen gives deep-link enough time before auto-cancel"
);
includes(
  "frontend/src/i18n/areas/common.ts",
  "login.returnedWithoutAuth",
  "Auto-cancelled login message is translated"
);
check(
  "LoginScreen does not expose manual cancel sign-in button",
  !read("frontend/src/components/auth/LoginScreen.tsx").includes("login.cancel")
);
includes(
  "auth-service/src/app/app/complete/route.ts",
  "desktopReturnPage",
  "Desktop auth complete renders browser fallback page"
);
includes(
  "auth-service/src/app/app/complete/route.ts",
  "Открыть Siplinx AI",
  "Desktop auth complete includes manual open-app link"
);
includes(
  "auth-service/src/app/app/complete/route.ts",
  "window.location.href = target",
  "Desktop auth complete auto-opens deep link from fallback page"
);
includes(
  "auth-service/src/app/app/start/page.tsx",
  "withTimeout(authClient.getSession(), 5000)",
  "Desktop auth start does not wait forever for browser session"
);
includes(
  "auth-service/src/app/app/start/page.tsx",
  "Открыть вход ещё раз",
  "Desktop auth start exposes browser retry action"
);

// Frontend cloud summary: PRO cloud summary must not require local Gemma.
includes(
  "frontend/src/hooks/meeting-details/useSummaryGeneration.ts",
  "getCloudSummaryToken",
  "Summary hook uses cloud-token helper"
);
includes(
  "frontend/src/hooks/meeting-details/useSummaryGeneration.ts",
  "effectiveProvider = 'siplinx-cloud'",
  "Summary hook upgrades eligible PRO summary to siplinx-cloud"
);
matches(
  "frontend/src/hooks/meeting-details/useSummaryGeneration.ts",
  /if\s*\(cloudToken\)\s*{[\s\S]*processSummary/,
  "Cloud summary skips local model readiness checks"
);
includes(
  "frontend/src/components/MeetingDetails/SummaryGeneratorButtonGroup.tsx",
  "if (await getCloudSummaryToken())",
  "Generate button skips Ollama/Gemma checks when cloud summary is available"
);
includes(
  "frontend/src-tauri/src/summary/service.rs",
  "The product cloud path must not require Ollama/Gemma",
  "Siplinx cloud summary does not fall back to local models"
);
includes(
  "frontend/src/config/summaryDefaults.ts",
  "gpt-5.4-mini",
  "Desktop cloud summary default is gpt-5.4-mini"
);
includes(
  "frontend/src-tauri/src/database/commands.rs",
  '"siplinx-cloud"',
  "Fresh database uses Siplinx Cloud for summary"
);
includes(
  "frontend/src-tauri/src/database/commands.rs",
  '"gpt-5.4-mini"',
  "Fresh database uses gpt-5.4-mini for summary"
);
check(
  "Desktop bundle does not include llama-helper sidecar",
  !read("frontend/src-tauri/tauri.conf.json").includes("binaries/llama-helper")
);
check(
  "Windows QA build does not build llama-helper sidecar",
  !read(".github/workflows/build-windows.yml").includes("llama-helper")
);
check(
  "Onboarding does not download local summary models",
  !read("frontend/src/contexts/OnboardingContext.tsx").includes("builtin_ai_download_model")
);

// QA/lightweight builds: auth/billing smoke should not force multi-GB local model downloads.
includes(
  "frontend/src/config/localModels.ts",
  "NEXT_PUBLIC_DISABLE_LOCAL_MODEL_AUTODOWNLOAD",
  "Frontend exposes local model auto-download build flag"
);
includes(
  "frontend/src/components/onboarding/OnboardingFlow.tsx",
  "areLocalModelAutoDownloadsEnabled",
  "Onboarding respects local model auto-download flag"
);
includes(
  "frontend/src/contexts/OnboardingContext.tsx",
  "Local model auto-downloads are disabled for this build",
  "Background onboarding downloads can be disabled"
);
includes(
  "frontend/src/contexts/ConfigContext.tsx",
  "skipping Whisper download",
  "Hybrid Whisper auto-download can be disabled"
);
includes(
  ".github/workflows/build-windows.yml",
  "disable-local-model-autodownload",
  "Windows workflow can build without local model auto-downloads"
);

// Trial usage limit: fourth no-card trial recording should be blocked.
includes(
  "frontend/src/lib/trialUsage.ts",
  "TRIAL_DAILY_MEETING_LIMIT = 3",
  "Trial daily meeting limit is 3"
);
includes(
  "frontend/src/hooks/useRecordingStart.ts",
  "getTrialMeetingsStartedToday",
  "Recording start reads trial usage count"
);
includes(
  "frontend/src/hooks/useRecordingStart.ts",
  "markTrialMeetingStarted",
  "Recording start increments trial usage count after successful start"
);
includes(
  "frontend/src/hooks/useRecordingStart.ts",
  "openCheckout('trial7')",
  "Trial-limit toast can open checkout"
);

// i18n parity for new UI paths.
includes(
  "frontend/src/i18n/areas/recording.ts",
  "recording.trialLimitTitle",
  "Trial limit title is translated"
);
includes(
  "frontend/src/i18n/areas/common.ts",
  "account.buyNow",
  "Buy-now label is translated"
);
includes(
  "frontend/src/i18n/areas/common.ts",
  "paywall.cardNote.trialUsed",
  "Expired-trial paywall copy is translated"
);

// QA doc discoverability.
includes(
  "docs/dev/README.md",
  "08-user-scenarios-qa.md",
  "docs/dev README links QA matrix"
);
includes(
  "docs/dev/08-user-scenarios-qa.md",
  "P0 Smoke Перед Релизом",
  "QA matrix contains P0 smoke section"
);

if (failures > 0) {
  console.error(`\n${failures} contract check(s) failed.`);
  process.exit(1);
}

console.log("\nAll P0 contract checks passed.");
