import { router } from 'expo-router';
import { useActiveCompanyName } from '@/src/features/client/useClientData';
import i18n, { locale } from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { showDialog } from '@/src/design-system/Dialog';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Field, Glow, IconButton, IconName, Muted, Rise, Screen, StatStrip } from '@/src/design-system/ui';
import { colors, glass, gradients, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { fromStrength } from '@/src/features/share/fromSources';
import { setShareActivity } from '@/src/features/share/store';
import { buildResultBodies, flattenWorkout, personalRecords, totalSets } from '@/src/features/fitness/flatten';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { queueResults } from '@/src/features/fitness/resultsQueue';
import { isAxiosError } from 'axios';
import { fitnessOwner } from '@/src/features/fitness/owner';
import { clearFinishedSession, FinishedSession, getFinishedSession, loadFinishedSession, resultKeyOf } from '@/src/features/fitness/sessionStore';
import type { FitnessFeeling, FitnessWorkoutView } from '@/src/features/fitness/types';
import { useHistory, useLoadHistory, useRecordResult } from '@/src/features/fitness/useFitness';
import { formatClock, formatDuration, formatKg, isoDate } from '@/src/shared/format';

const feel = (key: FitnessFeeling, icon: IconName) => ({ key, icon, get label() { return i18n.t(`fitness:done.feeling.${key}`); } });
const FEELINGS: { key: FitnessFeeling; label: string; icon: IconName }[] = [
  feel('great', 'happy-outline'),
  feel('good', 'thumbs-up-outline'),
  feel('ok', 'remove-circle-outline'),
  feel('bad', 'trending-down-outline'),
  feel('awful', 'sad-outline'),
];

export default function WorkoutDoneScreen() {
  const [session, setSession] = useState<FinishedSession | null>(() => getFinishedSession());
  // App fechado e reaberto nesta tela: recupera o treino terminado gravado no aparelho.
  useEffect(() => {
    if (session) return;
    void loadFinishedSession().then((s) => s && setSession(s));
  }, [session]);
  return <WorkoutGate id={session?.workoutId}>{(workout) => <WorkoutDone workout={workout} session={session} />}</WorkoutGate>;
}

function WorkoutDone({ workout, session }: { workout: FitnessWorkoutView; session: FinishedSession | null }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  // Nome da empresa no cartão de compartilhar (antes era um nome de demonstração fixo).
  const companyName = useActiveCompanyName();
  const LOAD_HISTORY = useLoadHistory();
  const rows = useMemo(() => flattenWorkout(workout), [workout]);
  const { data: history } = useHistory();
  const record = useRecordResult();
  const [feeling, setFeeling] = useState<FitnessFeeling | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [queued, setQueued] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const logs = session?.logs ?? rows.map(() => []);
  const setsDone = logs.reduce((n, l) => n + l.length, 0);
  const volume = Math.round(logs.reduce((n, l) => n + l.reduce((m, s) => m + s.kg * s.reps, 0), 0));
  // Por exercício: num superset cada série é do exercício do seu estágio.
  const records = personalRecords(rows, logs, LOAD_HISTORY);

  // Só o próprio treino da ficha: sessão do relógio chamada "Musculação" não tem volume e não é este treino.
  const past = (history ?? []).filter((e) => e.kind === 'prescribed' && e.title === workout.title).slice(0, 5).reverse();
  const bars = [...past.map((e) => ({ label: e.date.slice(8, 10) + '/' + e.date.slice(5, 7), v: e.volume_kg ?? 0 })), { label: t('sheet.today'), v: volume }];
  const maxV = Math.max(1, ...bars.map((b) => b.v));
  const elapsed = session?.elapsed ?? 0;
  const activeTotal = session?.activeSeconds?.reduce((n, v) => n + v, 0) ?? 0;
  const restTotal = session?.restSeconds?.reduce((n, v) => n + v, 0) ?? 0;
  const showActiveRest = Math.round(activeTotal / 60) > 0 || Math.round(restTotal / 60) > 0;

  function share() {
    setShareActivity(
      fromStrength(
        { title: workout.title, company: companyName, date: session?.finishedAt ?? new Date().toISOString(), seconds: elapsed },
        {
          volumeKg: volume,
          setsDone,
          setsTotal: totalSets(rows),
          records: records.map((r) => ({ name: r.name, kg: r.kg })),
          volumeHistory: bars.map((b) => ({ label: b.label, kg: b.v })),
        },
      ),
    );
    router.push('/cliente/compartilhar');
  }

  async function save() {
    if (queued || record.isPending) return;
    // Mesma chave em toda tentativa (vem do treino terminado): repetir nunca grava duas vezes.
    const bodies = buildResultBodies(rows, logs, {
      workout_id: workout.id,
      executed_on: isoDate(session ? new Date(session.finishedAt) : new Date()),
      idempotency_key: session ? resultKeyOf(session) : `${workout.id}-${isoDate(new Date())}`,
      effort: effort ?? undefined,
      feeling: feeling ?? undefined,
      notes: comment.trim() || undefined,
    });
    // De quem é este treino: fixado antes do primeiro envio. Se a pessoa trocar de conta ou de empresa no
    // meio, as partes que faltam não saem com o token da conta nova; vão para a fila de quem treinou.
    const who = fitnessOwner();
    if (!who) return;
    let sent = 0;
    let failure: unknown = null;
    try {
      for (const body of bodies) {
        if (fitnessOwner() !== who) break;
        await record.mutateAsync(body);
        sent += 1;
      }
    } catch (e) {
      failure = e;
    }
    if (!failure && sent === bodies.length) {
      await clearFinishedSession(workout.id, who);
      router.replace('/(client)/fitness');
      return;
    }
    // Recusado pelo servidor (dado inválido, sem acesso): guardar não adianta, a pessoa precisa saber.
    const status = isAxiosError(failure) ? (failure.response?.status ?? 0) : 0;
    if (status >= 400 && status < 500) {
      void showDialog({ title: t('rec.saveFailTitle'), message: t('done.rejected'), tone: 'warn' });
      return;
    }
    try {
      await queueResults(bodies.slice(sent), who);
    } catch {
      // Nem no celular deu para guardar (armazenamento cheio…): o treino fica aqui para tentar de novo.
      void showDialog({ title: t('rec.saveFailTitle'), message: t('offline.storeFail'), tone: 'warn' });
      return;
    }
    // Já está guardado na fila para enviar depois: pode liberar o rascunho e não envia de novo daqui.
    await clearFinishedSession(workout.id, who);
    setQueued(true);
  }

  return (
    <Screen backdrop="none">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <LinearGradient colors={['#ffffff', '#eaf1ff', '#dff3ff']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow size={320} opacity={0.4} style={{ alignSelf: 'center', top: -120 }} />
          <View style={styles.heroTop}>
            <View style={styles.badge}>
              <Ionicons name="trophy" size={14} color={colors.primary} />
              <Text style={styles.badgeText}>{t('done.title')}</Text>
            </View>
            <IconButton icon="close" accessibilityLabel={t('common:actions.close')} onPress={() => router.replace('/(client)/fitness')} />
          </View>
          <Rise>
            <Text style={styles.title} numberOfLines={2}>
              {workout.title}
            </Text>
          </Rise>
          <Rise index={1}>
            <Muted style={styles.sub}>{t('done.subCompany', { company: companyName, done: setsDone, total: totalSets(rows) })}</Muted>
          </Rise>
          <Rise index={2} style={styles.stats}>
            <StatStrip
              align="center"
              items={[
                { value: formatClock(elapsed), label: t('rec.timeUnit') },
                { value: volume.toLocaleString(locale()), label: t('done.volumeUnit') },
                { value: `${setsDone}/${totalSets(rows)}`, label: t('sheet.setsUnit') },
              ]}
            />
            {showActiveRest ? (
              <Muted style={{ marginTop: 10, textAlign: 'center' }}>{t('done.activeRestSummary', { active: formatDuration(activeTotal), rest: formatDuration(restTotal) })}</Muted>
            ) : null}
          </Rise>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 16 }}>
          {records.length ? (
            <Rise index={3}>
              <View style={styles.records} accessible accessibilityLabel={t('done.recordsCount', { count: records.length })}>
                <Ionicons name="flash" size={16} color={colors.primary} />
                <Text style={styles.recordsText} numberOfLines={2}>
                  <Text style={{ fontFamily: typography.fontFamilyBold }}>{t('done.recordsCount', { count: records.length })}</Text>
                  {`  ${records.map((r) => `${r.name} ${formatKg(r.kg)} kg`).join(' · ')}`}
                </Text>
              </View>
            </Rise>
          ) : null}

          <Rise index={4}>
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {t('done.volumeIn', { title: workout.title.split('·')[0].trim() })}
                </Text>
                <Muted>{t('done.lastTimes', { count: bars.length })}</Muted>
              </View>
              <View style={styles.bars} accessible accessibilityLabel={t('done.volumeToday', { kg: volume })}>
                {bars.map((b, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    {i === bars.length - 1 ? (
                      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.bar, { height: Math.max(8, (b.v / maxV) * 64) }]} />
                    ) : (
                      <View style={[styles.bar, { height: Math.max(8, (b.v / maxV) * 64), backgroundColor: i === bars.length - 2 ? '#bfd0f7' : '#e5e9f0' }]} />
                    )}
                    <Text style={[styles.barLabel, i === bars.length - 1 && { color: colors.primary, fontFamily: typography.fontFamilyBold }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </Rise>

          <Rise index={5}>
            <Card>
              <Text style={styles.cardTitle}>{t('done.howWasItShort')}</Text>
              <Muted style={{ marginTop: 4 }}>{t('done.goesTo', { name: workout.contact_name?.split(' ')[0] ?? t('done.yourCoach') })}</Muted>
              <View style={styles.feelings} accessibilityRole="radiogroup">
                {FEELINGS.map((f) => {
                  const on = feeling === f.key;
                  return (
                    <Pressable key={f.key} onPress={() => setFeeling(f.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={f.label} style={[styles.feeling, on && styles.feelingOn]}>
                      <Ionicons name={f.icon} size={22} color={on ? '#fff' : colors.textSoft} />
                      <Text style={[styles.feelingText, on && { color: '#fff' }]} numberOfLines={1}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => setMoreOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: moreOpen }} style={styles.moreRow}>
                <Text style={styles.moreText}>{t('done.effortAndComment')}</Text>
                {effort != null && !moreOpen ? <Text style={styles.moreValue}>{effort}/10</Text> : null}
                <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Pressable>
              {moreOpen ? (
                <>
                  <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 8 }]}>{t('done.effortScale')}</Text>
                  <View style={styles.efforts}>
                    {Array.from({ length: 11 }, (_, n) => (
                      <Pressable key={n} onPress={() => setEffort(n)} accessibilityRole="radio" accessibilityState={{ checked: effort === n }} accessibilityLabel={t('history.effort', { n })} style={[styles.effort, effort === n && styles.feelingOn]}>
                        <Text style={[styles.effortText, effort === n && { color: '#fff' }]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ marginTop: 14 }}>
                    <Field label={t('log.commentOpt')} value={comment} onChangeText={setComment} multiline placeholder={t('done.commentHint')} />
                  </View>
                </>
              ) : null}
            </Card>
          </Rise>

          {queued ? <Body style={styles.queued}>{t('done.queued')}</Body> : null}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Nada passa por baixo da barra de status ao rolar. */}
      <View style={[styles.statusScrim, { height: insets.top }]} pointerEvents="none" />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button label={t('done.share')} icon="share-outline" variant="secondary" onPress={share} style={{ flex: 1 }} />
        {queued ? (
          <Button label={t('log.backToWorkout')} onPress={() => router.replace('/(client)/fitness')} style={{ flex: 1 }} />
        ) : (
          <Button label={t('done.save')} loading={record.isPending} onPress={() => void save()} style={{ flex: 1 }} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 24, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', ...shadows.hero },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: glass(0.8) },
  badgeText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: colors.primaryDeep },
  title: { marginTop: 14, paddingHorizontal: 20, ...text.display, color: colors.text },
  sub: { marginTop: 4, paddingHorizontal: 20, fontSize: 14 },
  stats: { marginTop: 18, paddingHorizontal: 20 },
  cardTitle: { flexShrink: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  records: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.md + 4, backgroundColor: colors.primarySoft },
  recordsText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 13.5, color: colors.primaryDeep },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 92, marginTop: 12 },
  bar: { width: '100%', borderRadius: 10 },
  barLabel: { fontFamily: typography.fontFamily, fontSize: 11.5, color: colors.textMuted },
  feelings: { flexDirection: 'row', gap: 6, marginTop: 14 },
  feeling: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radii.md + 4, backgroundColor: '#f0f2f5' },
  feelingOn: { backgroundColor: colors.primary },
  feelingText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textSoft },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, minHeight: 44, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e3e8f0' },
  moreText: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  moreValue: { ...numbers.xs, color: colors.primaryDeep },
  efforts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  effort: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
  effortText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.textSoft },
  queued: { fontSize: 13.5, color: colors.warnText, textAlign: 'center' },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: glass(0.92) },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: glass(0.94), borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadows.nav },
});
