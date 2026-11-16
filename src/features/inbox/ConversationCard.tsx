import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Card, Muted } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import type { Conversation } from '@/src/mocks/data';
import { ChannelChip, isMarketplaceChannel, useInboxConnections } from '@/src/features/attendance/channels';

const channelLabel: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', app: 'App' };

export function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function ConversationCard({ item, onPress }: { item: Conversation; onPress: () => void }) {
  const { t } = useTranslation('inbox');
  const urgent = item.urgency === 'critical' || item.urgency === 'high';
  const channel = channelLabel[item.channel] ?? t('card.channelOther');
  const isApp = item.channel === ('app' as Conversation['channel']);
  const { multi, byId, idOf } = useInboxConnections();
  const connId = idOf(item);
  const connection = connId ? byId.get(connId) ?? null : null;
  return (
    <Card onPress={onPress} accessibilityLabel={item.unread ? t('card.a11yUnread', { name: item.contactName, count: item.unread, message: item.lastMessage }) : t('card.a11y', { name: item.contactName, message: item.lastMessage })} style={styles.card}>
      <Avatar initials={initialsOf(item.contactName)} size={48} tone={isApp ? 'brand' : 'soft'} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>{item.contactName}</Text>
          {/* Empresa com vários números: o selo diz por qual número/canal a conversa chegou, na cor do número. */}
          {/* Marketplace: o selo diz qual (Mercado Livre, Shopee...) mesmo com um número só. */}
          {isMarketplaceChannel(item.channel) ? (
            <ChannelChip channel={item.channel} size="xs" />
          ) : multi && !isApp ? (
            <ChannelChip connection={connection} channel={item.channel} size="xs" />
          ) : (
            <Badge label={channel} tone={isApp ? 'primary' : item.channel === 'whatsapp' ? 'success' : 'neutral'} />
          )}
          <Text style={[styles.time, item.unread ? { color: colors.primary, fontFamily: typography.fontFamilySemiBold } : null]}>{item.updatedAt}</Text>
        </View>
        <View style={styles.bottom}>
          <Text style={[styles.last, item.unread ? { color: colors.text, fontFamily: typography.fontFamilySemiBold } : null]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unread ? <Badge label={String(item.unread)} tone="solid" /> : null}
        </View>
        <View style={styles.meta}>
          <Muted style={{ fontSize: 12 }} numberOfLines={1}>{item.queue}</Muted>
          {urgent ? <Badge label={t('card.attention')} tone="warn" /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  time: { marginLeft: 'auto', fontFamily: typography.fontFamily, fontSize: 12, color: colors.textMuted },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  last: { flex: 1, minWidth: 0, fontFamily: typography.fontFamily, fontSize: 13.5, color: colors.textSoft },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
});
