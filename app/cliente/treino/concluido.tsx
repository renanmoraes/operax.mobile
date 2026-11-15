import { router } from 'expo-router';
import { useActiveCompanySlug, useCompanies } from '@/src/features/client/useClientData';
import i18n, { locale } from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { showDialog } from '@/src/design-system/Dialog';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Field, Glow, IconButton, IconName, Muted, Rise, Screen, StatStrip } from '@/src/design-system/ui';
import { colors, gradients, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { buildResultBodies, flattenWorkout, personalRecords, totalSets } from '@/src/features/fitness/flatten';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { queueResults } from '@/src/features/fitness/resultsQueue';
import { isAxiosError } from 'axios';
import { clearFinishedSession, FinishedSession, getFinishedSession, loadFinishedSession, resultKeyOf } from '@/src/features/fitness/sessionStore';
import type { FitnessFeeling, FitnessWorkoutView } from '@/src/features/fitness/types';
import { useHistory, useLoadHistory, useRecordResult } from '@/src/features/fitness/useFitness';
import { formatClock, formatKg, isoDate } from '@/src/shared/format';

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
  const slug = useActiveCompanySlug();
  const { data: companies } = useCompanies();
  const companyName = companies?.find((c) => c.slug === slug)?.name ?? 'Operax';
  const LOAD_HISTORY = useLoadHistory();
  const rows = useMemo(() => flattenWorkout(workout), [workout]);
  const { data: history } = useHistory();
  const record = useRecordResult();
  const [feeling, setFeeling] = useState<FitnessFeeling | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [queued, setQueued] = useState(false);

  const logs = session?.logs ?? rows.map(() => []);
  const setsDone = logs.reduce((n, l) => n + l.length, 0);
  const volume = Math.round(logs.reduce((n, l) => n + l.reduce((m, s) => m + s.kg * s.reps, 0), 0));
  // Por exercício: num superset cada série é do exercício do seu estágio.
  const records = personalRecords(rows, logs, LOAD_HISTORY);

  const past = (history ?? []).filter((e) => e.title === workout.title).slice(0, 5).reverse();
  const bars = [...past.map((e) => ({ label: e.date.slice(8, 10) + '/' + e.date.slice(5, 7), v: e.volume_kg ?? 0 })), { label: t('sheet.today'), v: volume }];
  const maxV = Math.max(1, ...bars.map((b) => b.v));

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
    let sent = 0;
    try {
      for (const body of bodies) {
        await record.mutateAsync(body);
        sent += 1;
      }
      await clearFinishedSession(workout.id);
      router.replace('/(client)/fitness');
    } catch (e) {
      // Recusado pelo servidor (dado inválido, sem acesso): guardar não adianta, a pessoa precisa saber.
      const status = isAxiosError(e) ? (e.response?.status ?? 0) : 0;
      if (status >= 400 && status < 500) {
        void showDialog({ title: t('rec.saveFailTitle'), message: t('done.rejected'), tone: 'warn' });
        return;
      }
      try {
        await queueResults(bodies.slice(sent));
      } catch {
        // Nem no celular deu para guardar (armazenamento cheio…): o treino fica aqui para tentar de novo.
        void showDialog({ title: t('rec.saveFailTitle'), message: t('offline.storeFail'), tone: 'warn' });
        return;
      }
      // Já está guardado na fila para enviar depois: pode liberar o rascunho e não envia de novo daqui.
      await clearFinishedSession(workout.id);
      setQueued(true);
    }
  }

  return (
    <Screen backdrop="none">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <LinearGradient colors={['#ffffff', '#eaf1ff', '#dff3ff']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow size={360} opacity={0.4} style={{ alignSelf: 'center', top: -120 }} />
          <View style={{ alignItems: 'flex-end', paddingHorizontal: 20 }}>
            <IconButton icon="close" accessibilityLabel={t('common:actions.close')} onPress={() => router.replace('/(client)/fitness')} />
          </View>
          <Rise style={{ alignItems: 'center' }}>
            <LinearGradient colors={gradients.brand} style={styles.trophy}>
              <Ionicons name="trophy-outline" size={38} color="#fff" />
            </LinearGradient>
          </Rise>
          <Rise index={1}>
            <Text style={styles.title}>{t('done.title')}</Text>
          </Rise>
          <Rise index={2}>
            <Muted style={styles.sub}>{t('done.sub', { title: workout.title, done: setsDone, total: totalSets(rows) })}</Muted>
          </Rise>
          <Rise index={3} style={styles.stats}>
            <StatStrip
              align="center"
              items={[
                { value: formatClock(session?.elapsed ?? 0), label: t('rec.timeUnit') },
                { value: volume.toLocaleString(locale()), label: t('done.volumeUnit') },
                { value: `${setsDone}/${totalSets(rows)}`, label: t('sheet.setsUnit') },
              ]}
            />
          </Rise>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 16 }}>
          {records.length ? (
            <Rise index={4}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="flash-outline" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>{records.length === 1 ? '1 novo recorde' : `${records.length} novos recordes`}</Text>
                </View>
                {records.map((r) => (
                  <View key={r.name} style={styles.record}>
                    <Text style={styles.recordName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.recordValue}>{`${formatKg(r.kg)} kg  +${formatKg(r.diff)}`}</Text>
                  </View>
                ))}
              </Card>
            </Rise>
          ) : null}

          <Rise index={5}>
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{t('done.volumeIn', { title: workout.title.split('·')[0].trim() })}</Text>
                <Muted>{t('done.lastTimes', { count: bars.length })}</Muted>
              </View>
              <View style={styles.bars} accessible accessibilityLabel={t('done.volumeToday', { kg: volume })}>
                {bars.map((b, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    {i === bars.length - 1 ? (
                      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.bar, { height: Math.max(8, (b.v / maxV) * 92) }]} />
                    ) : (
                      <View style={[styles.bar, { height: Math.max(8, (b.v / maxV) * 92), backgroundColor: i === bars.length - 2 ? '#bfd0f7' : '#e5e9f0' }]} />
                    )}
                    <Text style={[styles.barLabel, i === bars.length - 1 && { color: colors.primary, fontFamily: typography.fontFamilyBold }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </Rise>

          <Rise index={6}>
            <Card>
              <Text style={styles.cardTitle}>{t('rec.howWasIt')}</Text>
              <Muted style={{ marginTop: 4 }}>{t('done.goesTo', { name: workout.contact_name?.split(' ')[0] ?? t('done.yourCoach') })}</Muted>
              <View style={styles.feelings} accessibilityRole="radiogroup">
                {FEELINGS.map((f) => {
                  const on = feeling === f.key;
                  return (
                    <Pressable key={f.key} onPress={() => setFeeling(f.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={f.label} style={[styles.feeling, on && styles.feelingOn]}>
                      <Ionicons name={f.icon} size={22} color={on ? '#fff' : colors.textSoft} />
                      <Text style={[styles.feelingText, on && { color: '#fff' }]}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 16 }]}>{t('done.effortScale')}</Text>
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
            </Card>
          </Rise>

          <Rise index={7}>
            <Card style={styles.share}>
              <LinearGradient colors={gradients.media} style={styles.story}>
                <Text style={styles.storyTime}>{formatClock(session?.elapsed ?? 0)}</Text>
                <Text style={styles.storyHandle}>{companyName}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('done.share')}</Text>
                <Muted style={{ marginTop: 3, lineHeight: 18 }}>{feeling ? t('done.shareSub') : t('done.shareLocked')}</Muted>
                {feeling ? (
                  <Button
                    label={t('done.share')}
                    compact
                    icon="share-outline"
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    onPress={() => void Share.share({ message: t('done.shareMessage', { title: workout.title, time: formatClock(session?.elapsed ?? 0), kg: volume.toLocaleString(locale()) }) })}
                  />
                ) : null}
              </View>
            </Card>
          </Rise>

          {queued ? <Body style={styles.queued}>{t('done.queued')}</Body> : null}
          {queued ? (
            <Button label={t('log.backToWorkout')} onPress={() => router.replace('/(client)/fitness')} />
          ) : (
            <Button label={t('done.saveBack')} loading={record.isPending} onPress={() => void save()} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 28, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', ...shadows.hero },
  trophy: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  title: { marginTop: 18, textAlign: 'center', ...text.display, color: colors.text },
  sub: { marginTop: 6, textAlign: 'center', fontSize: 14.5 },
  stats: { marginTop: 22, paddingHorizontal: 20 },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  record: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.md + 4, backgroundColor: colors.primarySoft },
  recordName: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  recordValue: { ...numbers.xs, color: colors.primaryDeep },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120, marginTop: 14 },
  bar: { width: '100%', borderRadius: 10 },
  barLabel: { fontFamily: typography.fontFamily, fontSize: 11.5, color: colors.textMuted },
  feelings: { flexDirection: 'row', gap: 6, marginTop: 14 },
  feeling: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radii.md + 4, backgroundColor: '#f0f2f5' },
  feelingOn: { backgroundColor: colors.primary },
  feelingText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textSoft },
  efforts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  effort: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
  effortText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.textSoft },
  share: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  story: { width: 62, height: 96, borderRadius: 14, padding: 8, justifyContent: 'flex-end' },
  storyTime: { color: '#fff', fontFamily: typography.fontFamilyBold, fontSize: 12 },
  storyHandle: { color: '#dce6ff', fontFamily: typography.fontFamily, fontSize: 8 },
  queued: { fontSize: 13.5, color: colors.warnText, textAlign: 'center' },
});
