import { useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { colors, motion, radii, shadows, text } from './tokens';

/**
 * Diálogo do Operax no lugar do alerta nativo do sistema: cartão no visual do app, com ícone no tom
 * do assunto (perigo, aviso, informação, sucesso), título, texto e os botões do design system.
 *
 * Chamada imperativa, de qualquer lugar (tela, hook, callback de erro), igual ao `Alert.alert`:
 *   if (await confirmDialog({ title: 'Descartar treino?', confirmLabel: 'Descartar', tone: 'danger' })) …
 *   showDialog({ title: 'Não deu para salvar', message: 'Tente de novo.', tone: 'warn' });
 * O `<DialogHost />` fica no layout raiz.
 */

export type DialogTone = 'danger' | 'warn' | 'info' | 'success';
type IconName = keyof typeof Ionicons.glyphMap;
export type DialogAction = { label: string; value: string; variant?: 'primary' | 'danger' | 'secondary' | 'ghost' };
export type DialogOptions = {
  title: string;
  message?: string;
  tone?: DialogTone;
  icon?: IconName;
  /** Botões de cima para baixo; o primeiro é a ação principal. Sem botões: um "Entendi". */
  actions?: DialogAction[];
  /** Valor devolvido ao tocar fora ou no voltar do Android (padrão: `undefined`). */
  dismissValue?: string;
};

type Pending = DialogOptions & { id: number; resolve: (v: string | undefined) => void };

// ---------- fila global (um diálogo por vez, na ordem em que foram pedidos) ----------
let queue: Pending[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const current = () => queue[0] ?? null;

/** Abre o diálogo e resolve com o `value` do botão tocado (ou `dismissValue` ao fechar). */
export function showDialog(options: DialogOptions): Promise<string | undefined> {
  return new Promise((resolve) => {
    queue = [...queue, { ...options, id: ++seq, resolve }];
    emit();
  });
}

/** Pergunta com confirmação: `true` só se a pessoa tocar na ação principal. */
export async function confirmDialog(o: { title: string; message?: string; confirmLabel: string; cancelLabel?: string; tone?: DialogTone; icon?: IconName }): Promise<boolean> {
  const v = await showDialog({
    title: o.title,
    message: o.message,
    tone: o.tone ?? 'info',
    icon: o.icon,
    actions: [
      { label: o.confirmLabel, value: 'ok', variant: o.tone === 'danger' ? 'danger' : 'primary' },
      { label: o.cancelLabel ?? 'Voltar', value: 'cancel', variant: 'ghost' },
    ],
  });
  return v === 'ok';
}

function settle(id: number, value: string | undefined) {
  const item = queue.find((q) => q.id === id);
  queue = queue.filter((q) => q.id !== id);
  emit();
  item?.resolve(value);
}

const TONE: Record<DialogTone, { icon: IconName; fg: string; bg: string }> = {
  danger: { icon: 'trash-outline', fg: colors.dangerText, bg: colors.dangerSoft },
  warn: { icon: 'alert-circle-outline', fg: colors.warnText, bg: colors.warnSoft },
  info: { icon: 'information-circle-outline', fg: colors.primary, bg: colors.primaryWash },
  success: { icon: 'checkmark-circle-outline', fg: colors.success, bg: colors.successSoft },
};

const easeOut = Easing.bezier(...motion.easeOut);

export function DialogHost() {
  const item = useSyncExternalStore(subscribe, current, current);
  // Guarda o último diálogo para a animação de saída não piscar vazia.
  const [shown, setShown] = useState<Pending | null>(item);
  if (item && item !== shown) setShown(item);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(item ? 1 : 0, { duration: item ? 220 : 140, easing: easeOut });
  }, [item, progress]);

  useEffect(() => {
    if (!item) return;
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      settle(item.id, item.dismissValue);
      return true;
    });
    return () => h.remove();
  }, [item]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const card = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.94 + progress.value * 0.06 }, { translateY: (1 - progress.value) * 12 }] }));

  const d = item ?? shown;
  if (!d) return null;
  const tone = TONE[d.tone ?? 'info'];
  const actions = d.actions?.length ? d.actions : [{ label: 'Entendi', value: 'ok', variant: 'primary' as const }];

  return (
    <Modal visible={!!item} transparent animationType="none" statusBarTranslucent onRequestClose={() => item && settle(item.id, item.dismissValue)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => item && settle(item.id, item.dismissValue)} accessibilityRole="button" accessibilityLabel="Fechar" />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, card]} accessibilityViewIsModal accessibilityRole="alert">
          <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
            <Ionicons name={d.icon ?? tone.icon} size={28} color={tone.fg} />
          </View>
          <Text style={styles.title} accessibilityRole="header">{d.title}</Text>
          {d.message ? <Text style={styles.message}>{d.message}</Text> : null}
          <View style={styles.actions}>
            {actions.map((a) => (
              <Button key={a.value} label={a.label} variant={a.variant ?? 'secondary'} onPress={() => item && settle(item.id, a.value)} />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(5, 10, 20, 0.5)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { alignSelf: 'stretch', maxWidth: 420, alignItems: 'center', paddingTop: 26, paddingHorizontal: 22, paddingBottom: 18, borderRadius: radii.xl, backgroundColor: colors.cardBg, ...shadows.hero },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { ...text.title, color: colors.text, textAlign: 'center' },
  message: { ...text.body, color: colors.textSoft, textAlign: 'center', marginTop: 8 },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
});
