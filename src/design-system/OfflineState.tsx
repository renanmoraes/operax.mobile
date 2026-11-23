import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isNetworkError, onReconnect, useOnline } from '@/src/shared/network/network';
import { Illustration } from './Illustration';
import { Button, EmptyState } from './ui';
import { colors, radii, typography } from './tokens';

/**
 * Tela de quem está sem internet: ícone, o que aconteceu e o que fazer. A tela volta a carregar sozinha
 * quando a conexão volta (ver `NetworkWatcher`); o botão serve para quem não quer esperar.
 */
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Illustration kind="sem-internet" />
      <Text style={styles.title}>{t('offline.title')}</Text>
      <Text style={styles.body}>{t('offline.body')}</Text>
      {onRetry ? <Button label={t('offline.retry')} variant="soft" icon="refresh" onPress={onRetry} style={{ marginTop: 6, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

/**
 * Falha ao carregar uma tela. Sem internet (ou erro de rede) mostra o aviso de offline; com internet, um erro comum
 * com o texto que a tela deu. Nunca diz "indisponível nesta empresa" para quem só está sem sinal.
 */
export function LoadError({ error, title, subtitle, onRetry }: { error?: unknown; title?: string; subtitle?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const online = useOnline();
  if (!online || isNetworkError(error)) return <OfflineState onRetry={onRetry} />;
  return <EmptyState illustration={<Illustration kind="erro" />} title={title ?? t('offline.serverTitle')} subtitle={subtitle ?? (title ? undefined : t('offline.serverBody'))} actionLabel={onRetry ? t('offline.retry') : undefined} onAction={onRetry} />;
}

/** Faixa no topo de qualquer tela: some quando há internet (e mostra "conexão de volta" por um instante). */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [recovered, setRecovered] = useState(false);
  const progress = useSharedValue(0);

  // A internet voltou: avisa por um instante e some.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onReconnect(() => {
      setRecovered(true);
      timer = setTimeout(() => setRecovered(false), 2400);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const shown = !online || recovered;
  useEffect(() => {
    progress.value = withTiming(shown ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [shown, progress]);

  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * -24 }] }));
  if (!shown) return null;
  const good = online;
  return (
    <Animated.View pointerEvents="none" style={[styles.banner, { top: insets.top + 6 }, good ? styles.bannerGood : styles.bannerBad, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name={good ? 'checkmark-circle' : 'cloud-offline'} size={18} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>{good ? t('offline.back') : t('offline.banner')}</Text>
        {good ? null : <Text style={styles.bannerHint} numberOfLines={2}>{t('offline.bannerHint')}</Text>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  title: { fontFamily: typography.fontFamilyBold, fontSize: 20, color: colors.text, textAlign: 'center' },
  body: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22, color: colors.textMuted, textAlign: 'center' },
  banner: { position: 'absolute', left: 16, right: 16, zIndex: 999, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.lg },
  bannerBad: { backgroundColor: '#334155' },
  bannerGood: { backgroundColor: colors.success },
  bannerTitle: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: '#fff' },
  bannerHint: { fontFamily: typography.fontFamily, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
});
