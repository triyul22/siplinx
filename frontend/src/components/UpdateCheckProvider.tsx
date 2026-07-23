'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { UpdateInfo } from '@/services/updateService';
import { UpdateDialog } from './UpdateDialog';
import { setUpdateDialogCallback } from './UpdateNotification';

const DISMISSED_UPDATE_VERSION_KEY = 'siplinx.dismissedUpdateVersion';

interface UpdateCheckContextType {
  updateInfo: UpdateInfo | null;
  updateBannerInfo: UpdateInfo | null;
  isChecking: boolean;
  checkForUpdates: (force?: boolean) => Promise<void>;
  showUpdateDialog: () => void;
  dismissUpdate: () => void;
}

const UpdateCheckContext = createContext<UpdateCheckContextType | undefined>(undefined);

export function UpdateCheckProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(DISMISSED_UPDATE_VERSION_KEY);
    } catch {
      return null;
    }
  });

  const handleShowDialog = useCallback(() => {
    setShowDialog(true);
  }, []);

  const { updateInfo, isChecking, checkForUpdates } = useUpdateCheck({
    checkOnMount: true,
    // The persistent in-flow banner replaces the transient toast.
    showNotification: false,
  });

  const dismissUpdate = useCallback(() => {
    const version = updateInfo?.version;
    if (!version) return;

    setDismissedVersion(version);
    try {
      window.localStorage.setItem(DISMISSED_UPDATE_VERSION_KEY, version);
    } catch {
      // The banner can still be dismissed for the current session.
    }
  }, [updateInfo?.version]);

  const updateBannerInfo =
    updateInfo?.available && updateInfo.version !== dismissedVersion
      ? updateInfo
      : null;

  useEffect(() => {
    // Register the callback so UpdateNotification can trigger the dialog
    setUpdateDialogCallback(handleShowDialog);
    return () => {
      setUpdateDialogCallback(() => {});
    };
  }, [handleShowDialog]);

  // Listen for tray menu events
  useEffect(() => {
    const handleTrayCheck = () => {
      checkForUpdates(true); // Force check from tray
      setShowDialog(true);
    };

    window.addEventListener('check-updates-from-tray', handleTrayCheck);
    return () => window.removeEventListener('check-updates-from-tray', handleTrayCheck);
  }, [checkForUpdates]);

  return (
    <UpdateCheckContext.Provider
      value={{
        updateInfo,
        updateBannerInfo,
        isChecking,
        checkForUpdates,
        showUpdateDialog: handleShowDialog,
        dismissUpdate,
      }}
    >
      {children}
      <UpdateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        updateInfo={updateInfo}
      />
    </UpdateCheckContext.Provider>
  );
}

export function useUpdateCheckContext() {
  const context = useContext(UpdateCheckContext);
  if (context === undefined) {
    throw new Error('useUpdateCheckContext must be used within UpdateCheckProvider');
  }
  return context;
}
