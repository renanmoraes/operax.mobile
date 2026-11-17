import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { Badge, Card, EmptyState, Muted, PressableScale, SectionHeader } from '@/src/design-system/ui';
import { locale } from '@/src/i18n';
import { BMI_BANDS, CHART_GROUPS, bmiBand, healthyWeightRange, orderedMeasures, seriesOf, summaryRows, valueOf, weightReading } from '@/src/features/portal/assessments';
import { PortalPage } from '@/src/features/portal/PortalPage';
import { TrendChart } from '@/src/features/portal/TrendChart';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';
import { usePortalAssessments } from '@/src/features/portal/usePortal';

const fmt = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 2 });
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale());
const BAR: Record<string, string> = { under: colors.primary, normal: colors.success, over: colors.warn, ob1: colors.danger, ob2: colors.danger, ob3: colors.danger };

function Reading({ title, hint, value, chip }: { title: string; hint?: string; value: string; chip?: React.ReactNode }) {
  return (
    <View style={styles.reading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.readTitle}>{title}</Text>
        {hint ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {chip}
        <Text style={styles.readValue}>{value}</Text>
      </View>
    </View>
  );
}

/** As avaliações do próprio aluno: gordura, massas, IMC e a evolução. */
export default function AssessmentsScreen() {
  const { t } = useTranslation('portal');
  const q = usePortalAssessments();
  useFocusRefetch(q.refetch);
  const [open, setOpen] = useState<string | null>(null);
  const items = q.data ?? [];
  const last = items[items.length - 1];

  const body = () => {
    if (!last) return <EmptyState icon="body-outline" title={t('assess.empty')} />;
    const height = last.measures.height_cm ?? [...items].reverse().find((a) => a.measures.height_cm)?.measures.height_cm;
    const weight = last.measures.weight_kg;
    const bmi = last.derived.bmi;
    const band = bmi ? bmiBand(bmi) : null;
    const reading = weight && height ? weightReading(weight, height) : null;
    const range = height ? healthyWeightRange(height) : null;
    const fat = valueOf(last, 'body_fat_percent');
    const lean = valueOf(last, 'lean_mass_kg');
    const rows = summaryRows(items, fmt, (d) => t('assess.elapsed', d));
    return (
      <>
        {rows.length ? (
          <Card style={{ gap: 6 }}>
            <View style={styles.between}>
              <Text style={styles.cardTitle}>{t('assess.summaryTitle')}</Text>
              <Muted style={{ fontSize: 12 }}>{t('assess.count', { count: items.length })}</Muted>
            </View>
            <View style={styles.sumHead}>
              <Text style={[styles.sumCell, { flex: 1.4, textAlign: 'left' }]}>{t('assess.indicator')}</Text>
              <Text style={styles.sumCell}>{t('assess.last')}</Text>
              <Text style={styles.sumCell}>{t('assess.overall')}</Text>
            </View>
            {rows.map((r) => (
              <View key={r.key} style={styles.sumRow}>
                <Text style={[styles.sumLabel, { flex: 1.4 }]}>{t(`assess.rows.${r.key}`)}</Text>
                <Text style={styles.sumVal}>{r.last ?? '—'}</Text>
                <Text style={styles.sumVal}>{r.overall ?? '—'}</Text>
              </View>
            ))}
            <Muted style={{ fontSize: 12, lineHeight: 17, marginTop: 4 }}>{t('assess.summaryNote')}</Muted>
          </Card>
        ) : null}

        <Card style={{ gap: 4 }}>
          <View style={styles.between}>
            <Text style={styles.cardTitle}>{t('assess.controlTitle')}</Text>
            <Muted style={{ fontSize: 12 }}>{day(last.assessed_on)}</Muted>
          </View>
          <View style={styles.facts}>
            {height ? <Fact label={t('assess.height')} value={`${fmt(height)} cm`} /> : null}
            <Fact label={t('assess.lastDate')} value={day(last.assessed_on)} />
            <Fact label={t('assess.evaluations')} value={String(items.length)} />
            {last.assessor_name ? <Fact label={t('assess.assessor')} value={last.assessor_name} /> : null}
          </View>
          {last.notes ? <Muted style={{ marginTop: 6 }}>{last.notes}</Muted> : null}
        </Card>

        <Card style={{ gap: 0 }}>
          <Text style={[styles.cardTitle, { marginBottom: 4 }]}>{t('assess.compTitle')}</Text>
          {weight ? (
            <Reading
              title={t('assess.weight')}
              hint={range ? t('assess.weightRef', { min: fmt(range.min), max: fmt(range.max) }) : undefined}
              value={`${fmt(weight)} kg`}
              chip={reading ? <Badge label={`${t(`assess.reading.${reading.key}`)}${reading.diff ? ` ${fmt(reading.diff)} kg` : ''}`} tone={reading.tone} /> : undefined}
            />
          ) : null}
          {bmi && band ? <Reading title={t('assess.bmi')} hint={t('assess.bmiHint')} value={fmt(bmi)} chip={<Badge label={t(`assess.bmiBands.${band.key}`)} tone={band.tone} />} /> : null}
          {fat !== undefined ? <Reading title={t('assess.fat')} hint={last.derived.body_fat_percent !== undefined && last.derived.method_label ? t('assess.fatCalc', { method: last.derived.method_label }) : t('assess.fatInformed')} value={`${fmt(fat)} %`} /> : null}
          {last.derived.fat_mass_kg !== undefined ? <Reading title={t('assess.fatMass')} value={`${fmt(last.derived.fat_mass_kg)} kg`} /> : null}
          {lean !== undefined ? <Reading title={t('assess.leanMass')} value={`${fmt(lean)} kg`} /> : null}
          {last.derived.waist_hip_ratio ? <Reading title={t('assess.whr')} hint={t('assess.whrHint')} value={fmt(last.derived.waist_hip_ratio)} /> : null}
        </Card>

        {bmi && band ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.cardTitle}>{t('assess.bmiTitle')}</Text>
            <View accessible accessibilityLabel={`${t('assess.bmi')} ${fmt(bmi)}: ${t(`assess.bmiBands.${band.key}`)}`}>
              <Text style={[styles.marker, { marginLeft: `${Math.min(Math.max((Math.min(bmi, 45) / 45) * 100 - 6, 0), 88)}%` }]}>{`▼ ${fmt(bmi)}`}</Text>
              <View style={styles.bar}>
                {BMI_BANDS.map((b) => (
                  <View key={b.key} style={{ flex: Math.min(b.to, 45) - b.from > 0 ? Math.min(b.to, 45) - b.from : 1, backgroundColor: BAR[b.key], opacity: b.key === band.key ? 1 : 0.3 }} />
                ))}
              </View>
            </View>
            {BMI_BANDS.map((b) => (
              <Text key={b.key} style={[styles.legend, b.key === band.key && { fontFamily: typography.fontFamilyBold, color: colors.text }]}>
                {`${t(`assess.bmiBands.${b.key}`)}: ${b.to >= 100 ? `${fmt(b.from)}+` : `${fmt(b.from)} – ${fmt(b.to)}`}`}
              </Text>
            ))}
          </Card>
        ) : null}

        {CHART_GROUPS.map((group) => {
          const charts = group.charts.map((c) => ({ ...c, points: seriesOf(items, c.key) })).filter((c) => c.points.length > 0);
          if (!charts.length) return null;
          return (
            <View key={group.id} style={{ gap: 8 }}>
              <SectionHeader title={t('assess.history', { group: t(`assess.groups.${group.id}`) })} />
              {charts.map((c) => (
                <TrendChart key={c.key} title={t(`meas.${c.key}` as 'meas.weight_kg')} unit={c.unit} points={c.points} />
              ))}
            </View>
          );
        })}

        <SectionHeader title={t('assess.eachTitle')} />
        {[...items].reverse().map((a, i) => {
          const isOpen = open === a.id || (open === null && i === 0);
          const f = valueOf(a, 'body_fat_percent');
          return (
            <Card key={a.id} style={{ gap: 8 }}>
              <PressableScale onPress={() => setOpen(isOpen ? '' : a.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} scaleTo={0.99}>
                <Text style={styles.eachTitle}>{`${day(a.assessed_on)}${f !== undefined ? ` · ${t('assess.fat')} ${fmt(f)} %` : ''}${a.derived.bmi ? ` · ${t('assess.bmi')} ${fmt(a.derived.bmi)}` : ''}`}</Text>
              </PressableScale>
              {isOpen ? (
                <View style={{ gap: 6 }}>
                  {a.derived.method_label ? <Muted style={{ fontSize: 12 }}>{t('assess.method', { method: a.derived.method_label })}</Muted> : null}
                  {orderedMeasures(a.measures).map(([k, v]) => (
                    <View key={k} style={styles.between}>
                      <Muted>{t(`meas.${k}`)}</Muted>
                      <Text style={styles.readValue}>{fmt(v)}</Text>
                    </View>
                  ))}
                  {a.derived.waist_hip_ratio ? (
                    <View style={styles.between}>
                      <Muted>{t('meas.waist_hip_ratio')}</Muted>
                      <Text style={styles.readValue}>{fmt(a.derived.waist_hip_ratio)}</Text>
                    </View>
                  ) : null}
                  {a.notes ? <Muted style={{ marginTop: 4 }}>{a.notes}</Muted> : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </>
    );
  };

  return (
    <PortalPage title={t('assess.title')} lead={t('assess.lead')} loading={q.isLoading} error={q.isError ? t('common.loadFail') : null} onRetry={() => void q.refetch()}>
      {body()}
    </PortalPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.text },
  sumHead: { flexDirection: 'row', paddingTop: 6 },
  sumCell: { flex: 1, textAlign: 'right', fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted },
  sumRow: { flexDirection: 'row', paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.track },
  sumLabel: { fontFamily: typography.fontFamilyMedium, fontSize: 14, color: colors.text },
  sumVal: { flex: 1, textAlign: 'right', fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  fact: { minWidth: '40%' },
  factValue: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.track },
  readTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text },
  readValue: { fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  marker: { fontFamily: typography.fontFamilyBold, fontSize: 12, color: colors.text, marginBottom: 4 },
  bar: { flexDirection: 'row', height: 12, borderRadius: radii.pill, overflow: 'hidden' },
  legend: { fontFamily: typography.fontFamilyMedium, fontSize: 12.5, color: colors.textMuted },
  eachTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: colors.text },
});
