import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, HeroCard, IconTile, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';

/** Assinatura da agenda no calendário do celular (GET me/calendar-link no portal). */
export default function CalendarSubscribeScreen() {
  const { t } = useTranslation('client');
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);

  // Os links pessoais (google_url / webcal_url) vêm de GET me/calendar-link, que depende do login mobile de cliente.
  const open = (_kind: 'google' | 'webcal') => {
    setNote(t('calendarSubscribe.note'));
  };

  return (
    <Screen>
      <TopBar safe title={t('calendarSubscribe.header')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <Rise>
          <HeroCard>
            <IconTile icon="calendar-number-outline" size={52} />
            <Text style={styles.title}>{t('calendarSubscribe.title')}</Text>
            <Muted style={{ marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.textSoft }}>
              {t('calendarSubscribe.body')}
            </Muted>
          </HeroCard>
        </Rise>
        <Rise index={1}>
          <Card style={{ gap: 12 }}>
            <Button label={t('calendarSubscribe.google')} icon="logo-google" onPress={() => open('google')} />
            <Button label={t('calendarSubscribe.webcal')} icon="calendar-outline" variant="soft" onPress={() => open('webcal')} />
            {note ? <Body style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>{note}</Body> : null}
          </Card>
        </Rise>
        <Rise index={2}>
          <Muted style={{ textAlign: 'center', lineHeight: 19 }}>{t('calendarSubscribe.personal')}</Muted>
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 14, ...text.title, color: colors.text },
});
