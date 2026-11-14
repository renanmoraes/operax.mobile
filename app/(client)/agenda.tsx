import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, HeroCard, IconTile, Muted, Rise, Screen, ScreenHeader, Segmented } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { BookingCard, bookingHref } from '@/src/features/client/BookingCard';
import { useBookings, useCompanies } from '@/src/features/client/useClientData';
import type { ClientBooking } from '@/src/features/client/types';
import { addDays, formatHour, isoDate, monthFull, sameDay, startOfDay, startOfWeek, weekdayFull, weekdayShort } from '@/src/shared/format';

type View_ = 'planilha' | 'semana' | 'mes' | 'proximos';

function dayKey(iso: string) {
  return isoDate(new Date(iso));
}

function DayStrip({ selected, onSelect, items }: { selected: Date; onSelect: (d: Date) => void; items: ClientBooking[] }) {
  const start = startOfWeek(new Date());
  const today = startOfDay(new Date());
  return (
    <View style={styles.strip}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const on = sameDay(d, selected);
        const has = items.some((b) => dayKey(b.starts_at) === isoDate(d));
        return (
          <Pressable
            key={i}
            onPress={() => onSelect(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${weekdayFull(d)} ${d.getDate()}${has ? ', com compromisso' : ', livre'}`}
            style={[styles.stripDay, on ? styles.stripOn : styles.stripOff]}
          >
            <Text style={[styles.stripWd, on && { color: 'rgba(255,255,255,0.8)' }]}>{weekdayShort(d)}</Text>
            <Text style={[styles.stripNum, on && { color: '#fff' }, !on && sameDay(d, today) && { color: colors.primary }]}>{d.getDate()}</Text>
            <View style={[styles.stripDot, { backgroundColor: has ? (on ? '#fff' : colors.primary) : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ClientAgendaScreen() {
  const insets = useSafeAreaInsets();
  const { data: all } = useBookings();
  const { data: companies } = useCompanies();
  const [view, setView] = useState<View_>('planilha');
  const [company, setCompany] = useState<string>('all');
  const [selected, setSelected] = useState(startOfDay(new Date()));

  const items = useMemo(() => (all ?? []).filter((b) => company === 'all' || b.tenant_slug === company), [all, company]);
  const dayItems = items.filter((b) => dayKey(b.starts_at) === isoDate(selected));
  const today = startOfDay(new Date());

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Agenda"
          right={<Button label="Pedir horário" icon="add" compact onPress={() => router.push('/cliente/chat/move-studio?pedido=1')} />}
        />
        <View style={{ paddingHorizontal: 20 }}>
          <Segmented
            value={view}
            onChange={(k) => setView(k as View_)}
            options={[
              { key: 'planilha', label: 'Planilha' },
              { key: 'semana', label: 'Semana' },
              { key: 'mes', label: 'Mês' },
              { key: 'proximos', label: 'Próximos' },
            ]}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
          <Chip label="Todas as empresas" selected={company === 'all'} onPress={() => setCompany('all')} />
          {companies?.map((c) => (
            <Chip key={c.slug} label={c.name} selected={company === c.slug} onPress={() => setCompany(c.slug)} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 20 }}>
          {view === 'planilha' ? (
            <Rise>
              <DayStrip selected={selected} onSelect={setSelected} items={items} />
              <Text style={styles.dayTitle}>{`${sameDay(selected, today) ? 'Hoje, ' : ''}${weekdayFull(selected)} ${selected.getDate()}`}</Text>
              {dayItems.length === 0 ? (
                <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={styles.emptyTitle}>Dia livre</Text>
                  <Muted style={{ marginTop: 4 }}>Nada marcado por aqui.</Muted>
                </Card>
              ) : (
                <View style={{ gap: 10 }}>
                  {dayItems.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </View>
              )}
            </Rise>
          ) : null}

          {view === 'semana' ? (
            <Rise>
              <Card style={{ paddingVertical: 6 }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(startOfWeek(new Date()), i);
                  const its = items.filter((b) => dayKey(b.starts_at) === isoDate(d));
                  const isToday = sameDay(d, today);
                  return (
                    <View key={i} style={[styles.weekRow, i < 6 && styles.weekBorder]}>
                      <View style={{ width: 44 }}>
                        <Text style={[styles.weekWd, isToday && { color: colors.primary }]}>{weekdayShort(d)}</Text>
                        <Text style={[styles.weekNum, isToday && { color: colors.primary }]}>{d.getDate()}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        {its.length === 0 ? <Muted style={{ paddingTop: 9 }}>Livre</Muted> : null}
                        {its.map((b) => (
                          <Pressable key={b.id} onPress={() => router.push(bookingHref(b) as never)} accessibilityRole="button" style={[styles.weekItem, { backgroundColor: b.status === 'pending' ? colors.warnSoft : '#f0f2f5' }]}>
                            <Text style={[styles.weekTime, { color: b.status === 'pending' ? colors.warn : colors.primaryDeep }]}>{formatHour(b.starts_at)}</Text>
                            <Text style={styles.weekTitle} numberOfLines={1}>{b.service_name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </Card>
            </Rise>
          ) : null}

          {view === 'mes' ? (
            <Rise>
              <Card>
                <View style={styles.monthHead}>
                  <Text style={styles.monthTitle}>{`${monthFull(today)[0].toUpperCase()}${monthFull(today).slice(1)} ${today.getFullYear()}`}</Text>
                  <Muted>{`${items.filter((b) => new Date(b.starts_at).getMonth() === today.getMonth()).length} compromissos`}</Muted>
                </View>
                <View style={styles.monthGrid}>
                  {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((l, i) => (
                    <Text key={i} style={styles.monthWd}>{l}</Text>
                  ))}
                  {(() => {
                    const first = new Date(today.getFullYear(), today.getMonth(), 1);
                    const lead = (first.getDay() + 6) % 7;
                    const daysIn = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                    const cells: React.ReactNode[] = [];
                    for (let i = 0; i < lead; i++) cells.push(<View key={`e${i}`} style={styles.monthCell} />);
                    for (let n = 1; n <= daysIn; n++) {
                      const d = new Date(today.getFullYear(), today.getMonth(), n);
                      const has = items.some((b) => dayKey(b.starts_at) === isoDate(d));
                      const isToday = sameDay(d, today);
                      cells.push(
                        <Pressable
                          key={n}
                          onPress={() => {
                            setSelected(d);
                            setView('planilha');
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Dia ${n}${has ? ', com compromisso' : ''}`}
                          style={[styles.monthCell, isToday && styles.monthToday]}
                        >
                          <Text style={[styles.monthNum, d < today && { color: '#8c99b0' }, isToday && { color: '#fff' }]}>{n}</Text>
                          <View style={[styles.monthDot, { backgroundColor: has ? (isToday ? '#fff' : colors.primary) : 'transparent' }]} />
                        </Pressable>,
                      );
                    }
                    return cells;
                  })()}
                </View>
              </Card>
            </Rise>
          ) : null}

          {view === 'proximos' ? (
            <Rise style={{ gap: 14 }}>
              {(() => {
                const future = items.filter((b) => new Date(b.ends_at) >= new Date() && b.status !== 'cancelled');
                const groups = new Map<string, ClientBooking[]>();
                future.forEach((b) => groups.set(dayKey(b.starts_at), [...(groups.get(dayKey(b.starts_at)) ?? []), b]));
                const endOfWeek = addDays(startOfWeek(new Date()), 7);
                let broke = false;
                return [...groups.entries()].map(([k, list]) => {
                  const d = new Date(`${k}T12:00:00`);
                  const showBreak = !broke && d >= endOfWeek;
                  if (showBreak) broke = true;
                  return (
                    <View key={k} style={{ gap: 8 }}>
                      {showBreak ? (
                        <View style={styles.breakRow}>
                          <View style={styles.breakLine} />
                          <Muted style={{ fontFamily: typography.fontFamilyBold, fontSize: 12 }}>Próxima semana</Muted>
                          <View style={styles.breakLine} />
                        </View>
                      ) : null}
                      <Text style={styles.groupLabel}>{sameDay(d, today) ? `Hoje · ${weekdayFull(d)} ${d.getDate()}` : `${weekdayFull(d)} ${d.getDate()}`}</Text>
                      {sameDay(d, today) ? (
                        <View style={styles.nowRow}>
                          <Text style={styles.nowText}>{`Agora · ${formatHour(new Date().toISOString())}`}</Text>
                          <View style={styles.nowLine} />
                        </View>
                      ) : null}
                      {list.map((b) => (
                        <BookingCard key={b.id} booking={b} />
                      ))}
                    </View>
                  );
                });
              })()}
            </Rise>
          ) : null}

          <HeroCard style={{ marginTop: 14, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <IconTile icon="calendar-number-outline" size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.syncTitle}>Agenda no seu celular</Text>
                <Muted style={{ marginTop: 2, lineHeight: 18 }}>Assine uma vez e os novos horários aparecem sozinhos.</Muted>
              </View>
              <Button label="Assinar" compact onPress={() => router.push('/cliente/calendario')} />
            </View>
          </HeroCard>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  strip: { flexDirection: 'row', gap: 6 },
  stripDay: { flex: 1, height: 74, borderRadius: radii.lg - 2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  stripOn: { backgroundColor: colors.primary, ...shadows.button },
  stripOff: { backgroundColor: 'rgba(255,255,255,0.88)' },
  stripWd: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textMuted },
  stripNum: { ...numbers.sm, color: colors.text },
  stripDot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dayTitle: { marginTop: 18, marginBottom: 10, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  emptyTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text },
  weekRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  weekBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  weekWd: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textMuted },
  weekNum: { ...numbers.sm, color: colors.text },
  weekItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radii.md },
  weekTime: { ...numbers.xs },
  weekTitle: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.text },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  monthTitle: { ...text.section, color: colors.text },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  monthWd: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textMuted, marginBottom: 6 },
  monthCell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, gap: 3 },
  monthToday: { backgroundColor: colors.primary },
  monthNum: { fontFamily: typography.fontFamilyBold, fontSize: 13.5, color: colors.text },
  monthDot: { width: 5, height: 5, borderRadius: 3 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  breakLine: { flex: 1, height: 1, backgroundColor: '#d9dee7' },
  groupLabel: { fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.textSoft, textTransform: 'capitalize' },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nowText: { fontFamily: typography.fontFamilyBold, fontSize: 12, color: colors.primary },
  nowLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.primary },
  syncTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
});
