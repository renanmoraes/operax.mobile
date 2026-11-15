import { createElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { Button, T } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import i18n from '@/src/i18n';
import { ensureLocalFile } from './viewer';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

/**
 * Página que desenha o PDF com o PDF.js (só a biblioteca vem da internet; o arquivo
 * vai embutido em base64 e não sai do aparelho). Usada no Android, cujo WebView não abre PDF.
 */
function pdfJsHtml(base64: string) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<style>html,body{margin:0;background:#eef1f6}canvas{display:block;width:calc(100% - 24px);height:auto;margin:12px auto;background:#fff;border-radius:6px;box-shadow:0 2px 10px rgba(12,18,34,.12)}</style>
<script src="${PDFJS}/pdf.min.js"></script></head><body><script>
(async function(){
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS}/pdf.worker.min.js';
    var raw=atob('${base64}'), bytes=new Uint8Array(raw.length);
    for (var i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    var pdf=await pdfjsLib.getDocument({data:bytes}).promise;
    for (var n=1;n<=pdf.numPages;n++){
      var page=await pdf.getPage(n), vp=page.getViewport({scale:2});
      var c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height; document.body.appendChild(c);
      await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
    }
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ok');
  } catch(e){ window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('error'); }
})();
</script></body></html>`;
}

/** PDF dentro do app com rolagem e zoom de pinça. iPhone: leitor do próprio sistema; Android: PDF.js; web: leitor do navegador. */
export function PdfView({ uri, title, onShare }: { uri: string; title?: string; onShare: () => void }) {
  const { t } = useTranslation('client');
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    (async () => {
      try {
        const local = await ensureLocalFile(uri, 'pdf', title);
        const b64 = await readAsStringAsync(local, { encoding: EncodingType.Base64 });
        if (alive) setHtml(pdfJsHtml(b64));
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uri, title]);

  if (failed) {
    return (
      <View style={styles.center}>
        <T role="title">{t('viewer.cannotOpen')}</T>
        <T role="callout" tone="muted" style={{ textAlign: 'center' }}>{t('viewer.canOpenElsewhere')}</T>
        <Button label={t('viewer.openElsewhere')} icon="share-outline" onPress={onShare} style={{ marginTop: 6 }} />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return createElement('iframe', { src: uri, title: title || i18n.t('client:viewer.document'), style: { border: 0, width: '100%', height: '100%', background: '#eef1f6' } });
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        style={{ flex: 1, backgroundColor: '#eef1f6' }}
        originWhitelist={['*']}
        source={Platform.OS === 'android' ? (html ? { html, baseUrl: 'https://localhost/' } : { html: '<html></html>' }) : { uri }}
        allowFileAccess
        allowingReadAccessToURL={uri.startsWith('file:') ? uri : undefined}
        onLoadEnd={() => Platform.OS === 'ios' && setLoading(false)}
        onMessage={(e) => {
          if (e.nativeEvent.data === 'error') setFailed(true);
          setLoading(false);
        }}
        onError={() => setFailed(true)}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
      />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, backgroundColor: '#eef1f6' },
});
