import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { QrCode } from '@/src/design-system/QrCode';
import { colors, gradients, radii, typography } from '@/src/design-system/tokens';
import { Badge, Button, EmptyState, Muted } from '@/src/design-system/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { PortalPage } from '@/src/features/portal/PortalPage';
import { shortDate } from '@/src/features/portal/format';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';
import { usePortalCards, usePortalHome } from '@/src/features/portal/usePortal';
import type { PortalMemberCard } from '@/src/shared/api/portal.api';
import { WEB_APP_URL } from '@/src/shared/config';

const TONE = { active: 'success', pending_payment: 'warn', cancelled: 'danger' } as const;

type Slide = { kind: 'card'; card: PortalMemberCard } | { kind: 'without'; names: string };

/** A carteirinha de associado: número, QR de conferência e, se houver, a dos dependentes (deslizando para o lado). */
export default function MemberCardScreen() {
  const { t } = useTranslation('portal');
  const { width } = useWindowDimensions();
  const home = usePortalHome();
  const q = usePortalCards();
  useFocusRefetch(q.refetch);
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Slide>>(null);
  const brand = home.data?.brand_name ?? '';
  const pageW = width - 40;

  const slides: Slide[] = [
    ...(q.data?.cards ?? []).map((card) => ({ kind: 'card' as const, card })),
    ...(q.data?.without_card.length ? [{ kind: 'without' as const, names: q.data.without_card.map((d) => (d.relationship ? `${d.name} (${d.relationship})` : d.name)).join(', ') }] : []),
  ];
  const total = slides.length;

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    await showDialog({ title: t('card.copied'), tone: 'success' });
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    if (item.kind === 'without') {
      return (
        <View style={{ width: pageW, paddingHorizontal: 2 }}>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('card.without', { count: item.names.split(', ').length })}</Text>
            <Text style={styles.name}>{item.names}</Text>
            <Muted>{t('card.withoutSub')}</Muted>
          </View>
        </View>
      );
    }
    const c = item.card;
    return (
      <View style={{ width: pageW, gap: 14, paddingHorizontal: 2 }}>
        <LinearGradient colors={c.situation === 'cancelled' ? ['#6b7280', '#4b5563'] : gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.face}>
          <View style={styles.between}>
            <Text style={styles.brand} numberOfLines={1}>{brand}</Text>
            <Badge label={t(`card.situation.${c.situation}`)} tone={TONE[c.situation]} />
          </View>
          <Text style={styles.holder}>{c.name}</Text>
          <Text style={styles.sub}>{`${c.kind === 'dependente' ? (c.relationship ?? t('card.dependent')) : t('card.holder')}${c.plan ? ` · ${c.plan}` : ''}`}</Text>
          <Text style={styles.code} accessibilityLabel={t('card.numberLabel', { code: c.code })}>{c.code}</Text>
          <Text style={styles.since}>{t('card.since', { date: shortDate(c.issued_at) })}</Text>
        </LinearGradient>
        {c.situation === 'pending_payment' ? <Muted style={styles.center}>{t('card.hintPending')}</Muted> : null}
        {c.situation === 'cancelled' ? <Muted style={styles.center}>{t('card.hintCancelled')}</Muted> : null}
        {c.situation !== 'cancelled' ? (
          <>
            <View style={styles.qr}>
              <QrCode value={`${WEB_APP_URL}/validar/${encodeURIComponent(c.code)}`} size={Math.min(220, pageW - 80)} accessibilityLabel={c.name} />
            </View>
            <Muted style={styles.center}>{t('card.atCounter')}</Muted>
            <Button label={t('card.copyNumber')} icon="copy-outline" variant="secondary" onPress={() => void copy(c.code)} />
          </>
        ) : null}
      </View>
    );
  };

  return (
    <PortalPage
      title={t('card.title')}
      lead={total > 1 ? t('card.leadMany') : t('card.leadOne')}
      loading={q.isLoading}
      error={q.isError ? t('common.loadFail') : null}
      onRetry={() => void q.refetch()}
      right={total > 1 ? <Badge label={t('card.position', { n: index + 1, total })} /> : undefined}
    >
      {!total ? <EmptyState icon="id-card-outline" title={t('card.empty')} /> : null}
      {total ? (
        <FlatList
          ref={list}
          data={slides}
          keyExtractor={(s, i) => (s.kind === 'card' ? s.card.id : `without-${i}`)}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={total > 1}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / pageW))}
          getItemLayout={(_, i) => ({ length: pageW, offset: pageW * i, index: i })}
          style={{ flexGrow: 0 }}
        />
      ) : null}
    </PortalPage>
  );
}

const styles = StyleSheet.create({
  face: { borderRadius: radii.xl, padding: 20, gap: 6, minHeight: 200 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { flex: 1, color: '#ffffffcc', fontFamily: typography.fontFamilyBold, fontSize: 14 },
  holder: { marginTop: 14, color: '#fff', fontFamily: typography.fontFamilyBold, fontSize: 22 },
  sub: { color: '#ffffffcc', fontFamily: typography.fontFamilyMedium, fontSize: 13.5 },
  code: { marginTop: 14, color: '#fff', fontFamily: typography.fontFamilyBold, fontSize: 24, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  since: { color: '#ffffffaa', fontFamily: typography.fontFamilyMedium, fontSize: 12 },
  qr: { alignSelf: 'center', padding: 14, borderRadius: radii.lg, backgroundColor: '#fff' },
  center: { textAlign: 'center', lineHeight: 19 },
  empty: { padding: 20, borderRadius: radii.xl, backgroundColor: '#fff', gap: 8 },
  emptyTitle: { fontFamily: typography.fontFamilyBold, color: colors.text, fontSize: 14 },
  name: { fontFamily: typography.fontFamilyBold, fontSize: 18, color: colors.text },
});
