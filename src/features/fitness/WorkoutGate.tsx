import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { EmptyState, Loading, Screen, TopBar } from '@/src/design-system/ui';
import type { FitnessWorkoutView } from './types';
import { useWorkout } from './useFitness';

/** Busca o treino e só então monta a tela (as telas de treino precisam dele inteiro). */
export function WorkoutGate({ id, title, children }: { id: string | undefined; title?: string; children: (workout: FitnessWorkoutView) => ReactNode }) {
  const { data, isLoading, isError, refetch } = useWorkout(id);
  const { t } = useTranslation(['fitness', 'common']);
  if (data) return <>{children(data)}</>;
  return (
    <Screen>
      <TopBar safe title={title ?? t('gate.workout')} onBack={() => router.back()} />
      {isLoading || (!id && !isError) ? (
        <Loading label={t('gate.loading')} />
      ) : isError ? (
        <EmptyState icon="cloud-offline-outline" title={t('gate.errorTitle')} subtitle={t('gate.errorSub')} actionLabel={t('common:actions.retry')} onAction={() => void refetch()} />
      ) : (
        <EmptyState icon="barbell-outline" title={t('gate.notFound')} subtitle={t('gate.notFoundSub')} actionLabel={t('common:actions.back')} onAction={() => router.back()} />
      )}
    </Screen>
  );
}
