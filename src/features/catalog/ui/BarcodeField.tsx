import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { Button, Field, Muted } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { ScannerModal } from '@/src/features/pos/ScannerModal';
import { findByCode, generateProductCode } from '@/src/shared/api/catalog.api';

/**
 * Código de barras (ou SKU): digita, lê com a câmera ou gera um interno. Ao ler, confere se algum produto já usa o
 * código e avisa antes de cadastrar repetido.
 */
export function BarcodeField({ label, value, onChange, kind = 'barcode', productName, scan = true }: { label: string; value: string; onChange: (v: string) => void; kind?: 'barcode' | 'sku'; productName?: string; scan?: boolean }) {
  const { t } = useTranslation('catalog');
  const [scanning, setScanning] = useState(false);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const check = async (code: string) => {
    setDuplicate(null);
    if (code.trim().length < 3) return;
    try {
      const hit = await findByCode(code);
      if (hit) setDuplicate(hit.name);
    } catch {
      // sem rede ou sem permissão de ler produtos: segue sem o aviso
    }
  };

  const gen = useMutation({
    mutationFn: () => generateProductCode(kind, productName?.trim() || undefined),
    onSuccess: (code) => {
      onChange(code);
      setDuplicate(null);
    },
    onError: () => void showDialog({ title: t('generateFailed'), tone: 'warn' }),
  });

  return (
    <View style={{ gap: 8 }}>
      <Field
        label={label}
        value={value}
        onChangeText={(v) => {
          onChange(kind === 'sku' ? v.toUpperCase() : v);
          if (duplicate) setDuplicate(null);
        }}
        keyboardType={kind === 'barcode' ? 'number-pad' : 'default'}
        autoCapitalize={kind === 'sku' ? 'characters' : 'none'}
      />
      <View style={styles.row}>
        {scan ? (
          <View style={{ flex: 1 }}>
            <Button label={t('scan')} variant="soft" compact icon="barcode-outline" onPress={() => setScanning(true)} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button label={t('generate')} variant="ghost" compact icon="sparkles-outline" loading={gen.isPending} onPress={() => gen.mutate()} />
        </View>
      </View>
      {duplicate ? <Muted style={{ color: colors.warnText, fontFamily: typography.fontFamilySemiBold }}>{t('duplicate', { name: duplicate })}</Muted> : null}
      <ScannerModal
        visible={scanning}
        onClose={() => setScanning(false)}
        onCode={(code) => {
          onChange(code);
          setScanning(false);
          void check(code);
        }}
        feedback={null}
        count={0}
        title={t('scanTitle')}
        hint={t('scanHint')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
});
