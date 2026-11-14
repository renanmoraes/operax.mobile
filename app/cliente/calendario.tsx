import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, HeroCard, IconTile, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';

/** Assinatura da agenda no calendário do celular (GET me/calendar-link no portal). */
export default function CalendarSubscribeScreen() {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);

  // Os links pessoais (google_url / webcal_url) vêm de GET me/calendar-link, que depende do login mobile de cliente.
  const open = (_kind: 'google' | 'webcal') => {
    setNote('O link pessoal de assinatura chega quando a agenda estiver ligada à sua conta. Por enquanto os horários são de exemplo.');
  };

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <TopBar title="Agenda no celular" onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <Rise>
          <HeroCard>
            <IconTile icon="calendar-number-outline" size={52} />
            <Text style={styles.title}>Assine uma vez, receba sempre</Text>
            <Muted style={{ marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.textSoft }}>
              Seus horários de todas as empresas entram no calendário do celular e se atualizam sozinhos quando algo muda.
            </Muted>
          </HeroCard>
        </Rise>
        <Rise index={1}>
          <Card style={{ gap: 12 }}>
            <Button label="Google Agenda" icon="logo-google" onPress={() => open('google')} />
            <Button label="Calendário do iPhone ou Outlook" icon="calendar-outline" variant="soft" onPress={() => open('webcal')} />
            {note ? <Body style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>{note}</Body> : null}
          </Card>
        </Rise>
        <Rise index={2}>
          <Muted style={{ textAlign: 'center', lineHeight: 19 }}>O link é pessoal. Se trocar de celular, é só assinar de novo.</Muted>
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 14, fontFamily: typography.fontFamilyHeavy, fontSize: 22, letterSpacing: -0.5, color: colors.text },
});
