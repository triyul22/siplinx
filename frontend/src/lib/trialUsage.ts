const STORE_FILE = 'billing-usage.json';
const TRIAL_MEETINGS_BY_DAY_KEY = 'trial.meetingsStartedByDay';

export const TRIAL_DAILY_MEETING_LIMIT = 3;

type DailyCounts = Record<string, number>;

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

async function loadCounts(): Promise<{ store: any; counts: DailyCounts }> {
  const { Store } = await import('@tauri-apps/plugin-store');
  const store = await Store.load(STORE_FILE, { autoSave: true, defaults: {} });
  const counts = ((await store.get(TRIAL_MEETINGS_BY_DAY_KEY)) as DailyCounts | null) || {};
  return { store, counts };
}

export async function getTrialMeetingsStartedToday(): Promise<number> {
  try {
    const { counts } = await loadCounts();
    return counts[todayKey()] || 0;
  } catch (error) {
    console.error('Failed to read trial meeting usage:', error);
    return 0;
  }
}

export async function markTrialMeetingStarted(): Promise<number> {
  try {
    const { store, counts } = await loadCounts();
    const key = todayKey();
    const next = (counts[key] || 0) + 1;
    counts[key] = next;
    await store.set(TRIAL_MEETINGS_BY_DAY_KEY, counts);
    await store.save();
    return next;
  } catch (error) {
    console.error('Failed to update trial meeting usage:', error);
    return 0;
  }
}
