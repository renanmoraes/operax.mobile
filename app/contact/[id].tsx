import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card, HeroCard, IconTile, Loading, Muted, Rise, Screen, ScreenHeader, SettingsGroup, SettingsRow, EmptyState } from '@/src/design-system/ui';
import { colors, text, typography } from '@/src/design-system/tokens';
import { getContact } from '@/src/shared/api/contacts.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { getContact as getMockContact } from '@/src/mocks/data';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { RequirePermission } from '@/src/features/auth/useCan';

export default function ContactScreenGuarded() {
  const { t } = useTranslation('inbox');
  return (
    <RequirePermission need="contacts" title={t('contact.title')}>
      <ContactScreen />
    </RequirePermission>
  );
}

function ContactScreen() {
  const { t } = useTranslation('inbox');
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const query = useQuery({
    queryKey: ['contact', id],
    enabled: mode === 'live' && !!id,
    queryFn: () => getContact(id),
  });

  const mock = mode === 'mock' ? getMockContact(id) : null;
  const contact = mode === 'live' ? query.data : mock;

  const header = (
    <ScreenHeader safe title={t('contact.title')} onBack={() => router.back()} />
  );

  if (!contact) {
    return (
      <Screen>
        {header}
        {query.isLoading ? <Loading /> : <EmptyState icon="person-outline" title={t('contact.notFound')} subtitle={t('contact.notFoundHint')} />}
      </Screen>
    );
  }

  const tags = Array.isArray((contact as { tags?: unknown[] }).tags)
    ? (contact as { tags: (string | { tag?: string; name?: string })[] }).tags
        .map((tag) => (typeof tag === 'string' ? tag : tag.tag || tag.name || ''))
        .filter(Boolean)
    : [];
  const phone = ('phone_e164' in contact ? contact.phone_e164 : (contact as { phone?: string }).phone) || '';
  const leadScore = 'lead_score' in contact ? contact.lead_score : null;
  const notes = ('notes' in contact && contact.notes) || '';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {header}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Rise>
            <HeroCard>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Avatar initials={initialsOf(contact.name || t('contact.title'))} size={76} tone="brand" />
                <Text style={styles.name} numberOfLines={2}>{contact.name || t('contact.title')}</Text>
                {tags.length || leadScore != null ? (
                  <View style={styles.tags}>
                    {tags.map((tag) => (
                      <Badge key={tag} label={tag} tone="primary" />
                    ))}
                    {leadScore != null ? <Badge label={t('contact.lead', { score: leadScore })} tone="success" icon="trending-up" /> : null}
                  </View>
                ) : null}
              </View>
            </HeroCard>
          </Rise>

          <Rise index={1}>
            <SettingsGroup>
              <SettingsRow icon="call-outline" title={t('contact.phone')} subtitle={phone || t('contact.notInformed')} last={!contact.email} />
              {contact.email ? <SettingsRow icon="mail-outline" title={t('contact.email')} subtitle={contact.email} last /> : null}
            </SettingsGroup>
          </Rise>

          <Rise index={2}>
            <Card style={{ flexDirection: 'row', gap: 14 }}>
              <IconTile icon="document-text-outline" size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.section}>{t('contact.notes')}</Text>
                <Muted style={{ marginTop: 4, lineHeight: 19 }}>{notes || t('contact.noNotes')}</Muted>
              </View>
            </Card>
          </Rise>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...text.title, color: colors.text, textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  section: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
});
