import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { fromAppleWorkout, fromHealthConnectSession, HealthWorkout } from './mapWorkouts';

/**
 * Acesso ao Saúde do iPhone (HealthKit) e ao Health Connect do Android.
 * As bibliotecas nativas só são carregadas aqui dentro, na hora do uso: assim o app
 * continua abrindo no Expo Go e no web, onde esses módulos não existem.
 */

export type HealthAvailability =
  /** Pronto para pedir acesso. */
  | 'available'
  /** Rodando no Expo Go: precisa do app instalado (build próprio). */
  | 'needs_build'
  /** Android sem o app Health Connect instalado. */
  | 'not_installed'
  /** Health Connect instalado mas desatualizado. */
  | 'update_required'
  /** Web ou aparelho sem suporte (ex.: iPad sem Saúde). */
  | 'unsupported';

export const HEALTH_PLATFORM: 'ios' | 'android' | null = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;

// Há Expo Go que diz `bare` no executionEnvironment; a config do Expo Go só existe dentro dele.
const isExpoGo = () => Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.expoGoConfig != null;

/* eslint-disable @typescript-eslint/no-require-imports */
type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');
type HealthConnectModule = typeof import('react-native-health-connect');
const healthKit = (): HealthKitModule => require('@kingstinct/react-native-healthkit');
const healthConnect = (): HealthConnectModule => require('react-native-health-connect');
/* eslint-enable @typescript-eslint/no-require-imports */

const HC_READ = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
] as const;

export async function getHealthAvailability(): Promise<HealthAvailability> {
  if (!HEALTH_PLATFORM) return 'unsupported';
  if (isExpoGo()) return 'needs_build';
  try {
    if (HEALTH_PLATFORM === 'ios') {
      return (await healthKit().isHealthDataAvailableAsync()) ? 'available' : 'unsupported';
    }
    const hc = healthConnect();
    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
    return 'not_installed';
  } catch {
    // Módulo nativo ausente (build antigo sem a biblioteca): trata como "precisa do app novo".
    return 'needs_build';
  }
}

/**
 * Pede acesso de leitura. No iPhone a Apple não revela o que foi negado (privacidade):
 * `true` só quer dizer que a janela foi mostrada; a leitura vazia é o sinal de recusa.
 */
export async function requestHealthAccess(): Promise<boolean> {
  if (HEALTH_PLATFORM === 'ios') {
    return healthKit().requestAuthorization({
      toRead: ['HKWorkoutTypeIdentifier', 'HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierDistanceWalkingRunning', 'HKQuantityTypeIdentifierActiveEnergyBurned'],
    });
  }
  if (HEALTH_PLATFORM === 'android') {
    const hc = healthConnect();
    await hc.initialize();
    const granted = await hc.requestPermission([...HC_READ]);
    return granted.some((p) => 'recordType' in p && p.recordType === 'ExerciseSession');
  }
  return false;
}

/** Treinos dos últimos `days` dias, do mais novo para o mais antigo. */
export async function readRecentWorkouts(days = 30): Promise<HealthWorkout[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);

  if (HEALTH_PLATFORM === 'ios') {
    const hk = healthKit();
    const samples = await hk.queryWorkoutSamples({ limit: 100, ascending: false, filter: { date: { startDate: start, endDate: end } } });
    return Promise.all(
      samples.map(async (w) => {
        let avg: number | null = null;
        try {
          avg = (await w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min'))?.averageQuantity?.quantity ?? null;
        } catch {
          /* sem batimentos para esse treino */
        }
        return fromAppleWorkout(w, avg);
      }),
    );
  }

  if (HEALTH_PLATFORM === 'android') {
    const hc = healthConnect();
    await hc.initialize();
    const { records } = await hc.readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    const out = await Promise.all(
      records.map(async (s) => {
        const range = { operator: 'between' as const, startTime: s.startTime, endTime: s.endTime };
        const [dist, hr, kcal] = await Promise.all([
          hc.aggregateRecord({ recordType: 'Distance', timeRangeFilter: range }).catch(() => null),
          hc.aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: range }).catch(() => null),
          hc.aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter: range }).catch(() => null),
        ]);
        return fromHealthConnectSession(s, {
          distance_meters: dist?.DISTANCE?.inMeters ?? null,
          avg_hr: hr?.BPM_AVG ?? null,
          energy_kcal: kcal?.ENERGY_TOTAL?.inKilocalories ?? null,
        });
      }),
    );
    return out.sort((a, b) => b.started_at.localeCompare(a.started_at));
  }

  return [];
}

/** Abre a loja no Health Connect (Android sem o app) ou os ajustes do Saúde. */
export function openHealthSetup(availability: HealthAvailability) {
  if (HEALTH_PLATFORM === 'android' && (availability === 'not_installed' || availability === 'update_required')) {
    void Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
      Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
    );
    return;
  }
  if (HEALTH_PLATFORM === 'android') {
    try {
      healthConnect().openHealthConnectSettings();
    } catch {
      void Linking.openSettings();
    }
    return;
  }
  // iPhone: o acesso de cada app fica em Ajustes › Saúde › Acesso a Dados.
  void Linking.openURL('x-apple-health://').catch(() => Linking.openSettings());
}
