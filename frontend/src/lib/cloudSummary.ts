import { getCachedMe, getToken } from '@/lib/authClient';

const CLOUD_SUMMARY_KEY = 'siplinx_cloud_summary_enabled';

export async function getCloudSummaryToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    const cloudEnabled = window.localStorage.getItem(CLOUD_SUMMARY_KEY) !== 'false';
    if (!cloudEnabled) return null;
  }

  const { me } = await getCachedMe();
  if (me?.plan !== 'pro') return null;

  return await getToken();
}

