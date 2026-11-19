import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@/src/design-system/tokens';
import { onQueueChange, pendingCount } from './resultsQueue';

/** Aviso simples no topo: "sem internet" e/ou quantos treinos esperam para subir. Some sozinho quando não há nada a dizer. */
export function OfflineBar() {
  const { t } = useTranslation('fitness');
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const isOff = (s: { isConnected?: boolean; isInternetReachable?: boolean }) => s.isConnected === false || s.isInternetReachable === false;
    void Network.getNetworkStateAsync().then((s) => alive && setOffline(isOff(s))).catch(() => undefined);
    let sub: { remove: () => void } | null = null;
    try {
      sub = Network.addNetworkStateListener((s) => setOffline(isOff(s)));
    } catch {
      // sem módulo de rede: o aviso de pendentes continua valendo
    }
    const refresh = () => void pendingCount().then((n) => alive && setPending(n)).catch(() => undefined);
    refresh();
    const off = onQueueChange(refresh);
    // A fila também esvazia por envio (não passa por `write` de quem guardou): confere de tempos em tempos.
    const timer = setInterval(refresh, 15_000);
    return () => {
      alive = false;
      sub?.remove();
      off();
      clearInterval(timer);
    };
  }, []);

  if (!offline && !pending) return null;
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 12, right: 12, top: insets.top + 4, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: colors.warn }}>
        <Ionicons name={offline ? 'cloud-offline-outline' : 'cloud-upload-outline'} size={16} color={colors.warn} />
        <Text style={{ color: colors.warn, fontFamily: 'Inter_600SemiBold', fontSize: 12.5, flexShrink: 1 }}>
          {[offline ? t('offline.bar') : null, pending ? t('offline.pending', { count: pending }) : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}
