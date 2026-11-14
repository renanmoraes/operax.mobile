import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { getHealthAvailability, requestHealthAccess } from '@/src/features/fitness/health/healthStore';
import { registerForPushNotificationsAsync } from '@/src/features/notifications/push';
import { registerDevicePushToken } from '@/src/shared/api/auth.api';
import { getItem, setItem } from '@/src/shared/storage';
import { PermissionState, SystemPermissionResponse, toPermissionState } from './permissionState';

export type PermissionKey = 'notifications' | 'camera' | 'photos' | 'microphone' | 'health';

async function readNotifications(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const Notifications = await import('expo-notifications');
    return toPermissionState((await Notifications.getPermissionsAsync()) as SystemPermissionResponse);
  } catch {
    return 'unavailable';
  }
}

export async function getPermission(key: PermissionKey): Promise<PermissionState> {
  switch (key) {
    case 'notifications':
      return readNotifications();
    case 'camera':
      if (Platform.OS === 'web') return 'unavailable';
      return toPermissionState((await ImagePicker.getCameraPermissionsAsync()) as SystemPermissionResponse);
    case 'photos':
      if (Platform.OS === 'web') return 'granted';
      return toPermissionState((await ImagePicker.getMediaLibraryPermissionsAsync()) as SystemPermissionResponse);
    case 'microphone':
      try {
        return toPermissionState((await getRecordingPermissionsAsync()) as SystemPermissionResponse);
      } catch {
        return 'unavailable';
      }
    case 'health': {
      // A Apple não revela se o acesso de leitura foi dado; "available" vira "undetermined".
      const a = await getHealthAvailability();
      return a === 'available' ? 'undetermined' : 'unavailable';
    }
  }
}

export async function requestPermission(key: PermissionKey, opts: { live: boolean }): Promise<PermissionState> {
  switch (key) {
    case 'notifications':
      if (Platform.OS === 'web') return 'unavailable';
      if (opts.live) {
        try {
          await registerDevicePushToken();
        } catch {
          /* token não subiu agora; o estado da permissão continua valendo */
        }
      } else {
        await registerForPushNotificationsAsync();
      }
      return readNotifications();
    case 'camera':
      if (Platform.OS === 'web') return 'unavailable';
      return toPermissionState((await ImagePicker.requestCameraPermissionsAsync()) as SystemPermissionResponse);
    case 'photos':
      if (Platform.OS === 'web') return 'granted';
      return toPermissionState((await ImagePicker.requestMediaLibraryPermissionsAsync()) as SystemPermissionResponse);
    case 'microphone':
      try {
        return toPermissionState((await requestRecordingPermissionsAsync()) as SystemPermissionResponse);
      } catch {
        return 'unavailable';
      }
    case 'health':
      if ((await getHealthAvailability()) !== 'available') return 'unavailable';
      return (await requestHealthAccess()) ? 'granted' : 'denied';
  }
}

export function openSystemSettings() {
  void Linking.openSettings();
}

/** Estado das permissões pedidas; reconsulta quando o app volta ao primeiro plano (ex.: depois dos ajustes). */
export function usePermissions(keys: PermissionKey[], live: boolean) {
  const [states, setStates] = useState<Partial<Record<PermissionKey, PermissionState>>>({});
  const signature = keys.join(',');

  const refresh = useCallback(async () => {
    const entries = await Promise.all(signature.split(',').map(async (k) => [k, await getPermission(k as PermissionKey)] as const));
    setStates(Object.fromEntries(entries));
  }, [signature]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(
    async (key: PermissionKey) => {
      const next = await requestPermission(key, { live });
      setStates((prev) => ({ ...prev, [key]: next }));
      return next;
    },
    [live],
  );

  return { states, request, refresh };
}

const ONBOARDING_KEY = 'operax_client_onboarding_v1';

export async function hasSeenClientOnboarding() {
  return (await getItem(ONBOARDING_KEY)) === '1';
}

export async function markClientOnboardingSeen() {
  await setItem(ONBOARDING_KEY, '1');
}
