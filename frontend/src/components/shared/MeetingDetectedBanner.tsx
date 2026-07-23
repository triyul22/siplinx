'use client';

import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { useRouter, usePathname } from 'next/navigation';
import { useT } from '@/contexts/I18nContext';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { Analytics } from '@/lib/analytics';

/**
 * Координатор автодетекта встречи.
 *
 * Сам НИЧЕГО не рисует (рендерит null). Вся видимая часть — отдельное
 * always-on-top окно «pill» (public/pill.html + pill.js), которое висит поверх
 * любых окон и вкладок, как у Granola.
 *
 * Здесь живёт ЛОГИКА решений (есть контекст записи, тумблер уведомлений,
 * состояние «не сейчас»), а пилюля — просто вид. Контракт событий:
 *   это окно → пилюля:  pill-show-detect {app}, pill-show-recording, pill-hide
 *   пилюля → это окно:  pill-start-recording, pill-stop-recording, pill-dismiss
 *
 * Раньше плашка рисовалась внутри приложения и выдёргивала всё окно поверх
 * (setAlwaysOnTop на main). Теперь окно приложения не трогаем: над звонком
 * висит только пилюля, юзер остаётся в своём созвоне.
 */
export function MeetingDetectedBanner() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { status, isRecording } = useRecordingState();

  // Не показывать повторно для той же встречи после «Не сейчас».
  const dismissedRef = useRef(false);
  const busy = isRecording || status !== RecordingStatus.IDLE;
  const busyRef = useRef(busy);
  const stopInProgressRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Запускаем Rust-вотчер один раз при входе в основное приложение.
  useEffect(() => {
    invoke('start_meeting_detection').catch((e) =>
      console.error('[MeetingDetectedBanner] start_meeting_detection failed:', e)
    );
  }, []);

  // Системное уведомление ОС — запасной сигнal на случай эксклюзивного
  // полноэкранного приложения, поверх которого Windows не пускает оверлеи.
  const fireNotification = async (name: string | null) => {
    const description = name
      ? t('meetingDetect.description', { app: name })
      : t('meetingDetect.descriptionGeneric');
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === 'granted';
      if (granted) {
        sendNotification({ title: t('meetingDetect.title'), body: description });
      }
    } catch (e) {
      console.error('[MeetingDetectedBanner] notification failed:', e);
    }
  };

  // --- Rust-события детектора и записи → команды пилюле ---
  useEffect(() => {
    const unlistenDetected = listen<{ app: string }>('meeting-detected', (event) => {
      let notificationsEnabled = true;
      try {
        notificationsEnabled =
          localStorage.getItem('siplinx_notifications_enabled') !== 'false';
      } catch {
        /* noop */
      }
      if (!notificationsEnabled || dismissedRef.current || busyRef.current) return;

      const name = event.payload?.app || null;
      void emit('pill-show-detect', { app: name });
      void fireNotification(name);
      Analytics.track('meeting_autodetected', { app: name ?? 'unknown' });
    });

    const unlistenEnded = listen('meeting-ended', () => {
      dismissedRef.current = false;
      if (!busyRef.current) void emit('pill-hide');
    });

    // Запись реально стартовала (любым способом) → пилюля в режим записи.
    const unlistenRecStarted = listen('recording-started', () => {
      void emit('pill-show-recording');
    });
    // Запись остановлена → прячем пилюлю.
    const unlistenRecStopped = listen('recording-stopped', () => {
      void emit('pill-hide');
    });

    return () => {
      unlistenDetected.then((fn) => fn());
      unlistenEnded.then((fn) => fn());
      unlistenRecStarted.then((fn) => fn());
      unlistenRecStopped.then((fn) => fn());
    };
  }, []);

  // --- намерения из пилюли → действия главного окна ---
  useEffect(() => {
    const unlistenStart = listen('pill-start-recording', () => {
      Analytics.track('meeting_autodetect_accepted');
      // Тот же надёжный путь, что кнопка записи в сайдбаре: флаг + событие.
      try {
        sessionStorage.setItem('autoStartRecording', 'true');
      } catch {
        /* noop */
      }
      if (pathname === '/') {
        window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
      } else {
        router.push('/');
      }
    });

    const unlistenStop = listen('pill-stop-recording', () => {
      if (stopInProgressRef.current) return;
      stopInProgressRef.current = true;

      void (async () => {
        try {
          const dataDir = await appDataDir();
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const savePath = `${dataDir}/recording-${timestamp}.wav`;

          await invoke('stop_recording', {
            args: {
              save_path: savePath,
            },
          });

          await emit('recording-stop-complete', true);
        } catch (error) {
          console.error('[MeetingDetectedBanner] pill stop failed:', error);
        } finally {
          stopInProgressRef.current = false;
        }
      })();
    });

    const unlistenDismiss = listen('pill-dismiss', () => {
      dismissedRef.current = true;
      Analytics.track('meeting_autodetect_dismissed');
    });

    return () => {
      unlistenStart.then((fn) => fn());
      unlistenStop.then((fn) => fn());
      unlistenDismiss.then((fn) => fn());
    };
  }, [pathname, router]);

  return null;
}
