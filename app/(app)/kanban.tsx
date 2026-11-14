import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card, Chip, IconButton, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { getPipeline, listPipelines, listStageCards, moveCard } from '@/src/shared/api/kanban.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { kanbanCards, kanbanStages } from '@/src/mocks/data';
import { RequirePermission , useCan } from '@/src/features/auth/useCan';

const STAGE_DOTS = [colors.warn, colors.primary, '#8c99b0', colors.success];

export default function KanbanScreenGuarded() {
  return (
    <RequirePermission need="kanban" title="Kanban">
      <KanbanScreen />
    </RequirePermission>
  );
}

function KanbanScreen() {
  // Mover cartão exige kanban:move_card (quem só lê vê o funil sem as setas).
  const canMove = useCan()('kanbanMove');
  const insets = useSafeAreaInsets();
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
            value: c.value_estimated != null ? `R$ ${Number(c.value_estimated).toLocaleString('pt-BR')}` : undefined,
          }));
        }),
      );
      return nested.flat();
    },
  });

  const [mockCards, setMockCards] = useState(kanbanCards);
  const cards = mode === 'live' ? cardsQuery.data ?? [] : mockCards;

  const moveMut = useMutation({
    mutationFn: ({ cardId, stageId }: { cardId: string; stageId: string }) => moveCard(cardId, stageId),
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
      <ScreenHeader safe title="Kanban" subtitle={mode === 'live' ? pipelineQuery.data?.name || 'Funil' : 'Funil de demonstração'} onBack={() => router.back()} />
      {mode === 'live' && (pipelinesQuery.data?.length ?? 0) > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 8 }}>
          {pipelinesQuery.data!.map((p) => (
            <Chip key={p.id} label={p.name} selected={p.id === selectedPipelineId} onPress={() => setPipelineId(p.id)} />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.board, { paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }]}>
        {stages.map((stage, si) => {
          const stageCards = cards.filter((c) => c.stageId === stage.id);
          return (
            <ScrollView key={stage.id} style={styles.column} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
              <View style={styles.colHead}>
                <View style={[styles.dot, { backgroundColor: STAGE_DOTS[si % STAGE_DOTS.length] }]} />
                <Text style={styles.colTitle}>{stage.name}</Text>
                <Badge label={String(stageCards.length)} />
              </View>
              {stageCards.length === 0 ? (
                <View style={styles.empty}>
                  <Muted>Nada por aqui</Muted>
                </View>
              ) : null}
              {stageCards.map((card) => (
                <Card key={card.id} style={styles.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={initialsOf(card.contactName)} size={38} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text>
                      <Muted numberOfLines={1}>{card.contactName}</Muted>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    {card.value ? <Badge label={card.value} tone="success" /> : <View />}
                    {canMove ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <IconButton icon="arrow-back" size={36} tone="soft" accessibilityLabel={`Mover ${card.title} para a etapa anterior`} onPress={() => moveCardLocal(card.id, -1)} />
                      <IconButton icon="arrow-forward" size={36} tone="primary" accessibilityLabel={`Mover ${card.title} para a próxima etapa`} onPress={() => moveCardLocal(card.id, 1)} />
                    </View>
                    ) : null}
                  </View>
                </Card>
              ))}
            </ScrollView>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  board: { paddingHorizontal: 20, gap: 12, alignItems: 'flex-start' },
  column: { width: 272 },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  colTitle: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text },
  empty: { padding: 20, borderRadius: radii.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#c9d1de', alignItems: 'center' },
  card: { padding: 14, borderRadius: radii.lg },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
});
