'use client';

import React, { useEffect, ReactNode, useRef, useState, createContext } from 'react';
import Analytics from '@/lib/analytics';
import { load } from '@tauri-apps/plugin-store';
import { getBillingMode } from '@/config/auth';
import { useAuth } from '@/contexts/AuthContext';


interface AnalyticsProviderProps {
  children: ReactNode;
}

interface AnalyticsContextType {
  isAnalyticsOptedIn: boolean;
  setIsAnalyticsOptedIn: (optedIn: boolean) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextType>({
  isAnalyticsOptedIn: true,
  setIsAnalyticsOptedIn: () => { },
});

export default function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { status: authStatus, user: authUser } = useAuth();
  const [isAnalyticsOptedIn, setIsAnalyticsOptedIn] = useState(true);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const initialized = useRef(false);
  const trackedAuthUserId = useRef<string | null>(null);

  useEffect(() => {
    // Prevent duplicate initialization in React StrictMode
    if (initialized.current) {
      return;
    }

    const initAnalytics = async () => {
      const store = await load('analytics.json', {
        autoSave: false,
        defaults: {
          analyticsOptedIn: true
        }
      });
      if (!(await store.has('analyticsOptedIn'))) {
        await store.set('analyticsOptedIn', true);
      }
      const analyticsOptedIn = await store.get('analyticsOptedIn')

      setIsAnalyticsOptedIn(analyticsOptedIn as boolean);
      // Fix: Use fresh value from store, not stale state
      if (analyticsOptedIn) {
        initAnalytics2();
      }
    }

    const initAnalytics2 = async () => {

      // Mark as initialized to prevent duplicates
      initialized.current = true;

      // Get persistent user ID FIRST (before initializing analytics)
      const userId = await Analytics.getPersistentUserId();

      // Initialize analytics
      await Analytics.init();

      // Get device info for initialization
      const deviceInfo = await Analytics.getDeviceInfo();

      // Store platform info in analytics.json for quick access
      const store = await load('analytics.json', {
        autoSave: false,
        defaults: {
          analyticsOptedIn: true
        }
      });
      await store.set('platform', deviceInfo.platform);
      await store.set('os_version', deviceInfo.os_version);
      await store.set('architecture', deviceInfo.architecture);

      // Set first launch date if not exists
      if (!(await store.has('first_launch_date'))) {
        await store.set('first_launch_date', new Date().toISOString());
      }

      await store.save();

      // Identify user with enhanced properties immediately after init
      const appVersion = await import('@tauri-apps/api/app')
        .then(({ getVersion }) => getVersion())
        .catch(() => 'unknown');
      await Analytics.identify(userId, {
        app_version: appVersion,
        platform: deviceInfo.platform,
        os_version: deviceInfo.os_version,
        architecture: deviceInfo.architecture,
        first_seen: new Date().toISOString(),
        user_agent: navigator.userAgent,
      });

      // Start analytics session with platform info
      const sessionId = await Analytics.startSession(userId);
      if (sessionId) {
        await Analytics.trackSessionStarted(sessionId);
      }

      // Check and track first launch (after analytics is initialized)
      await Analytics.checkAndTrackFirstLaunch();

      // Track app started
      await Analytics.trackAppStarted();

      // Check and track daily usage
      await Analytics.checkAndTrackDailyUsage();
      setAnalyticsReady(true);

      // Set up cleanup on page unload
      const handleBeforeUnload = async () => {
        if (sessionId) {
          await Analytics.trackSessionEnded(sessionId);
        }
        await Analytics.cleanup();
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      // Cleanup function
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (sessionId) {
          Analytics.trackSessionEnded(sessionId);
        }
        Analytics.cleanup();
      };

    };

    initAnalytics().catch(console.error);
  }, []); // Run only once on mount to prevent infinite loops

  // Separate effect to handle re-initialization when analytics is toggled
  useEffect(() => {
    // Reset initialized flag when analytics is disabled to allow re-initialization
    if (!isAnalyticsOptedIn) {
      initialized.current = false;
      setAnalyticsReady(false);
    }
  }, [isAnalyticsOptedIn]);

  useEffect(() => {
    if (!analyticsReady || authStatus !== 'authenticated' || !authUser) return;
    if (trackedAuthUserId.current === authUser.id) return;

    trackedAuthUserId.current = authUser.id;

    const trackAuthenticatedUser = async () => {
      const deviceInfo = await Analytics.getDeviceInfo();
      const appVersion = await import('@tauri-apps/api/app')
        .then(({ getVersion }) => getVersion())
        .catch(() => 'unknown');
      const analyticsUserId = await Analytics.getPersistentUserId().catch(() => 'unknown');

      await Analytics.identify(authUser.id, {
        auth_user_id: authUser.id,
        analytics_user_id: analyticsUserId,
        email: authUser.email,
        name: authUser.name ?? '',
        app_version: appVersion,
        platform: deviceInfo.platform,
        os_version: deviceInfo.os_version,
        architecture: deviceInfo.architecture,
        billing_mode: getBillingMode(),
      });

      await Analytics.track('desktop_auth_identified', {
        auth_user_id: authUser.id,
        analytics_user_id: analyticsUserId,
        email: authUser.email,
        app_version: appVersion,
        platform: deviceInfo.platform,
        billing_mode: getBillingMode(),
      });

      const store = await load('analytics.json', { autoSave: false, defaults: {} });
      const firstAuthenticatedLaunchKey = `auth_first_launch_tracked_${authUser.id}`;
      const alreadyTracked = await store.get<boolean>(firstAuthenticatedLaunchKey);

      if (!alreadyTracked) {
        await Analytics.track('desktop_first_authenticated_launch', {
          auth_user_id: authUser.id,
          analytics_user_id: analyticsUserId,
          email: authUser.email,
          app_version: appVersion,
          platform: deviceInfo.platform,
          billing_mode: getBillingMode(),
        });
        await store.set(firstAuthenticatedLaunchKey, true);
        await store.save();
      }
    };

    trackAuthenticatedUser().catch((error) => {
      console.error('Failed to track authenticated analytics user:', error);
      trackedAuthUserId.current = null;
    });
  }, [analyticsReady, authStatus, authUser]);

  return <AnalyticsContext.Provider value={{ isAnalyticsOptedIn, setIsAnalyticsOptedIn }}>{children}</AnalyticsContext.Provider>;
} 
