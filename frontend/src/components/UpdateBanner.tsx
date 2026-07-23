'use client'

import React from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { UpdateInfo } from '@/services/updateService';
import { useT } from '@/contexts/I18nContext';

interface UpdateBannerProps {
  updateInfo: UpdateInfo | null;
  onUpdate: () => void;
  onDismiss?: () => void;
}

/**
 * Persistent, non-blocking update message rendered in the main content flow.
 * It must not be fixed to a viewport corner: the sidebar footer contains the
 * trial CTA and should remain unobstructed.
 */
export function UpdateBanner({ updateInfo, onUpdate, onDismiss }: UpdateBannerProps) {
  const t = useT();

  if (!updateInfo?.available) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-10 mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-[#232220]"
    >
      <ArrowUpCircle className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {t('misc.updateBanner.label', { version: updateInfo.version })}
        </p>
        <p className="mt-0.5 text-xs text-[#6b6864]">
          {t('misc.updateBanner.description')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onUpdate}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
        >
          {t('misc.updateBanner.action')}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#6b6864] transition-colors hover:bg-blue-100"
          >
            {t('misc.updateBanner.later')}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('misc.updateBanner.dismiss')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-base leading-none text-[#6b6864] transition-colors hover:bg-blue-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
