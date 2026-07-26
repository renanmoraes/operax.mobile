import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Badge, Body, Muted, Screen, Title } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { getPipeline, listPipelines, listStageCards, moveCard } from '@/src/shared/api/kanban.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { kanbanCards, kanbanStages } from '@/src/mocks/data';

export default function KanbanScreen() {
  const { mode } = useAuth();
  const qc = useQueryClient();
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  const pipelinesQuery = useQuery({
    queryKey: ['pipelines'],
    enabled: mode === 'live',
    queryFn: listPipelines,
  });

  const selectedPipelineId = pipelineId || pipelinesQuery.data?.[0]?.id || null;

  const pipelineQuery = useQuery({
    queryKey: ['pipeline', selectedPipelineId],
    enabled: mode === 'live' && !!selectedPipelineId,
    queryFn: () => getPipeline(selectedPipelineId!),
  });

  const stages = useMemo(() => {
    if (mode === 'mock') return kanbanStages;
    return (pipelineQuery.data?.stages ?? []).map((s) => ({ id: s.id, name: s.name }));
  }, [mode, pipelineQuery.data]);

  const cardsQuery = useQuery({
    queryKey: ['kanban-cards', selectedPipelineId, stages.map((s) => s.id).join(',')],
    enabled: mode === 'live' && stages.length > 0,
    queryFn: async () => {
      const nested = await Promise.all(
        stages.map(async (stage) => {
          const cards = await listStageCards(stage.id);
          return cards.map((c) => ({
            id: c.id,
            title: c.title || c.contact?.name || c.contact_name || 'Card',
            contactName: c.contact?.name || c.contact_name || '—',
            stageId: c.stage_id || stage.id,
            value:
              c.value_estimated != null
                ? `R$ ${Number(c.value_estimated).toLocaleString('pt-BR')}`
                : undefined,
          }));
        }),
      );
      return nested.flat();
    },
  });

  const [mockCards, setMockCards] = useState(kanbanCards);
  const cards = mode === 'live' ? cardsQuery.data ?? [] : mockCards;

  const moveMut = useMutation({
    mutationFn: ({ cardId, stageId }: { cardId: string; stageId: string }) =>
      moveCard(cardId, stageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban-cards'] }),
  });

  const moveCardLocal = (cardId: string, direction: -1 | 1) => {
    if (mode === 'mock') {
      setMockCards((prev) =>
        prev.map((card) => {
          if (card.id !== cardId) return card;
          const idx = stages.findIndex((s) => s.id === card.stageId);
          const next = stages[idx + direction];
          return next ? { ...card, stageId: next.id } : card;
        }),
      );
      return;
    }
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const idx = stages.findIndex((s) => s.id === card.stageId);
    const next = stages[idx + direction];
    if (!next) return;
    moveMut.mutate({ cardId, stageId: next.id });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Kanban</Title>
        <Muted>
          {mode === 'live'
            ? pipelineQuery.data?.name || 'Funil'
            : 'Mock'}{' '}
          · setas movem o card
        </Muted>
        {mode === 'live' && (pipelinesQuery.data?.length ?? 0) > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {pipelinesQuery.data!.map((p) => (
                <Pressable key={p.id} onPress={() => setPipelineId(p.id)} style={styles.pipeChip}>
                  <Muted>{p.name}</Muted>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
        {stages.map((stage) => {
          const stageCards = cards.filter((c) => c.stageId === stage.id);
          return (
            <View key={stage.id} style={styles.column}>
              <View style={styles.colHead}>
                <Body style={styles.colTitle}>{stage.name}</Body>
                <Badge label={String(stageCards.length)} />
              </View>
              {stageCards.map((card) => (
                <View key={card.id} style={styles.card}>
                  <Body style={styles.cardTitle}>{card.title}</Body>
                  <Muted>{card.contactName}</Muted>
                  {card.value ? <Badge label={card.value} tone="success" /> : null}
                  <View style={styles.actions}>
                    <Pressable onPress={() => moveCardLocal(card.id, -1)} style={styles.chip}>
                      <Muted>←</Muted>
                    </Pressable>
                    <Pressable onPress={() => moveCardLocal(card.id, 1)} style={styles.chip}>
                      <Muted>→</Muted>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pipeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  board: { padding: spacing.lg, gap: spacing.md },
  column: {
    width: 260,
    backgroundColor: '#eef2f7',
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  colHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 4 },
  colTitle: { fontFamily: typography.fontFamilySemiBold },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  cardTitle: { fontFamily: typography.fontFamilySemiBold },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
