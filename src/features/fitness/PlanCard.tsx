import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card, Muted } from '@/src/design-system/ui';
import { colors, numbers, text, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { formatClock } from '@/src/shared/format';
import { RATE_UNIT } from './rateUnit';
import { formatPace } from './runTracker';
import type { ActivityDetail, PlanSummary, PlannedRow } from './types';

const km = (m: number) => `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m / 1000)} km`;
const timeRange = (s: PlanSummary['planned_seconds']) => (!s ? '—' : s.min === s.max ? formatClock(s.min) : `${formatClock(s.min)} – ${formatClock(s.max)}`);

/** Cor do quanto foi feito: abaixo de 90% em alerta, do pedido para cima em verde. */
export const planColor = (pct: number) => (pct < 90 ? colors.warn : colors.success);

/**
 * Anel do pedido x feito: enche até 100%; o excesso dá uma segunda volta fina por fora, para "fiz a mais" aparecer sem esconder o
 * número. `size` em pontos da tela.
 */
export function PlanRing({ percent, size = 112, label }: { percent: number | null; size?: number; label?: string }) {
  const pct = percent ?? 0;
  const stroke = size * 0.085;
  const r = size / 2 - stroke * 1.6;
  const c = 2 * Math.PI * r;
  const ro = r + stroke * 0.95;
  const co = 2 * Math.PI * ro;
  const main = Math.min(pct, 100) / 100;
  const over = Math.min(Math.max(pct - 100, 0), 100) / 100;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={label}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={planColor(pct)} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${main * c} ${c}`} />
        {over > 0 ? <Circle cx={size / 2} cy={size / 2} r={ro} stroke={colors.primary} strokeWidth={stroke * 0.45} fill="none" strokeLinecap="round" strokeDasharray={`${over * co} ${co}`} /> : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.pct, { fontSize: size * 0.24 }]}>
          {percent == null ? '—' : pct}
          {percent == null ? null : <Text style={[styles.pctSign, { fontSize: size * 0.12 }]}>%</Text>}
        </Text>
      </View>
    </View>
  );
}

/** Pedido x feito do treino prescrito: o percentual, o total de distância e tempo, e cada etapa ao lado da volta feita. */
export function PlanCard({ detail }: { detail: ActivityDetail }) {
  const { t } = useTranslation('fitness');
  // Celular estreito: o anel vai em cima e a tabela embaixo, na largura toda (lado a lado a faixa de tempo não cabe).
  const narrow = useWindowDimensions().width < 400;
  const plan = detail.plan;
  const rows = detail.planned ?? [];
  const unit = RATE_UNIT[detail.rate_unit].label;
  if (!plan && !rows.length) return null;
  const diff = plan?.percent != null ? plan.percent - 100 : null;
  return (
    <Card style={{ gap: 14 }}>
      <Text style={styles.title}>{t('plan.title')}</Text>
      {plan ? (
        <View style={[styles.top, narrow && styles.topNarrow]}>
          <PlanRing percent={plan.percent} label={t('plan.a11y', { pct: plan.percent ?? 0 })} />
          <View style={[{ gap: 8 }, narrow ? { alignSelf: 'stretch' } : { flex: 1 }]}>
            <Muted style={{ fontSize: 12 }}>{t('plan.ofPlanned')}</Muted>
            <View style={styles.grid}>
              <Text style={styles.head} />
              <Text style={[styles.head, styles.cell]}>{t('plan.planned')}</Text>
              <Text style={[styles.head, styles.cell]}>{t('plan.done')}</Text>
            </View>
            {plan.planned_meters != null ? (
              <View style={styles.grid}>
                <Muted style={styles.label}>{t('plan.distance')}</Muted>
                <Text style={[styles.plannedVal, styles.cell]}>{km(plan.planned_meters)}</Text>
                <Text style={[styles.doneVal, styles.cell]}>{plan.done_meters != null ? km(plan.done_meters) : '—'}</Text>
              </View>
            ) : null}
            {plan.planned_seconds ? (
              <View style={styles.grid}>
                <Muted style={styles.label}>{t('plan.time')}</Muted>
                <Text style={[styles.plannedVal, styles.cell]} numberOfLines={2}>{timeRange(plan.planned_seconds)}</Text>
                <Text style={[styles.doneVal, styles.cell]}>{plan.done_seconds != null ? formatClock(plan.done_seconds) : '—'}</Text>
              </View>
            ) : null}
            {diff != null && diff !== 0 ? (
              <View style={[styles.chip, { backgroundColor: diff > 0 ? colors.successSoft : colors.warnSoft }]}>
                <Text style={[styles.chipText, { color: diff > 0 ? colors.success : colors.warnText }]}>{t(diff > 0 ? 'plan.more' : 'plan.less', { pct: Math.abs(diff) })}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {rows.length ? (
        <View style={{ gap: 10, borderTopWidth: 1, borderColor: colors.borderSoft, paddingTop: 12 }}>
          {rows.map((r) => (
            <StepRow key={r.index} row={r} unit={unit} kmh={detail.rate_unit === 'kmh'} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function StepRow({ row, unit, kmh }: { row: PlannedRow; unit: string; kmh: boolean }) {
  const { t } = useTranslation('fitness');
  const rate = (v: number) => (kmh ? `${v.toFixed(1).replace('.', ',')} ${unit}` : `${formatPace(v)}${unit}`);
  const planned = row.kind === 'extra' ? null : [
    row.planned_meters != null ? km(row.planned_meters) : row.planned_seconds != null ? formatClock(row.planned_seconds) : null,
    row.planned_rate ? `${rate(row.planned_rate.min)}${row.planned_rate.max ? ` – ${rate(row.planned_rate.max)}` : ''}` : null,
  ].filter(Boolean).join(' · ');
  const done = [row.done_meters != null ? km(row.done_meters) : null, formatClock(row.done_seconds), row.done_rate != null ? rate(row.done_rate) : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{row.index}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.stepPlanned} numberOfLines={2}>{row.kind === 'extra' ? t('plan.extra') : `${t(`plan.kind.${row.kind}`)}${planned ? ` · ${planned}` : ''}`}</Text>
        <Text style={styles.stepDone} numberOfLines={2}>{done}</Text>
      </View>
      {row.rate_status ? <Text style={[styles.status, { color: row.rate_status === 'within' ? colors.success : colors.warnText }]}>{t(`plan.rate.${row.rate_status}`)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...text.section, color: colors.text },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  topNarrow: { flexDirection: 'column', alignItems: 'center' },
  pct: { ...numbers.md, color: colors.text },
  pctSign: { fontFamily: typography.fontFamilySemiBold, color: colors.textMuted },
  grid: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  head: { width: 62, fontFamily: typography.fontFamilySemiBold, fontSize: 11, color: colors.textMuted },
  cell: { flex: 1, width: undefined },
  label: { width: 62, fontSize: 12 },
  plannedVal: { ...numbers.xs, color: colors.primary },
  doneVal: { ...numbers.xs, color: colors.success },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  chipText: { fontFamily: typography.fontFamilySemiBold, fontSize: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { ...numbers.xs, color: colors.primary },
  stepPlanned: { fontFamily: typography.fontFamilyMedium, fontSize: 13, color: colors.primary },
  stepDone: { fontFamily: typography.fontFamilyMedium, fontSize: 13, color: colors.success },
  status: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5 },
});
