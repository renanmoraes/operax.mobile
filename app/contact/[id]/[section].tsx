import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, EmptyState, Loading, Screen, ScreenHeader } from '@/src/design-system/ui';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';
import { RequirePermission } from '@/src/features/auth/useCan';
import { isSectionId, type SectionId } from '@/src/features/contact/sections';
import { useContactAccess } from '@/src/features/contact/useContactAccess';
import { BookingsSection } from '@/src/features/contact/sections/BookingsSection';
import { ConversationsSection } from '@/src/features/contact/sections/ConversationsSection';
import { CrediarioSection } from '@/src/features/contact/sections/CrediarioSection';
import { DependentsSection } from '@/src/features/contact/sections/DependentsSection';
import { DocumentsSection } from '@/src/features/contact/sections/DocumentsSection';
import { InterestsSection } from '@/src/features/contact/sections/InterestsSection';
import { NotesSection } from '@/src/features/contact/sections/NotesSection';
import { ProfileSection } from '@/src/features/contact/sections/ProfileSection';
import { TagHistorySection } from '@/src/features/contact/sections/TagHistorySection';

export default function ContactSectionGuarded() {
  const { t } = useTranslation('contact');
  return (
    <RequirePermission need="contacts" title={t('title')}>
      <ContactSection />
    </RequirePermission>
  );
}

function Body({ id, section }: { id: string; section: SectionId }) {
  switch (section) {
    case 'profile': return <ProfileSection contactId={id} />;
    case 'conversations': return <ConversationsSection contactId={id} />;
    case 'notes': return <NotesSection contactId={id} />;
    case 'agendamentos': return <BookingsSection contactId={id} />;
    case 'crediario': return <CrediarioSection contactId={id} />;
    case 'dependents': return <DependentsSection contactId={id} />;
    case 'documents': return <DocumentsSection contactId={id} />;
    case 'interests': return <InterestsSection contactId={id} />;
    case 'tag_history': return <TagHistorySection contactId={id} />;
  }
}

/**
 * Uma parte da ficha do contato. A faixa de etiquetas no topo leva a qualquer outra parte sem voltar
 * à tela inicial do contato (só aparecem as que a pessoa pode abrir).
 */
function ContactSection() {
  const { t } = useTranslation('contact');
  const { id, section } = useLocalSearchParams<{ id: string; section: string }>();
  const insets = useSafeAreaInsets();
  const access = useContactAccess();
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/contact/[id]', params: { id } }));
  const header = <ScreenHeader safe title={isSectionId(section) ? t(`section.${section}`) : t('title')} onBack={back} />;

  if (access.loading) {
    return <Screen>{header}<Loading /></Screen>;
  }
  if (!isSectionId(section) || !access.can(section)) {
    return <Screen>{header}<EmptyState icon="lock-closed-outline" title={t('notFound')} subtitle={t('notFoundHint')} actionLabel={t('retry')} onAction={back} /></Screen>;
  }

  return (
    <Screen>
      {header}
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
        {access.sections.length > 1 ? (
          <View accessibilityLabel={t('switcher')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {access.sections.map((s) => (
                <Chip key={s.id} label={t(`section.${s.id}`)} selected={s.id === section} onPress={() => s.id !== section && router.replace({ pathname: '/contact/[id]/[section]', params: { id, section: s.id } })} />
              ))}
            </ScrollView>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Body id={id} section={section} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
});
