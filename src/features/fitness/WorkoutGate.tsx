import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { EmptyState, Loading, Screen, TopBar } from '@/src/design-system/ui';
import type { FitnessWorkoutView } from './types';
import { useWorkout } from './useFitness';

/** Busca o treino e só então monta a tela (as telas de treino precisam dele inteiro). */
export function WorkoutGate({ id, title = 'Treino', children }: { id: string | undefined; title?: string; children: (workout: FitnessWorkoutView) => ReactNode }) {
  const { data, isLoading, isError, refetch } = useWorkout(id);
  if (data) return <>{children(data)}</>;
  return (
    <Screen>
      <TopBar safe title={title} onBack={() => router.back()} />
      {isLoading || (!id && !isError) ? (
        <Loading label="Carregando o treino" />
      ) : isError ? (
        <EmptyState icon="cloud-offline-outline" title="Não foi possível abrir o treino" subtitle="Confira a internet e tente de novo." actionLabel="Tentar de novo" onAction={() => void refetch()} />
      ) : (
        <EmptyState icon="barbell-outline" title="Treino não encontrado" subtitle="Ele pode ter sido trocado pela equipe." actionLabel="Voltar" onAction={() => router.back()} />
      )}
    </Screen>
  );
}
