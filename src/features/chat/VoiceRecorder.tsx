import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { IconButton } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { requestPermission } from '@/src/features/permissions/permissions';
import type { PermissionState } from '@/src/features/permissions/permissionState';
import { durationLabel } from './MessageParts';

export type RecordedAudio = { uri: string; durationS: number };

const BARS = 28;

/** Grava áudio para o chat: pede o microfone, guarda o nível para as barras e devolve arquivo + duração. */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);
  const [recording, setRecording] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!recording) return;
    // metering vem em dB (-160 a 0); sem metering (web), uma oscilação leve mostra que está gravando.
    const db = state.metering;
    const level = db == null ? 0.25 + Math.random() * 0.35 : Math.max(0.08, Math.min(1, (db + 55) / 55));
    // O nível vem do gravador (fora do React) a cada atualização dele; aqui só guardamos o histórico das barras.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLevels((prev) => [...prev.slice(-(BARS - 1)), level]);
  }, [state.durationMillis, state.metering, recording]);

  const start = useCallback(async (): Promise<PermissionState> => {
    const permission = await requestPermission('microphone', { registerPush: false });
    if (permission !== 'granted') return permission;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setLevels([]);
    setRecording(true);
    return 'granted';
  }, [recorder]);

  const finish = useCallback(
    async (keep: boolean): Promise<RecordedAudio | null> => {
      if (!recording) return null;
      const ms = state.durationMillis || Date.now() - startedAt.current;
      try {
        await recorder.stop();
      } finally {
        setRecording(false);
        void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      }
      const uri = recorder.uri;
      if (!keep || !uri || ms < 700) return null;
      return { uri, durationS: Math.max(1, Math.round(ms / 1000)) };
    },
    [recorder, recording, state.durationMillis],
  );

  return {
    recording,
    elapsedS: Math.floor((state.durationMillis || 0) / 1000),
    levels,
    start,
    stop: () => finish(true),
    cancel: () => finish(false),
  };
}

function PulseDot() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** Barra que substitui o campo de mensagem enquanto grava: descartar, tempo, nível e enviar. */
export function RecordingBar({
  elapsedS,
  levels,
  onCancel,
  onSend,
  bottomInset,
}: {
  elapsedS: number;
  levels: number[];
  onCancel: () => void;
  onSend: () => void;
  bottomInset: number;
}) {
  const { t } = useTranslation('inbox');
  const padded = [...Array(Math.max(0, BARS - levels.length)).fill(0.08), ...levels];
  return (
    <View style={[styles.bar, { paddingBottom: bottomInset }]} accessibilityLiveRegion="polite">
      <IconButton icon="trash-outline" tone="soft" size={48} accessibilityLabel={t('chatUi.discardAudio')} onPress={onCancel} />
      <View style={styles.middle}>
        <PulseDot />
        <Text style={styles.timer} accessibilityLabel={t('chatUi.recording', { count: elapsedS })}>
          {durationLabel(elapsedS)}
        </Text>
        <View style={styles.levels} accessible={false}>
          {padded.map((l, i) => (
            <View key={i} style={[styles.level, { height: 4 + l * 22 }]} />
          ))}
        </View>
      </View>
      <IconButton icon="send" tone="primary" size={48} accessibilityLabel={t('chatUi.sendAudio')} onPress={onSend} />
    </View>
  );
}

export function MicButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { t } = useTranslation('inbox');
  return <IconButton icon="mic" tone="primary" size={44} accessibilityLabel={t('chatUi.recordAudio')} onPress={disabled ? () => undefined : onPress} />;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  middle: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.pageBg, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  timer: { ...text.calloutStrong, color: colors.text, fontVariant: ['tabular-nums'], minWidth: 34 },
  levels: { flex: 1, height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, overflow: 'hidden' },
  level: { width: 3, borderRadius: 2, backgroundColor: colors.primary },
});

