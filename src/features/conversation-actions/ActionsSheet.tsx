import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { IconName, PressableScale } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';

/** Tons próprios de cada ação: dá para achar de relance, como na folha de compartilhar do iPhone. */
export const ACTION_TONES = {
  media: { bg: '#ffe9f1', fg: '#be185d' },
  camera: { bg: '#eef1f6', fg: '#3d4759' },
  document: { bg: '#f1e9ff', fg: '#6d28d9' },
  pix: { bg: '#dcf6f1', fg: '#0f766e' },
  booking: { bg: '#e3ebff', fg: '#1e4ed8' },
  template: { bg: '#fff1e2', fg: '#c2410c' },
} as const;

export type ConversationAction = {
  key: string;
  label: string;
  icon: IconName;
  tone: keyof typeof ACTION_TONES;
  /** Motivo quando não dá para usar agora (fica esmaecida e explica ao tocar). */
  blockedReason?: string;
  onPress: () => void;
};

/** "+" da conversa: grade de ações com ícone tonal e nome curto embaixo. */
export function ActionsSheet({ visible, onClose, actions, footnote }: { visible: boolean; onClose: () => void; actions: ConversationAction[]; footnote?: string }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Enviar ou fazer" closeLabel="Fechar ações">
      <View style={styles.grid}>
        {actions.map((a) => {
          const tone = ACTION_TONES[a.tone];
          const blocked = !!a.blockedReason;
          return (
            <PressableScale
              key={a.key}
              onPress={a.onPress}
              accessibilityRole="button"
              accessibilityLabel={blocked ? `${a.label}. ${a.blockedReason}` : a.label}
              accessibilityState={{ disabled: blocked }}
              style={styles.cell}
            >
              <View style={[styles.tile, { backgroundColor: tone.bg }, blocked && { opacity: 0.45 }]}>
                <Ionicons name={a.icon} size={26} color={tone.fg} />
              </View>
              <Text style={[styles.label, blocked && { color: colors.textMuted }]} numberOfLines={2}>
                {a.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginHorizontal: -4, paddingBottom: 6 },
  cell: { width: '25%', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  tile: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { ...text.caption, color: colors.text, textAlign: 'center', fontFamily: 'Inter_500Medium' },
  footnote: { ...text.caption, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
