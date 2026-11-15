import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, Rise, Screen, SettingsGroup, SettingsRow, TopBar } from '@/src/design-system/ui';
import { locale } from '@/src/i18n';
import { useAuth } from '@/src/features/auth/AuthContext';
import { ScannerModal, type ScanFeedback } from '@/src/features/pos/ScannerModal';
import { api } from '@/src/shared/api/client';
import { apiMessage } from '@/src/shared/api/pos.api';

type EventRow = { id: string; name: string; starts_at: string | null };
type CheckinResult = { first: boolean; name: string | null; achievement: { name: string; created: boolean } | null };

/**
 * Check-in de evento pela equipe: escolhe o evento e lê, um atrás do outro, os ingressos que os alunos mostram no app.
 * Cada leitura confere a inscrição no backend e entrega a conquista do evento, quando ele tem uma.
 */
export default function StaffEventCheckinScreen() {
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const live = mode === 'live';
  const events = useQuery({
    queryKey: ['staff', 'events', 'active'],
    queryFn: async (): Promise<EventRow[]> => {
      if (!live) return [{ id: 'demo', name: 'Corrida da Academia', starts_at: new Date(Date.now() + 3_600_000).toISOString() }];
      const { data } = await api.get<{ data: EventRow[] }>('/api/apps/events', { params: { status: 'active', limit: 50 } });
      return data.data ?? [];
    },
  });
  const [event, setEvent] = useState<EventRow | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);

  const onCode = async (code: string) => {
    if (!event || busy.current) return;
    busy.current = true;
    try {
      const r: CheckinResult = live
        ? (await api.post<CheckinResult>(`/api/apps/events/${event.id}/checkin`, { ticket: code })).data
        : { first: true, name: t('eventCheckin.someone'), achievement: { name: 'Corrida da Academia', created: true } };
      Vibration.vibrate(40);
      const name = r.name ?? t('eventCheckin.someone');
      const head = r.first ? t('eventCheckin.done', { name }) : t('eventCheckin.again', { name });
      setFeedback({ tone: r.first ? 'ok' : 'warn', text: r.achievement?.created ? `${head} ${t('eventCheckin.won', { achievement: r.achievement.name })}` : head });
      if (r.first) setCount((n) => n + 1);
    } catch (e) {
      setFeedback({ tone: 'error', text: apiMessage(e) ?? t('eventCheckin.fail') });
    } finally {
      busy.current = false;
    }
  };

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale(), { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined);
  return (
    <Screen>
      <TopBar safe title={t('eventCheckin.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        {events.isLoading ? null : !events.data?.length ? (
          <EmptyState icon="calendar-outline" title={t('eventCheckin.empty')} />
        ) : (
          <Rise>
            <SettingsGroup>
              {events.data.map((e, i) => (
                <SettingsRow key={e.id} icon="qr-code-outline" title={e.name} subtitle={when(e.starts_at) ?? t('eventCheckin.scan')} onPress={() => { setFeedback(null); setCount(0); setEvent(e); }} last={i === events.data!.length - 1} />
              ))}
            </SettingsGroup>
          </Rise>
        )}
      </ScrollView>
      <ScannerModal visible={!!event} qrOnly title={event?.name ?? t('eventCheckin.title')} hint={t('eventCheckin.scanHint')} onClose={() => setEvent(null)} onCode={(c) => void onCode(c)} feedback={feedback} count={count} />
    </Screen>
  );
}
