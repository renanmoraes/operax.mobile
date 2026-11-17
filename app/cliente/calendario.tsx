import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, HeroCard, IconTile, Muted, Rise, Screen, TopBar } from '@/src/design-system/ui';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, text } from '@/src/design-system/tokens';
import { portalCalendarLink } from '@/src/shared/api/portal.api';

/** Assinatura da agenda no calendário do celular: o endereço pessoal vem de GET me/calendar-link no portal. */
export default function CalendarSubscribeScreen() {
  const { t } = useTranslation('client');
  const insets = useSafeAreaInsets();
  // Sem guardar entre telas: o endereço é um segredo da sessão e some junto com ela.
  const { data: link, isError: failed, refetch } = useQuery({ queryKey: ['client', 'calendar-link'], queryFn: portalCalendarLink, gcTime: 0, staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const load = () => void refetch();

  const fail = () => showDialog({ title: t('calendarSubscribe.failTitle'), message: t('calendarSubscribe.failBody'), tone: 'warn' });

  const openGoogle = async () => {
    if (!link) return;
    setBusy(true);
    try {
      await Linking.openURL(link.google_url);
    } catch {
      await fail();
    } finally {
      setBusy(false);
    }
  };

  // iPhone/Mac reconhecem webcal://; no Android não há app que abra, então o caminho é copiar o endereço para o app de calendário.
  const second = async () => {
    if (!link) return;
    if (Platform.OS === 'ios') {
      try {
        await Linking.openURL(link.webcal_url);
      } catch {
        await fail();
      }
      return;
    }
    await Clipboard.setStringAsync(link.https_url);
    await showDialog({ title: t('calendarSubscribe.copiedTitle'), message: t('calendarSubscribe.copiedBody'), tone: 'success' });
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
            <Button label={t('calendarSubscribe.google')} icon="logo-google" loading={busy || (!link && !failed)} disabled={!link} onPress={() => void openGoogle()} />
            <Button
              label={Platform.OS === 'ios' ? t('calendarSubscribe.apple') : t('calendarSubscribe.copy')}
              icon={Platform.OS === 'ios' ? 'calendar-outline' : 'copy-outline'}
              variant="soft"
              disabled={!link}
              onPress={() => void second()}
            />
            {failed ? (
              <>
                <Body style={{ fontSize: 13, color: colors.dangerText, lineHeight: 19 }}>{t('calendarSubscribe.loadFail')}</Body>
                <Button label={t('calendarSubscribe.retry')} variant="ghost" onPress={load} />
              </>
            ) : null}
          </Card>
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 14, ...text.title, color: colors.text },
});
