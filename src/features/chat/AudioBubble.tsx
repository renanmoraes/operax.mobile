import { Ionicons } from '@expo/vector-icons';
import { AudioSource, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, text } from '@/src/design-system/tokens';
import { BUBBLE_RADIUS, durationLabel, MessageMeta, MessageStatus } from './MessageParts';

const BAR_COUNT = 32;
const WAVE_WIDTH = 150;
const SPEEDS = [1, 1.5, 2] as const;

/** Alturas fixas por mensagem (mesma onda sempre que a bolha aparece). */
function waveFor(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = Math.imul(h ^ (i + 1), 2654435761);
    const r = ((h >>> 0) % 1000) / 1000;
    const shape = Math.sin((i / BAR_COUNT) * Math.PI) * 0.45 + 0.35;
    return Math.max(0.18, Math.min(1, shape + (r - 0.5) * 0.6));
  });
}

/**
 * Bolha de áudio no padrão do WhatsApp: tocar/pausar, onda que enche conforme toca
 * (toque na onda pula para o ponto), duração, velocidade 1×/1,5×/2× e hora no canto.
 */
export function AudioBubble({
  id,
  source,
  durationS,
  at,
  mine,
  status,
}: {
  id: string;
  source: AudioSource | null;
  durationS?: number;
  at: string;
  mine: boolean;
  status?: MessageStatus;
}) {
  const player = useAudioPlayer(source ?? null, { updateInterval: 100 });
  const s = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const wave = useMemo(() => waveFor(id), [id]);
  const available = source != null;
  const total = s.duration > 0 ? s.duration : durationS ?? 0;
  const progress = total > 0 ? Math.min(1, s.currentTime / total) : 0;
  const started = s.playing || s.currentTime > 0.05;

  useEffect(() => {
    if (s.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [s.didJustFinish, player]);

  const toggle = () => {
    if (!available) return;
    if (s.playing) {
      player.pause();
      return;
    }
    void setAudioModeAsync({ playsInSilentMode: true });
    if (total > 0 && s.currentTime >= total - 0.05) void player.seekTo(0);
    player.setPlaybackRate(speed);
    player.play();
  };

  const seek = (e: GestureResponderEvent) => {
    if (!available || total <= 0) return;
    const x = Math.max(0, Math.min(WAVE_WIDTH, e.nativeEvent.locationX));
    void player.seekTo((x / WAVE_WIDTH) * total);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    player.setPlaybackRate(next);
  };

  const fg = mine ? '#fff' : colors.primary;
  const played = mine ? '#fff' : colors.primary;
  const rest = mine ? 'rgba(255,255,255,0.42)' : '#c6d2ea';

  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <View style={styles.row}>
        <Pressable
          onPress={toggle}
          disabled={!available}
          accessibilityRole="button"
          accessibilityLabel={!available ? 'Áudio indisponível' : s.playing ? 'Pausar áudio' : `Ouvir áudio de ${durationLabel(total)}`}
          style={({ pressed }) => [styles.play, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.primaryWash }, pressed && { transform: [{ scale: 0.94 }] }, !available && { opacity: 0.5 }]}
        >
          <Ionicons name={s.playing ? 'pause' : 'play'} size={20} color={fg} style={!s.playing ? { marginLeft: 2 } : undefined} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Pressable onPress={seek} disabled={!available} accessibilityRole="adjustable" accessibilityLabel="Posição do áudio" accessibilityValue={{ min: 0, max: Math.round(total), now: Math.round(s.currentTime) }} style={styles.wave}>
            {wave.map((h, i) => (
              <View key={i} style={[styles.bar, { height: 4 + h * 20, backgroundColor: (i + 0.5) / BAR_COUNT <= progress ? played : rest }]} />
            ))}
          </Pressable>
          <View style={styles.under}>
            <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.82)' }]}>{durationLabel(started ? s.currentTime : total)}</Text>
            <MessageMeta at={at} mine={mine} status={status} tone={mine ? 'onBubbleMine' : 'onBubbleTheirs'} />
          </View>
        </View>

        {started ? (
          <Pressable onPress={cycleSpeed} accessibilityRole="button" accessibilityLabel={`Velocidade ${speed} vezes. Toque para mudar`} style={[styles.speed, { backgroundColor: mine ? 'rgba(255,255,255,0.22)' : '#eef1f6' }]}>
            <Text style={[styles.speedText, { color: mine ? '#fff' : colors.text }]}>{`${String(speed).replace('.', ',')}×`}</Text>
          </Pressable>
        ) : (
          <View style={[styles.mic, { backgroundColor: mine ? 'rgba(255,255,255,0.18)' : colors.primaryWash }]} accessible={false}>
            <Ionicons name="mic" size={16} color={fg} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { width: 268, paddingVertical: 8, paddingLeft: 8, paddingRight: 10, borderRadius: BUBBLE_RADIUS },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 8 },
  theirs: { backgroundColor: '#fff', borderBottomLeftRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  wave: { width: WAVE_WIDTH, height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 2.6, borderRadius: 2 },
  under: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  time: { ...text.label, fontFamily: 'Inter_500Medium', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  speed: { minWidth: 38, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  speedText: { ...text.captionStrong },
  mic: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
