import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shadows, text, typography } from '@/src/design-system/tokens';
import { MessageMeta } from '@/src/features/chat/MessageParts';
import type { PixData } from '@/src/shared/api/conversation-actions.api';
import { formatPixKey, pixKeyTypeLabel } from './logic';

/** Chave Pix enviada na conversa: um "comprovante" com a chave em destaque, como o cliente recebe. */
export function PixCard({ pix, at, mine, status }: { pix: PixData; at?: string; mine?: boolean; status?: 'sent' | 'delivered' | 'read' }) {
  const { t } = useTranslation('inbox');
  return (
    <View style={[styles.card, mine ? { borderBottomRightRadius: 8 } : { borderBottomLeftRadius: 8 }]} accessible accessibilityLabel={t('pix.card.a11y', { type: pixKeyTypeLabel(pix.key_type), key: pix.key, holder: pix.holder_name })}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Ionicons name="diamond" size={13} color="#fff" />
        </View>
        <Text style={styles.headText}>{t('pix.card.title')}</Text>
        <Text style={styles.type}>{pixKeyTypeLabel(pix.key_type)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.key} selectable numberOfLines={2}>{formatPixKey(pix.key_type, pix.key)}</Text>
        <Text style={styles.holder} numberOfLines={1}>{pix.holder_name}</Text>
        <View style={styles.foot}>
          <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
          <Text style={styles.hint}>{t('pix.card.hint')}</Text>
          {at ? <View style={{ marginLeft: 'auto' }}><MessageMeta at={at} mine={!!mine} status={status} tone="onBubbleTheirs" /></View> : null}
        </View>
      </View>
    </View>
  );
}

const TEAL = '#0f766e';

const styles = StyleSheet.create({
  card: { width: 264, borderRadius: 20, backgroundColor: '#fff', overflow: 'hidden', ...shadows.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#dcf6f1' },
  badge: { width: 22, height: 22, borderRadius: 7, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  headText: { ...text.captionStrong, color: TEAL },
  type: { ...text.label, color: TEAL, marginLeft: 'auto', opacity: 0.8 },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  key: { fontFamily: typography.fontFamilySemiBold, fontSize: 16.5, lineHeight: 22, color: colors.text, fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  holder: { ...text.caption, color: colors.textSoft, marginTop: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  hint: { ...text.label, color: colors.textMuted, fontFamily: typography.fontFamilyMedium },
});
