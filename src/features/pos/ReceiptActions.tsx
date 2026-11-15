import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Field, PressableScale, Segmented } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { apiMessage, apiStatus, type PosContact, type ReceiptChannel } from '@/src/shared/api/pos.api';
import type { PosClient } from './posClient';
import { shareReceiptPdf } from './shareReceipt';
import { emailValid, maskPhone, phoneForServer } from './signup';

type T = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Os dois caminhos do comprovante: o PDF, que o operador manda por onde quiser, e o envio pelo
 * WhatsApp ou e-mail da empresa (fica registrado na conversa do cliente).
 */
export function ReceiptActions({ client, saleId, contact, onMessage }: { client: PosClient; saleId: string; contact: PosContact | null; onMessage: (text: string, tone: 'success' | 'error') => void }) {
  const { t } = useTranslation('pos');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [channel, setChannel] = useState<ReceiptChannel>(contact?.phone || !contact?.email ? 'whatsapp' : 'email');
  const [to, setTo] = useState(() => ({ whatsapp: contact?.phone ? maskPhone(contact.phone) : '', email: contact?.email ?? '' }));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdf = async () => {
    setPdfBusy(true);
    try {
      const r = await client.receipt(saleId);
      await shareReceiptPdf(r, t as unknown as T);
    } catch {
      onMessage(t('done.pdfFailed'), 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const target = channel === 'whatsapp' ? phoneForServer(to.whatsapp) : emailValid(to.email) ? to.email.trim() : null;
  const send = async () => {
    if (!target) return;
    setSending(true);
    setError(null);
    try {
      const r = await client.sendReceipt(saleId, { channel, to: target });
      const shown = channel === 'whatsapp' ? maskPhone(r.to || target) : r.to || target;
      onMessage(r.via === 'template' ? t('done.sentTemplate', { to: shown }) : t('done.sent', { to: shown }), 'success');
    } catch (e) {
      const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
      setError(code === 'template_required' || apiStatus(e) === 422 ? t('done.noTemplate') : (apiMessage(e) ?? t('done.sendFailed')));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <PressableScale onPress={() => void pdf()} disabled={pdfBusy} accessibilityRole="button" style={styles.pdf}>
        <View style={styles.pdfIcon}>
          <Ionicons name="document-text" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pdfTitle}>{t('done.pdf')}</Text>
          <Text style={styles.pdfHint}>{t('done.pdfHint')}</Text>
        </View>
        <Ionicons name={pdfBusy ? 'hourglass-outline' : 'share-outline'} size={20} color={colors.textMuted} />
      </PressableScale>

      <View style={styles.company}>
        <Text style={styles.label}>{t('done.company')}</Text>
        <Segmented
          value={channel}
          onChange={(v) => {
            setChannel(v as ReceiptChannel);
            setError(null);
          }}
          options={[
            { key: 'whatsapp', label: t('done.whatsapp') },
            { key: 'email', label: t('done.email') },
          ]}
        />
        {channel === 'whatsapp' ? (
          <Field label={t('done.toPhone')} value={to.whatsapp} onChangeText={(v) => setTo((s) => ({ ...s, whatsapp: maskPhone(v) }))} keyboardType="phone-pad" placeholder="(11) 98765-4321" />
        ) : (
          <Field label={t('done.toEmail')} value={to.email} onChangeText={(v) => setTo((s) => ({ ...s, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={sending ? t('done.sending') : t('done.send')} icon="paper-plane-outline" variant="secondary" loading={sending} disabled={!target} onPress={() => void send()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pdf: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.primaryWash },
  pdfIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pdfTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text },
  pdfHint: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  company: { padding: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, gap: 12 },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  error: { fontFamily: typography.fontFamilyMedium, fontSize: 13, lineHeight: 18, color: colors.dangerText },
});
