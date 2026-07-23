import React, { useEffect, useRef } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Analytics } from '@/lib/analytics';
import { WelcomeStep } from './steps';
import { areLocalModelAutoDownloadsEnabled } from '@/config/localModels';

interface OnboardingFlowProps {
  onComplete: () => void;
}

/**
 * Single-screen onboarding.
 *
 * Раньше было 4 экрана (Welcome -> Setup -> Download -> Permissions). Теперь только
 * Welcome: transcription-модель качается молча в фоне сразу при маунте (юзер этого не видит),
 * инициализация БД идёт в OnboardingProvider,
 * а разрешения (mic/system audio) запрашиваются по месту при первой записи.
 */
export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const {
    startBackgroundDownloads,
    completeOnboarding,
    parakeetDownloaded,
    summaryModelDownloaded,
    isBackgroundDownloading,
  } = useOnboarding();
  const downloadsStartedRef = useRef(false);

  // Track view once
  useEffect(() => {
    Analytics.track('onboarding_step_viewed', { step: 'welcome' });
  }, []);

  // Тихо стартуем загрузку transcription-модели в фоне сразу при открытии первого экрана.
  // Команды качают модель на Rust-стороне и продолжаются даже после reload в main app.
  useEffect(() => {
    if (downloadsStartedRef.current) return;
    if (!areLocalModelAutoDownloadsEnabled()) return;
    if (parakeetDownloaded && summaryModelDownloaded) return;
    if (isBackgroundDownloading) return;
    downloadsStartedRef.current = true;
    startBackgroundDownloads(false).catch(() => {
      // Загрузка повторно дёрнется из main app, если не стартовала
    });
  }, []);

  // Кнопка «Начать» завершает онбординг и уводит в приложение.
  // Загрузка transcription-модели при этом продолжается в фоне (Rust), молча.
  const handleGetStarted = async () => {
    try {
      await completeOnboarding();
    } catch (e) {
      console.error('[OnboardingFlow] completeOnboarding failed:', e);
    }
    onComplete();
  };

  return (
    <div className="onboarding-flow">
      <WelcomeStep onGetStarted={handleGetStarted} />
    </div>
  );
}
