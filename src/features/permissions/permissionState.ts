export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked' | 'unavailable';

export type SystemPermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
};

export function toPermissionState(res: SystemPermissionResponse): PermissionState {
  if (res.granted || res.status === 'granted') return 'granted';
  if (res.status === 'undetermined') return 'undetermined';
  return res.canAskAgain ? 'denied' : 'blocked';
}
