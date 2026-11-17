import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Button, Muted } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useCan } from '@/src/features/auth/useCan';
import { interestLabel } from './interestLabel';
import { timeAgo } from '@/src/shared/format';
import type { ApiConversation } from '@/src/shared/api/conversations.api';
import { copilotFeedback, getActiveApps, polishDraft, rateSummary, regenerateSummary, suggestReplies, type CopilotBatch } from '@/src/shared/api/attendance.api';

/**
 * IA no atendimento (empresa com o app de IA e perfil com `ai:use`), com o que o web já faz:
 * - resumo da conversa, humor do cliente e o que ele quer, para quem pega a conversa no meio;
 * - sugestões de resposta quando o cliente escreve (2 s depois, como no web), que só preenchem o campo;
 * - "melhorar texto" para o rascunho, com versões para escolher.
 * Nada é enviado sozinho: a IA propõe, a pessoa decide.
 */

const AI_ACCENT = '#7c3aed';
const AI_WASH = '#f3edff';

/** A empresa tem IA e esta pessoa pode usar. No demo, vale para quem tem a permissão. */
export function useAiEnabled() {
  const { mode } = useAuth();
  const can = useCan();
  const allowed = can('aiUse');
  const apps = useQuery({ queryKey: ['active-apps'], enabled: mode === 'live' && allowed, staleTime: 10 * 60_000, queryFn: getActiveApps });
  return allowed && (mode !== 'live' || (apps.data ?? []).includes('ia'));
}

type Mood = 'positive' | 'neutral' | 'negative';
const moodOf = (s?: string | null): Mood => (s === 'positive' || s === 'negative' ? s : 'neutral');
const MOOD_ICON: Record<Mood, keyof typeof Ionicons.glyphMap> = { positive: 'happy-outline', neutral: 'remove-circle-outline', negative: 'sad-outline' };
const MOOD_COLOR: Record<Mood, string> = { positive: colors.success, neutral: colors.textSoft, negative: colors.danger };

/** Conteúdo de exemplo do modo demonstração. */
const DEMO_SUMMARY: Partial<ApiConversation> = {
  ai_summary:
    'Cliente quer remarcar a avaliação de quinta para o sábado de manhã. Já é aluna do plano mensal e perguntou se a remarcação tem custo. Ainda falta confirmar o horário disponível.',
  ai_summary_status: 'ready',
  ai_sentiment: 'positive',
  ai_primary_intent: 'Remarcar horário',
};
const DEMO_SUGGESTIONS = ['Claro! Tenho sábado às 9h ou às 10h30. Qual fica melhor?', 'A remarcação não tem custo. Posso confirmar para sábado?', 'Vou verificar a agenda e já te retorno.'];

