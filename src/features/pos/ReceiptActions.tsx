import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Field, PressableScale } from '@/src/design-system/ui';
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
  const [panel, setPanel] = useState(false);
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

  // Tocar de novo no que já está aberto fecha; tocar no outro troca.
  const open = (c: ReceiptChannel) => {
    setError(null);
    if (panel && channel === c) {
      setPanel(false);
      return;
    }
    setChannel(c);
    setPanel(true);
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Três caminhos do comprovante, do mesmo tamanho: PDF (o operador manda por onde quiser) e WhatsApp ou e-mail,
          que saem sempre em nome da empresa. */}
      <View style={styles.tiles}>
        <Tile icon="document-text" tone="primary" title={t('done.tilePdf')} sub={t('done.tilePdfSub')} busy={pdfBusy} onPress={() => void pdf()} />
        <Tile icon="logo-whatsapp" tone="whatsapp" title={t('done.tileWhatsapp')} sub={t('done.tileWhatsappSub')} selected={panel && channel === 'whatsapp'} onPress={() => open('whatsapp')} />
        <Tile icon="mail" tone="mail" title={t('done.tileEmail')} sub={t('done.tileEmailSub')} selected={panel && channel === 'email'} onPress={() => open('email')} />
      </View>

      {panel ? (
        <View style={styles.company}>
          {channel === 'whatsapp' ? (
            <Field label={t('done.toPhone')} value={to.whatsapp} onChangeText={(v) => setTo((s) => ({ ...s, whatsapp: maskPhone(v) }))} keyboardType="phone-pad" placeholder="(11) 98765-4321" />
          ) : (
            <Field label={t('done.toEmail')} value={to.email} onChangeText={(v) => setTo((s) => ({ ...s, email: v }))} keyboardType="email-address" autoCapitalize="none" />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={sending ? t('done.sending') : t('done.send')} icon="paper-plane-outline" loading={sending} disabled={!target} onPress={() => void send()} />
        </View>
      ) : null}
    </View>
  );
}

const TILE_TONE = { primary: { bg: colors.primaryWash, fg: colors.primary }, whatsapp: { bg: '#e7f8ee', fg: '#16a34a' }, mail: { bg: '#fff4e5', fg: '#d97706' } } as const;

/** Um caminho do comprovante: ícone grande, nome curto e a ação embaixo, para caber três lado a lado em tela pequena. */
function Tile({ icon, tone, title, sub, selected, busy, onPress }: { icon: ComponentProps<typeof Ionicons>['name']; tone: keyof typeof TILE_TONE; title: string; sub: string; selected?: boolean; busy?: boolean; onPress: () => void }) {
  const c = TILE_TONE[tone];
  return (
    <PressableScale onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={`${title}. ${sub}`} style={[styles.tile, selected && { borderColor: c.fg, backgroundColor: c.bg }]}>
      <View style={[styles.tileIcon, { backgroundColor: c.bg }]}>
        <Ionicons name={busy ? 'hourglass-outline' : icon} size={26} color={c.fg} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.tileSub} numberOfLines={2}>{sub}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 6, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardBg },
  tileIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14.5, color: colors.text },
  tileSub: { fontFamily: typography.fontFamily, fontSize: 11.5, lineHeight: 15, color: colors.textMuted, textAlign: 'center' },
  company: { padding: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, gap: 12 },
  error: { fontFamily: typography.fontFamilyMedium, fontSize: 13, lineHeight: 18, color: colors.dangerText },
});
