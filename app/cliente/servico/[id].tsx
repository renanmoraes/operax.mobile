import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, typography } from '@/src/design-system/tokens';
import { Badge, Body, Button, Card, Muted } from '@/src/design-system/ui';
import { PortalPage, errorText } from '@/src/features/portal/PortalPage';
import { QUOTE_TONE, centsToMoney, orderStatus, shortDate } from '@/src/features/portal/format';
import { downloadServiceOrderPdf } from '@/src/features/portal/orderPdf';
import { usePortalScope, usePortalServiceOrder, useRefreshPortalHome } from '@/src/features/portal/usePortal';
import { portalApproveOrder, portalRespondQuote } from '@/src/shared/api/portal.api';

const STEPS = ['received', 'quote', 'approval', 'service', 'ready'] as const;

/** Um serviço: etapas, o que será feito, total e a resposta do cliente ao orçamento. */
export default function ServiceDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('portal');
  const qc = useQueryClient();
  const { tenant } = usePortalScope();
  const refreshHome = useRefreshPortalHome();
  const q = usePortalServiceOrder(id);
  const [declining, setDeclining] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const after = async (message: string) => {
    setDeclining(false);
    await Promise.all([refreshHome(), qc.invalidateQueries({ queryKey: ['portal', tenant, 'service-order', id] })]);
    await showDialog({ title: message, tone: 'success' });
  };
  const fail = (e: unknown) => showDialog({ title: errorText(e, t('common.loadFail')), tone: 'warn' });

  const respond = useMutation({
    mutationFn: (decision: 'accepted' | 'declined') => portalRespondQuote(id, { version_id: q.data!.quote!.version!.id, decision }),
    onSuccess: (_r, decision) => after(decision === 'accepted' ? t('services.quoteApproved') : t('services.quoteDeclined')),
    onError: (e) => {
      setDeclining(false);
      void fail(e);
    },
  });
  const legacy = useMutation({ mutationFn: () => portalApproveOrder(id), onSuccess: () => after(t('services.serviceApproved')), onError: (e) => void fail(e) });

  const openPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadServiceOrderPdf(id, q.data?.order.display_code);
    } catch {
      await showDialog({ title: t('services.pdfFail'), tone: 'warn' });
    } finally {
      setPdfBusy(false);
    }
  };

  const data = q.data;
  const order = data?.order;
  const quote = data?.quote;
  const version = quote?.version;
  const status = order ? orderStatus(order) : null;

  return (
    <PortalPage title={order?.display_code ?? t('services.title')} loading={q.isLoading} error={q.isError || (!q.isLoading && !data) ? errorText(q.error, t('services.notFound')) : null} onRetry={() => void q.refetch()}>
      {order && status ? (
        <>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row' }}><Badge label={status.label} tone={status.tone} /></View>
            <Text style={styles.title}>{order.title}</Text>
            {quote?.order.vehicle ? <Muted>{quote.order.vehicle}</Muted> : null}
          </View>

          {status.step > 0 ? (
            <Card style={{ gap: 8 }} accessibilityLabel={t('services.stepsLabel')}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {STEPS.map((s, i) => (
                  <View key={s} style={[styles.bar, { backgroundColor: i < status.step ? colors.primary : colors.track }]} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
                {STEPS.map((s) => (
                  <Text key={s} style={styles.step} numberOfLines={1}>{t(`services.steps.${s}`)}</Text>
                ))}
              </View>
            </Card>
          ) : null}

          {version ? (
            <Card style={{ gap: 4 }}>
              <View style={styles.between}>
                <Text style={styles.eyebrow}>{t('services.whatWillBeDone')}</Text>
                {quote ? <Badge label={t(`services.quote.${quote.state}`)} tone={QUOTE_TONE[quote.state]} /> : null}
              </View>
              {version.items.map((it, i) => (
                <View key={i} style={[styles.between, styles.item]}>
                  <Body style={{ flex: 1 }}>
                    {it.description}
                    {it.quantity !== 1 ? <Text style={{ color: colors.textMuted }}>{` · ${it.quantity}${it.unit ? ` ${it.unit}` : ''}`}</Text> : null}
                  </Body>
                  <Text style={styles.itemValue}>{centsToMoney(it.total_cents)}</Text>
                </View>
              ))}
              <View style={[styles.between, { marginTop: 8 }]}>
                <Text style={styles.itemValue}>{t('services.total')}</Text>
                <Text style={styles.total}>{centsToMoney(version.total_cents)}</Text>
              </View>
            </Card>
          ) : (
            <Card><Body>{t('services.noQuote')}</Body></Card>
          )}

          {quote?.can_respond && version ? (
            <View style={{ gap: 10 }}>
              <Button label={t('services.approveQuote')} icon="checkmark" loading={respond.isPending && respond.variables === 'accepted'} onPress={() => respond.mutate('accepted')} />
              <Button label={t('services.decline')} variant="ghost" onPress={() => setDeclining(true)} />
              <Muted style={styles.note}>{t('services.registered')}</Muted>
            </View>
          ) : null}
          {quote?.state === 'revising' ? <Card><Body>{t('services.revising')}</Body></Card> : null}
          {version?.responded_at ? <Muted>{t('services.respondedOn', { date: shortDate(version.responded_at) })}</Muted> : null}
          {order.can_approve ? (
            <View style={{ gap: 10 }}>
              <Button label={t('services.approveService')} icon="checkmark" loading={legacy.isPending} onPress={() => legacy.mutate()} />
              <Muted style={styles.note}>{t('services.registeredApprove')}</Muted>
            </View>
          ) : null}
          {version ? <Button label={t('services.pdf')} icon="document-text-outline" variant="soft" loading={pdfBusy} onPress={() => void openPdf()} /> : null}
        </>
      ) : null}

      <BottomSheet visible={declining} onClose={() => setDeclining(false)} title={t('services.declineTitle')}>
        <Muted style={{ marginBottom: 8 }}>{t('services.declineBody')}</Muted>
        <View style={{ gap: 10, paddingBottom: 14, paddingHorizontal: 2 }}>
          <Button label={t('services.declineYes')} variant="danger" loading={respond.isPending && respond.variables === 'declined'} onPress={() => respond.mutate('declined')} />
          <Button label={t('common.back')} variant="secondary" onPress={() => setDeclining(false)} />
        </View>
      </BottomSheet>
    </PortalPage>
  );
}


const styles = StyleSheet.create({
  title: { fontFamily: typography.fontFamilyBold, fontSize: 24, lineHeight: 29, color: colors.text },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  step: { flex: 1, textAlign: 'center', fontSize: 10.5, color: colors.textMuted, fontFamily: typography.fontFamilySemiBold },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: { fontFamily: typography.fontFamilyBold, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textSoft },
  item: { minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.track },
  itemValue: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  total: { fontFamily: typography.fontFamilyBold, fontSize: 24, color: colors.text, fontVariant: ['tabular-nums'] },
  note: { textAlign: 'center', fontSize: 12.5, lineHeight: 18 },
});