export function AiSummarySheet({
  visible,
  onClose,
  conversationId,
  raw,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  raw?: ApiConversation;
  onChanged: () => void;
}) {
  const { t } = useTranslation('attendance');
  const { mode } = useAuth();
  const live = mode === 'live';
  const data = live ? raw : DEMO_SUMMARY;
  // Pedido de resumo novo: fica "gerando" até chegar um resumo mais novo que o pedido.
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [rated, setRated] = useState<'up' | 'down' | null>(null);
  const [failed, setFailed] = useState(false);
  const fresh = !!data?.ai_summary_at && requestedAt != null && new Date(data.ai_summary_at).getTime() >= requestedAt - 1000;
  const waiting = requestedAt != null && !fresh && data?.ai_summary_status !== 'failed' && data?.ai_summary_status !== 'skipped';
  const status = waiting ? 'pending' : data?.ai_summary_status ?? null;
  const summary = data?.ai_summary?.trim();
  const rating = rated ?? data?.ai_summary_rating ?? null;
  const mood = moodOf(data?.ai_sentiment);

  const regenerate = async () => {
    setFailed(false);
    if (!live) return;
    try {
      setRequestedAt(Date.now());
      setRated(null);
      await regenerateSummary(conversationId);
      // Chega pelo socket (`conversation.summary`); a busca é a reserva.
      setTimeout(onChanged, 6000);
    } catch {
      setRequestedAt(null);
      setFailed(true);
    }
  };

  const rate = async (r: 'up' | 'down') => {
    setRated(r);
    if (!live) return;
    try {
      await rateSummary(conversationId, r);
    } catch {
      setRated(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <View style={styles.spark}>
          <Ionicons name="sparkles" size={16} color={AI_ACCENT} />
        </View>
        <Text style={styles.headTitle}>{t('ai.summaryTitle')}</Text>
        {data?.ai_summary_at && status === 'ready' ? <Muted style={{ marginLeft: 'auto', fontSize: 12 }}>{t('ai.updatedAt', { time: timeAgo(data.ai_summary_at) })}</Muted> : null}
      </View>

      {status === 'pending' ? (
        <View style={styles.pending}>
          <ActivityIndicator color={AI_ACCENT} />
          <Text style={styles.pendingText}>{t('ai.pending')}</Text>
        </View>
      ) : summary ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summary}>{summary}</Text>
        </View>
      ) : (
        <Muted style={{ lineHeight: 19 }}>{status === 'skipped' ? t('ai.skipped') : status === 'failed' ? t('ai.failed') : t('ai.none')}</Muted>
      )}

      {summary && status !== 'pending' ? (
        <View style={styles.facts}>
          {data?.ai_sentiment ? (
            <View style={styles.fact}>
              <Text style={styles.factLabel}>{t('ai.sentiment')}</Text>
              <View style={styles.factValueRow}>
                <Ionicons name={MOOD_ICON[mood]} size={16} color={MOOD_COLOR[mood]} />
                <Text style={[styles.factValue, { color: MOOD_COLOR[mood] }]}>{t(`ai.mood.${mood}`)}</Text>
              </View>
            </View>
          ) : null}
          {data?.ai_primary_intent ? (
            <View style={[styles.fact, { flex: 1.4 }]}>
              <Text style={styles.factLabel}>{t('ai.intent')}</Text>
              <Text style={styles.factValue} numberOfLines={2}>{interestLabel(data.ai_primary_intent)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {failed ? <Text style={styles.error}>{t('ai.failedAction')}</Text> : null}

      {summary && status === 'ready' ? (
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>{rating ? t('ai.thanks') : t('ai.helpful')}</Text>
          {(['up', 'down'] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => void rate(r)}
              accessibilityRole="button"
              accessibilityState={{ selected: rating === r }}
              accessibilityLabel={r === 'up' ? t('ai.rateUp') : t('ai.rateDown')}
              hitSlop={6}
              style={[styles.rateBtn, rating === r && { backgroundColor: AI_WASH, borderColor: AI_ACCENT }]}
            >
              <Ionicons name={r === 'up' ? (rating === r ? 'thumbs-up' : 'thumbs-up-outline') : rating === r ? 'thumbs-down' : 'thumbs-down-outline'} size={17} color={rating === r ? AI_ACCENT : colors.textSoft} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {status !== 'pending' && live ? <Button label={summary ? t('ai.regenerate') : t('ai.generate')} variant="soft" icon="sparkles-outline" onPress={() => void regenerate()} /> : null}
    </BottomSheet>
  );
}

/**
 * Faixa acima do campo de mensagem: sugestões da IA (pílulas que preenchem o campo) e o "melhorar texto".
 * `lastInboundId` muda quando o cliente manda mensagem nova: é o gatilho das sugestões automáticas.
 */
export function ReplySuggestions({
  conversationId,
  lastInboundId,
  draft,
  onUse,
}: {
  conversationId: string;
  lastInboundId: string | null;
  draft: string;
  onUse: (text: string) => void;
}) {
  const { t } = useTranslation('attendance');
  const { mode } = useAuth();
  const live = mode === 'live';
  const [batch, setBatch] = useState<(CopilotBatch & { kind: 'reply' | 'polish' }) | null>(null);
  const [loading, setLoading] = useState<'reply' | 'polish' | null>(null);
  const [failed, setFailed] = useState(false);
  const askedFor = useRef<string | null>(null);

  const ask = async (kind: 'reply' | 'polish', sourceId?: string) => {
    setFailed(false);
    setLoading(kind);
    try {
      const r = live
        ? kind === 'reply'
          ? await suggestReplies(conversationId, sourceId)
          : await polishDraft(conversationId, draft.trim())
        : { suggestions: kind === 'reply' ? DEMO_SUGGESTIONS : [draft.trim()], batch_id: 'demo' };
      setBatch(r.suggestions.length ? { ...r, kind } : null);
      if (!r.suggestions.length && kind === 'polish') setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(null);
    }
  };

  // Cliente escreveu: depois de 2 s (como no web) já chegam sugestões para essa mensagem.
  useEffect(() => {
    if (!live || !lastInboundId || askedFor.current === lastInboundId) return;
    const timer = setTimeout(() => {
      askedFor.current = lastInboundId;
      void ask('reply', lastInboundId);
    }, 2000);
    return () => clearTimeout(timer);
    // `ask` muda a cada render; o gatilho é só a mensagem nova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, lastInboundId]);

  const feedback = (action: 'picked' | 'dismissed', index?: number) => {
    if (!live || !batch?.batch_id) return;
    void copilotFeedback(conversationId, { batch_id: batch.batch_id, action, suggestion_index: index }).catch(() => undefined);
  };

  const use = (text: string, index: number) => {
    feedback('picked', index);
    setBatch(null);
    onUse(text);
  };

  const canPolish = draft.trim().length >= 40;

  if (loading) {
    return (
      <View style={styles.strip}>
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color={AI_ACCENT} />
          <Text style={styles.thinkingText}>{t('ai.loading')}</Text>
        </View>
      </View>
    );
  }

  if (batch?.kind === 'reply') {
    return (
      <View style={styles.strip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} keyboardShouldPersistTaps="handled">
          <View style={styles.pillIcon} accessibilityLabel={t('ai.suggestions')}>
            <Ionicons name="sparkles" size={14} color={AI_ACCENT} />
          </View>
          {batch.suggestions.map((s, i) => (
            <Pressable key={i} onPress={() => use(s, i)} accessibilityRole="button" accessibilityLabel={t('ai.suggestA11y', { text: s })} style={({ pressed }) => [styles.pill, pressed && { backgroundColor: AI_WASH }]}>
              <Text style={styles.pillText} numberOfLines={2}>{s}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              feedback('dismissed');
              setBatch(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('ai.dismiss')}
            hitSlop={8}
            style={styles.close}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.strip, styles.actions]}>
        <Pressable onPress={() => void ask('reply', lastInboundId ?? undefined)} accessibilityRole="button" style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
          <Ionicons name="sparkles-outline" size={14} color={AI_ACCENT} />
          <Text style={styles.chipText}>{t('ai.suggestNow')}</Text>
        </Pressable>
        {canPolish ? (
          <Pressable onPress={() => void ask('polish')} accessibilityRole="button" style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
            <Ionicons name="color-wand-outline" size={14} color={AI_ACCENT} />
            <Text style={styles.chipText}>{t('ai.polish')}</Text>
          </Pressable>
        ) : null}
        {failed ? <Text style={[styles.error, { flex: 1 }]} numberOfLines={1}>{t('ai.failedAction')}</Text> : null}
      </View>

      <BottomSheet visible={batch?.kind === 'polish'} onClose={() => setBatch(null)} title={t('ai.polishTitle')}>
        <Muted style={{ fontSize: 12.5 }}>{t('ai.polishHint')}</Muted>
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
          {(batch?.kind === 'polish' ? batch.suggestions : []).map((s, i) => (
            <Pressable key={i} onPress={() => use(s, i)} accessibilityRole="button" style={({ pressed }) => [styles.version, pressed && { borderColor: AI_ACCENT }]}>
              <Text style={styles.versionText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

/** Botão do topo da conversa que abre o resumo. */
export function AiSummaryButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation('attendance');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('ai.openA11y')} hitSlop={6} style={({ pressed }) => [styles.topBtn, pressed && { opacity: 0.75 }]}>
      <Ionicons name="sparkles" size={18} color={AI_ACCENT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  spark: { width: 30, height: 30, borderRadius: 10, backgroundColor: AI_WASH, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontFamily: typography.fontFamilyBold, fontSize: 18, color: colors.text, letterSpacing: -0.3 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  pendingText: { fontFamily: typography.fontFamilyMedium, fontSize: 14, color: colors.textSoft },
  summaryCard: { padding: 14, borderRadius: radii.md, backgroundColor: '#faf8ff', borderLeftWidth: 3, borderLeftColor: AI_ACCENT },
  summary: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22, color: colors.text },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, padding: 12, borderRadius: radii.md, backgroundColor: '#f6f8fc', gap: 4 },
  factLabel: { fontFamily: typography.fontFamilyMedium, fontSize: 11.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  factValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factValue: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateLabel: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13, color: colors.textSoft },
  rateBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: typography.fontFamilyMedium, fontSize: 12.5, color: colors.dangerText },
  strip: { paddingHorizontal: 12, paddingBottom: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: AI_WASH },
  thinkingText: { fontFamily: typography.fontFamilyMedium, fontSize: 12.5, color: AI_ACCENT },
  pills: { gap: 8, alignItems: 'center', paddingRight: 4 },
  pillIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: AI_WASH, alignItems: 'center', justifyContent: 'center' },
  pill: { maxWidth: 240, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4d9fb' },
  pillText: { fontFamily: typography.fontFamilyMedium, fontSize: 13, lineHeight: 17, color: colors.text },
  close: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 11, borderRadius: 999, backgroundColor: AI_WASH },
  chipText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: AI_ACCENT },
  version: { padding: 14, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  versionText: { fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 21, color: colors.text },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: AI_WASH, alignItems: 'center', justifyContent: 'center' },
});
