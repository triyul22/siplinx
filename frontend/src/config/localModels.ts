const LOCAL_MODEL_AUTODOWNLOAD_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_LOCAL_MODEL_AUTODOWNLOAD === 'true';

export function areLocalModelAutoDownloadsEnabled(): boolean {
  return !LOCAL_MODEL_AUTODOWNLOAD_DISABLED;
}

