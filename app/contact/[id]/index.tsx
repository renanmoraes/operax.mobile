import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionRow, Avatar, Badge, EmptyState, HeroCard, Loading, Muted, Rise, Screen, ScreenHeader, SectionHeader, SettingsGroup, SettingsRow, type ActionItem } from '@/src/design-system/ui';
import { colors, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { getContact as getMockContact } from '@/src/mocks/data';
import { getContact } from '@/src/shared/api/contacts.api';
import { listConversations } from '@/src/shared/api/conversations.api';
import { fetchContactReceivables, isActive, isOverdue } from '@/src/shared/api/receivables.api';
import { brl } from '@/src/features/contact/format';
import { GROUP_ORDER, type SectionId } from '@/src/features/contact/sections';
import { useContactAccess } from '@/src/features/contact/useContactAccess';

export default function ContactScreenGuarded() {
  const { t } = useTranslation('contact');
  return (
    <RequirePermission need="contacts" title={t('title')}>
      <ContactScreen />
    </RequirePermission>
  );
}

function ContactScreen() {
  const { t } = useTranslation('contact');
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const can = useCan();
  const live = mode === 'live';
  const access = useContactAccess();

  const query = useQuery({ queryKey: ['contact', id], enabled: live && !!id, queryFn: () => getContact(id) });
  const mock = !live ? getMockContact(id) : null;
  const contact = live ? query.data : mock;

  const canChat = live && can(['conversations:read_own', 'conversations:read_all']);
  const convQ = useQuery({
    queryKey: ['contact', id, 'conversations'],
    enabled: canChat && !!id,
    queryFn: () => listConversations({ contact_id: id, limit: 30, sort_by: 'recent' }),
  });
  const chats = convQ.data?.data ?? [];
  const chatId = (chats.find((c) => c.status !== 'closed') ?? chats[0])?.id ?? null;

  const debtQ = useQuery({
    queryKey: ['pos', 'receivables', 'contact', id],
    enabled: live && access.can('crediario') && !!id,
    staleTime: 30_000,
    queryFn: () => fetchContactReceivables(id),
  });

  const header = <ScreenHeader safe title={t('title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;

  if (!contact) {
    return (
      <Screen>
        {header}
        {query.isLoading ? <Loading /> : <EmptyState icon="person-outline" title={t('notFound')} subtitle={t('notFoundHint')} actionLabel={query.isError ? t('retry') : undefined} onAction={query.isError ? () => void query.refetch() : undefined} />}
      </Screen>
    );
  }

  const c = contact as {
    name?: string | null; phone_e164?: string | null; phone?: string; email?: string | null; lead_score?: number | null;
    tags?: (string | { tag?: string; name?: string })[]; lifecycle_stage?: string | null; is_blocked?: boolean; blocked_reason?: string | null;
  };
  const name = c.name || t('title');
  const phone = c.phone_e164 || c.phone || '';
  const tags = (Array.isArray(c.tags) ? c.tags : []).map((tag) => (typeof tag === 'string' ? tag : tag.tag || tag.name || '')).filter(Boolean);
  const stage = c.lifecycle_stage && ['lead', 'interested', 'qualified', 'hot', 'prospect', 'customer', 'churned'].includes(c.lifecycle_stage) ? (c.lifecycle_stage as 'lead') : null;

  const actions: ActionItem[] = [];
  if (chatId) actions.push({ icon: 'chatbubble-ellipses-outline', label: t('hub.chat'), tone: 'primary', onPress: () => router.push(`/conversation/${chatId}`) });
  if (phone) actions.push({ icon: 'call-outline', label: t('hub.call'), onPress: () => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`) });
  if (c.email) actions.push({ icon: 'mail-outline', label: t('hub.email'), onPress: () => void Linking.openURL(`mailto:${c.email}`) });

  const subtitleFor = (sid: SectionId): { text: string; tone?: 'warn' | 'success' } => {
    if (sid === 'crediario' && debtQ.data) {
      const open = debtQ.data.filter(isActive);
      const late = open.filter(isOverdue);
      if (!open.length) return { text: t('hub.noDebt'), tone: 'success' };
      const total = brl(open.reduce((s, p) => s + p.total_cents, 0));
      return late.length
        ? { text: `${t('hub.openDebt', { total })} · ${t('hub.overdue', { count: late.length })}`, tone: 'warn' }
        : { text: t('hub.openDebt', { total }) };
    }
    return { text: t(`sectionSub.${sid}`) };
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {header}
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Rise>
            <HeroCard>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Avatar initials={initialsOf(name)} size={76} tone="brand" />
                <Text style={styles.name} numberOfLines={2}>{name}</Text>
                {phone ? <Muted>{phone}</Muted> : null}
                <View style={styles.badges}>
                  {stage ? <Badge label={t(`profile.stages.${stage}`)} tone="primary" /> : null}
                  {c.lead_score != null ? <Badge label={t('hub.lead', { score: c.lead_score })} tone="success" icon="trending-up" /> : null}
                  {tags.slice(0, 4).map((tag) => <Badge key={tag} label={tag} />)}
                  {tags.length > 4 ? <Badge label={`+${tags.length - 4}`} /> : null}
                </View>
                {c.is_blocked ? (
                  <View style={styles.blocked} accessibilityRole="alert">
                    <Text style={styles.blockedTitle}>{t('hub.blocked')}</Text>
                    {c.blocked_reason ? <Text style={styles.blockedBody}>{t('hub.blockedReason', { reason: c.blocked_reason })}</Text> : null}
                  </View>
                ) : null}
              </View>
            </HeroCard>
          </Rise>

          {actions.length ? <Rise index={1}><ActionRow items={actions} /></Rise> : null}

          {GROUP_ORDER.map((group, gi) => {
            const rows = access.sections.filter((s) => s.group === group);
            if (!rows.length) return null;
            return (
              <Rise key={group} index={2 + gi}>
                <SectionHeader title={t(`groups.${group}`)} />
                <SettingsGroup>
                  {rows.map((s, i) => {
                    const sub = subtitleFor(s.id);
                    return (
                      <SettingsRow
                        key={s.id}
                        icon={s.icon}
                        title={t(`section.${s.id}`)}
                        subtitle={sub.text}
                        subtitleTone={sub.tone}
                        last={i === rows.length - 1}
                        onPress={() => router.push({ pathname: '/contact/[id]/[section]', params: { id, section: s.id } })}
                      />
                    );
                  })}
                </SettingsGroup>
              </Rise>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...text.title, color: colors.text, textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  blocked: { alignSelf: 'stretch', backgroundColor: colors.dangerSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  blockedTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.dangerText },
  blockedBody: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.dangerText },
});
