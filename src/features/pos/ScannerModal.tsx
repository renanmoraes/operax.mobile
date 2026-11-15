import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, PressableScale } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { openSystemSettings } from '@/src/features/permissions/permissions';

/** Tipos de código do balcão: EAN/UPC da embalagem, Code 128/39 de etiqueta interna, ITF de caixa, QR do Operax. */
const TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'qr'] as const;

/** O mesmo código visto de novo antes de sumir por este tempo é a câmera vendo a mesma embalagem, não outra unidade. */
const SAME_CODE_MS = 1800;

export type ScanFeedback = { text: string; tone: 'ok' | 'warn' | 'error' } | null;

/**
 * Câmera em tela cheia que fica aberta: o operador passa um produto atrás do outro e só fecha no fim.
 * Cada leitura chama `onCode`; a tela de venda responde com o aviso que aparece embaixo.
 */
export function ScannerModal({
  visible,
  onClose,
  onCode,
  feedback,
  count,
}: {
  visible: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
  feedback: ScanFeedback;
  count: number;
}) {
  const { t } = useTranslation('pos');
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    // Abrir a câmera de novo é pedido do operador: o mesmo produto pode entrar outra vez.
    last.current = null;
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [visible, sweep]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * 150 }] }));

  const handle = (r: BarcodeScanningResult) => {
    const code = r.data?.trim();
    if (!code) return;
    const now = Date.now();
    const same = last.current?.code === code;
    const seenRecently = same && now - last.current!.at < SAME_CODE_MS;
    // A janela desliza: enquanto a mesma embalagem continua na frente da câmera, cada leitura renova o
    // "visto agora" e nada soma. Só conta de novo depois de o código sumir por SAME_CODE_MS (ou outro código).
    last.current = { code, at: now };
    if (seenRecently) return;
    onCode(code);
  };

  const granted = perm?.granted;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent presentationStyle="fullScreen">
      <View style={styles.root}>
        {granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: [...TYPES] }}
            onBarcodeScanned={visible ? handle : undefined}
          />
        ) : null}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="close" onPress={onClose} accessibilityLabel={t('scanner.done')} tone="glass" />
          <Text style={styles.title}>{t('scanner.title')}</Text>
          {granted ? (
            <IconButton icon={torch ? 'flashlight' : 'flashlight-outline'} onPress={() => setTorch((v) => !v)} accessibilityLabel={t('scanner.torch')} tone="glass" />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {granted ? (
          <View style={styles.center} pointerEvents="none">
            <View style={styles.frame}>
              <View style={[styles.corner, { top: 0, left: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 18 }]} />
              <View style={[styles.corner, { top: 0, right: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 18 }]} />
              <View style={[styles.corner, { bottom: 0, left: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 18 }]} />
              <View style={[styles.corner, { bottom: 0, right: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 18 }]} />
              <Animated.View style={[styles.laser, line]} />
            </View>
            <Text style={styles.hint}>{t('scanner.hint')}</Text>
          </View>
        ) : (
          <View style={styles.permBox}>
            <View style={styles.permIcon}>
              <Ionicons name="barcode-outline" size={34} color="#fff" />
            </View>
            <Text style={styles.permTitle}>{t('scanner.permissionTitle')}</Text>
            <Text style={styles.permText}>{t('scanner.permissionText')}</Text>
            {perm && !perm.canAskAgain ? (
              <Button label={t('scanner.settings')} icon="settings-outline" onPress={openSystemSettings} />
            ) : (
              <Button label={t('scanner.allow')} icon="camera-outline" onPress={() => void requestPerm()} />
            )}
          </View>
        )}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          {feedback ? (
            <View style={[styles.feedback, feedback.tone === 'warn' && { backgroundColor: '#7c2d12' }, feedback.tone === 'error' && { backgroundColor: '#7f1d1d' }]} accessibilityLiveRegion="polite">
              <Ionicons name={feedback.tone === 'ok' ? 'checkmark-circle' : feedback.tone === 'warn' ? 'scale-outline' : 'alert-circle'} size={20} color="#fff" />
              <Text style={styles.feedbackText} numberOfLines={2}>
                {feedback.text}
              </Text>
            </View>
          ) : null}
          <PressableScale onPress={onClose} accessibilityRole="button" style={styles.doneBtn}>
            <Text style={styles.doneText}>{t('scanner.done')}</Text>
            {count > 0 ? <Text style={styles.doneCount}>{t('scanner.count', { count })}</Text> : null}
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#03060d' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 2 },
  title: { fontFamily: typography.fontFamilySemiBold, fontSize: 16, color: '#fff' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 22 },
  frame: { width: 270, height: 170 },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: colors.cyan },
  laser: { position: 'absolute', left: 14, right: 14, top: 10, height: 2, borderRadius: 2, backgroundColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.9, shadowRadius: 8 },
  hint: { fontFamily: typography.fontFamilyMedium, fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: 40 },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 14 },
  permIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(79,216,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  permTitle: { fontFamily: typography.fontFamilyBold, fontSize: 19, color: '#fff', textAlign: 'center' },
  permText: { fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 21, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginBottom: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 12 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radii.md, backgroundColor: '#14532d' },
  feedbackText: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 14.5, color: '#fff' },
  doneBtn: { height: 56, borderRadius: radii.control, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.chromeNavy },
  doneCount: { fontFamily: typography.fontFamilyMedium, fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
