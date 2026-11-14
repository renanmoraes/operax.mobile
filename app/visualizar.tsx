import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, T } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { PdfView } from '@/src/features/media/PdfView';
import { shareFile, type ViewerKind } from '@/src/features/media/viewer';

/** Visualizador em tela cheia: foto com zoom (pinça, toque duplo, arrastar) ou PDF. */
export default function ViewerScreen() {
  const insets = useSafeAreaInsets();
  const { kind = 'image', uri = '', title } = useLocalSearchParams<{ kind?: ViewerKind; uri?: string; title?: string }>();
  const [chrome, setChrome] = useState(true);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const share = () => void shareFile(uri, kind, title);

  if (!uri) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <T role="title">Arquivo indisponível</T>
        <IconButton icon="close" accessibilityLabel="Fechar" onPress={close} />
      </View>
    );
  }

  if (kind === 'pdf') {
    return (
      <View style={{ flex: 1, backgroundColor: '#eef1f6' }}>
        <StatusBar style="dark" />
        <View style={[styles.pdfBar, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="close" accessibilityLabel="Fechar documento" onPress={close} />
          <Text style={styles.pdfTitle} numberOfLines={1}>{title || 'Documento'}</Text>
          <IconButton icon="share-outline" accessibilityLabel="Compartilhar ou salvar o documento" onPress={share} />
        </View>
        <PdfView uri={uri} title={title} onShare={share} />
      </View>
    );
  }

  return (
    <View style={styles.photoRoot}>
      <StatusBar style="light" hidden={!chrome} />
      <Zoomable
        minScale={1}
        maxScale={5}
        doubleTapScale={2.5}
        isDoubleTapEnabled
        isSingleTapEnabled
        onSingleTap={() => setChrome((c) => !c)}
        style={StyleSheet.absoluteFill}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={title || 'Foto'} />
      </Zoomable>
      {chrome ? (
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={[styles.photoBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <IconButton icon="close" tone="glass" accessibilityLabel="Fechar foto" onPress={close} />
          <Text style={styles.photoTitle} numberOfLines={1}>{title || ''}</Text>
          <IconButton icon="share-outline" tone="glass" accessibilityLabel="Compartilhar ou salvar a foto" onPress={share} />
        </LinearGradient>
      ) : null}
      {chrome ? (
        <View style={[styles.hint, { bottom: insets.bottom + 18 }]} pointerEvents="none">
          <Text style={styles.hintText}>Pinça ou toque duplo para ampliar</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.pageBg },
  pdfBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10, backgroundColor: '#fff' },
  pdfTitle: { ...text.section, flex: 1, color: colors.text, textAlign: 'center' },
  photoRoot: { flex: 1, backgroundColor: '#05080f' },
  photoBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 28 },
  photoTitle: { ...text.calloutStrong, flex: 1, color: '#fff', textAlign: 'center' },
  hint: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  hintText: { ...text.caption, color: 'rgba(255,255,255,0.85)' },
});
