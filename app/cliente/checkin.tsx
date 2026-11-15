import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Vibration } from 'react-native';
import { apiMessage } from '@/src/shared/api/pos.api';
import { ScannerModal, type ScanFeedback } from '@/src/features/pos/ScannerModal';
import { useEventCheckin } from '@/src/features/fitness/achievements';

/**
 * Check-in em evento: o aluno aponta a câmera para o QR que a academia mostra na entrada. O backend confere a
 * inscrição e entrega a conquista do evento, quando ele tem uma. A câmera fecha sozinha depois do check-in.
 */
export default function EventCheckinScreen() {
  const { t } = useTranslation('fitness');
  const checkin = useEventCheckin();
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const busy = useRef(false);

  const onCode = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await checkin.mutateAsync(code);
      Vibration.vibrate(40);
      const head = r.first ? t('ach.checkinDone', { event: r.event.name }) : t('ach.checkinAgain', { event: r.event.name });
      setFeedback({ tone: 'ok', text: r.achievement?.created ? `${head} ${t('ach.checkinWon', { name: r.achievement.name })}` : head });
      setTimeout(() => router.back(), 2200);
    } catch (e) {
      setFeedback({ tone: 'error', text: apiMessage(e) ?? t('ach.checkinFail') });
      busy.current = false;
    }
  };

  return <ScannerModal visible qrOnly title={t('ach.scanTitle')} hint={t('ach.scanHint')} onClose={() => router.back()} onCode={(c) => void onCode(c)} feedback={feedback} count={0} />;
}
