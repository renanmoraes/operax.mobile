import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Badge, Card, HeroCard, IconTile, Muted, Rise, Screen, ScreenHeader } from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, typography } from '@/src/design-system/tokens';
import { useChats, useCompanies } from '@/src/features/client/useClientData';
import type { ChatMessage } from '@/src/features/client/types';
import { formatHour, sameDay, timeAgo } from '@/src/shared/format';
import { clientDataMode } from '@/src/features/client/dataMode';

function preview(m: ChatMessage, t: TFunction<'client'>): { chip?: string; text: string } {
  const who = m.from === 'me' ? t('chats.you') : '';
  if (m.attachment?.kind === 'video') return { chip: t('chats.video'), text: m.attachment.title ?? m.text ?? t('chats.video') };
  if (m.attachment?.kind === 'image') return { chip: t('chats.photo'), text: `${who}${m.text || t('chats.photo')}` };
  if (m.attachment?.kind === 'document') return { chip: 'PDF', text: m.attachment.name };
  if (m.reschedule) return { chip: t('chats.slot'), text: `${who}${m.reschedule.title}` };
  return { text: `${who}${m.text}` };
}

export default function ClientConversationsScreen() {
  const { t } = useTranslation('client');
  const insets = useSafeAreaInsets();
  const { data: chats } = useChats();
  const { data: companies } = useCompanies();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }}>
        <ScreenHeader title={t('chats.title')} />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Rise>
            <HeroCard style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <IconTile icon="shield-checkmark-outline" size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>{t('chats.directTitle')}</Text>
                  <Muted style={{ marginTop: 3, lineHeight: 19, color: colors.textSoft }}>{clientDataMode() === 'live' ? t('chats.directBodyLive') : t('chats.directBodyDemo')}</Muted>
                </View>
              </View>
            </HeroCard>
          </Rise>
          {chats?.map((c, i) => {
            const last = c.messages[c.messages.length - 1];
            const p = last ? preview(last, t) : { text: t('chats.startConversation') };
            const company = companies?.find((x) => x.slug === c.tenant_slug);
            const lastDate = last ? new Date(last.at) : null;
            return (
              <Rise key={c.tenant_slug} index={i + 1}>
                <Card onPress={() => router.push(`/cliente/chat/${c.tenant_slug}`)} accessibilityLabel={c.unread ? t('chats.a11yUnread', { name: c.tenant_name, count: c.unread }) : t('chats.a11y', { name: c.tenant_name })} style={styles.row}>
                  <IconTile initials={company?.initials} size={52} tone={i === 0 ? 'brand' : i === 1 ? 'soft' : 'neutral'} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.name} numberOfLines={1}>{c.tenant_name}</Text>
                      {lastDate ? (
                        <Text style={[styles.time, c.unread ? { color: colors.primary, fontFamily: typography.fontFamilySemiBold } : null]}>
                          {sameDay(lastDate, new Date()) ? formatHour(last!.at) : timeAgo(last!.at)}
                        </Text>
                      ) : null}
                    </View>
                    <Muted style={{ marginTop: 2 }}>{c.team_label}</Muted>
                    <View style={styles.previewRow}>
                      {p.chip ? <Badge label={p.chip} tone={c.unread ? 'primary' : 'neutral'} /> : null}
                      <Text style={[styles.previewText, c.unread ? { fontFamily: typography.fontFamilySemiBold, color: colors.text } : null]} numberOfLines={1}>
                        {p.text}
                      </Text>
                      {c.unread ? <Badge label={String(c.unread)} tone="solid" /> : last?.from === 'me' ? <Ionicons name="checkmark-done" size={16} color={last.status === 'read' ? colors.primary : '#8c99b0'} /> : null}
                    </View>
                  </View>
                </Card>
              </Rise>
            );
          })}
          <Muted style={{ textAlign: 'center', marginTop: 4, lineHeight: 19 }}>{t('chats.whatsapp')}</Muted>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', gap: 14, padding: 16 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 15.5, color: colors.text },
  time: { fontFamily: typography.fontFamily, fontSize: 12, color: colors.textMuted },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  previewText: { flex: 1, minWidth: 0, fontFamily: typography.fontFamily, fontSize: 13.5, color: colors.textSoft },
});
