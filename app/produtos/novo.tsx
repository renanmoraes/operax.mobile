import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';
import { Button, Card, Chip, Field, Loading, Muted, PressableScale, Screen, ScreenHeader, SectionHeader } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { MoneyField } from '@/src/features/contact/MoneyField';
import { acceptsInitialBalance, byMeasure, EMPTY_DRAFT, problemOf, UNITS, type Draft } from '@/src/features/catalog/newProduct';
import { registerProduct } from '@/src/features/catalog/registerProduct';
import { maskDate } from '@/src/features/pos/signup';
import { ScannerModal } from '@/src/features/pos/ScannerModal';
import { getActiveApps } from '@/src/shared/api/attendance.api';
import { generateProductCode, listProductCategories, type StockControl } from '@/src/shared/api/catalog.api';
import type { UploadFile } from '@/src/shared/api/upload';

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CONTROLS: StockControl[] = ['tracked', 'lot_tracked', 'serial_tracked', 'not_tracked'];

export default function NewProductGuarded() {
  const { t } = useTranslation('catalog');
  return (
    <RequirePermission need="productsManage" title={t('guardTitle')}>
      <NewProduct />
    </RequirePermission>
  );
}

function NewProduct() {
  const { t } = useTranslation('catalog');
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const can = useCan();
  const live = mode === 'live';
  const appsQ = useQuery({ queryKey: ['active-apps'], enabled: live, staleTime: 10 * 60_000, queryFn: getActiveApps });
  const catQ = useQuery({ queryKey: ['catalog', 'categories'], enabled: live, staleTime: 5 * 60_000, queryFn: listProductCategories });
  // O Estoque é o que deixa lançar saldo: sem ele (ou sem a permissão), é só o cadastro do produto.
  const stockOn = (live ? (appsQ.data ?? []).includes('inventory-catalog') : true) && can('inventoryManage');

  const [d, setD] = useState<Draft>(EMPTY_DRAFT);
  const [photo, setPhoto] = useState<UploadFile | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const pick = async (camera: boolean) => {
    setPhotoSheet(false);
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    if (camera) {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return;
    }
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    const type = a.mimeType ?? 'image/jpeg';
    if (!PHOTO_TYPES.includes(type)) return setError(t('photoType'));
    if ((a.fileSize ?? 0) > MAX_PHOTO) return setError(t('photoTooBig'));
    setError(null);
    setPhoto({ uri: a.uri, name: a.fileName ?? 'produto.jpg', type });
  };

  const gen = useMutation({
    mutationFn: (type: 'sku' | 'barcode') => generateProductCode(type, d.name.trim() || undefined).then((code) => ({ type, code })),
    onSuccess: ({ type, code }) => set(type === 'sku' ? 'sku' : 'barcode', code),
    onError: () => void showDialog({ title: t('generateFailed'), tone: 'warn' }),
  });

  const save = useMutation({
    mutationFn: () => registerProduct(d, photo),
    onSuccess: async ({ product, warnings }) => {
      const msg = [t('savedBody', { name: product.name }), ...warnings.map((w) => t(`warnings.${w}`))].join('\n');
      const v = await showDialog({
        title: t('saved'),
        message: msg,
        tone: warnings.length ? 'warn' : 'success',
        actions: [{ label: t('another'), value: 'again' }, { label: t('done'), value: 'done', variant: 'ghost' }],
        dismissValue: 'done',
      });
      if (v === 'again') {
        setD({ ...EMPTY_DRAFT, categoryId: d.categoryId, unit: d.unit, withStock: d.withStock, control: d.control });
        setPhoto(null);
      } else back();
    },
    onError: () => setError(t('failed')),
  });

  const submit = () => {
    const p = problemOf(d);
    if (p) return setError(t(`problems.${p}`));
    setError(null);
    save.mutate();
  };

  const stockActive = stockOn && d.withStock;

  if (live && appsQ.isLoading) return <Screen><ScreenHeader safe title={t('title')} onBack={back} /><Loading /></Screen>;

  return (
    <Screen>
      <ScreenHeader safe title={t('title')} onBack={back} />
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <PressableScale onPress={() => setPhotoSheet(true)} accessibilityRole="button" accessibilityLabel={photo ? t('photoChange') : t('photoAdd')} style={styles.photo}>
              {photo ? <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Ionicons name="camera-outline" size={26} color={colors.primary} />
                  <Text style={styles.photoText}>{t('photoAdd')}</Text>
                </View>
              )}
            </PressableScale>
            <View style={{ flex: 1, gap: 10 }}>
              <Field label={t('name')} value={d.name} onChangeText={(v) => set('name', v)} placeholder={t('namePlaceholder')} autoCapitalize="sentences" />
            </View>
          </View>
          <Field label={t('description')} value={d.description} onChangeText={(v) => set('description', v)} multiline />

          <SectionHeader title={t('codes')} />
          <Card style={{ gap: 14 }}>
            <Field label={t('sku')} value={d.sku} onChangeText={(v) => set('sku', v)} autoCapitalize="characters" />
            <Button label={t('generate')} variant="ghost" compact icon="sparkles-outline" loading={gen.isPending && gen.variables === 'sku'} onPress={() => gen.mutate('sku')} />
            <Field label={t('barcode')} value={d.barcode} onChangeText={(v) => set('barcode', v)} keyboardType="number-pad" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Button label={t('scan')} variant="soft" compact icon="barcode-outline" onPress={() => setScanning(true)} /></View>
              <View style={{ flex: 1 }}><Button label={t('generate')} variant="ghost" compact icon="sparkles-outline" loading={gen.isPending && gen.variables === 'barcode'} onPress={() => gen.mutate('barcode')} /></View>
            </View>
          </Card>

          {(catQ.data ?? []).length > 0 ? (
            <>
              <SectionHeader title={t('category')} />
              <View style={styles.wrap}>
                <Chip label={t('noCategory')} selected={!d.categoryId} onPress={() => set('categoryId', '')} />
                {(catQ.data ?? []).map((c) => <Chip key={c.id} label={c.name} selected={d.categoryId === c.id} onPress={() => set('categoryId', c.id)} />)}
              </View>
            </>
          ) : null}

          <SectionHeader title={t('price')} />
          <Card style={{ gap: 14 }}>
            <MoneyField label={d.unit === 'UN' ? t('price') : t('priceByUnit', { unit: d.unit.toLowerCase() })} cents={d.priceCents} onChange={(v) => set('priceCents', v)} />
            <MoneyField label={t('cost')} cents={d.costCents} onChange={(v) => set('costCents', v)} />
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('unit')}</Text>
              <View style={styles.wrap}>
                {UNITS.map((u) => <Chip key={u} label={t(`units.${u}`)} selected={d.unit === u} onPress={() => set('unit', u)} />)}
              </View>
              {d.unit !== 'UN' ? <Muted>{t('unitHint')}</Muted> : null}
            </View>
          </Card>

          {stockOn ? (
            <>
              <SectionHeader title={t('stock')} />
              <Card style={{ gap: 14 }}>
                <View style={styles.toggle}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.toggleTitle}>{t('stockToggle')}</Text>
                    <Muted>{t('stockHint')}</Muted>
                  </View>
                  <Switch value={d.withStock} onValueChange={(v) => set('withStock', v)} trackColor={{ true: colors.primary }} accessibilityLabel={t('stockToggle')} />
                </View>
                {stockActive ? (
                  <>
                    <View style={{ gap: 8 }}>
                      <Text style={styles.label}>{t('control')}</Text>
                      <View style={styles.wrap}>
                        {CONTROLS.filter((c) => c !== 'not_tracked').map((c) => <Chip key={c} label={t(`controls.${c}`)} selected={d.control === c} onPress={() => set('control', c)} />)}
                      </View>
                      <Muted>{t(`controlHints.${d.control}`)}</Muted>
                    </View>
                    {acceptsInitialBalance(d.control) ? (
                      <>
                        <Field label={t('initialQty')} value={d.initialQty} onChangeText={(v) => set('initialQty', v)} keyboardType={byMeasure(d.unit) ? 'decimal-pad' : 'number-pad'} />
                        <Muted>{t('initialQtyHint')}</Muted>
                        <Field label={t('expires')} value={d.expires} onChangeText={(v) => set('expires', maskDate(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} />
                        <Muted>{t('expiresHint')}</Muted>
                      </>
                    ) : null}
                    <Field label={t('reorder')} value={d.reorder} onChangeText={(v) => set('reorder', v)} keyboardType={byMeasure(d.unit) ? 'decimal-pad' : 'number-pad'} />
                    <Muted>{t('reorderHint')}</Muted>
                  </>
                ) : null}
              </Card>
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label={t('save')} loading={save.isPending} onPress={submit} />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title={t('photo')}>
        <View style={{ gap: 10 }}>
          <Button label={t('photoCamera')} icon="camera-outline" onPress={() => void pick(true)} />
          <Button label={t('photoGallery')} variant="soft" icon="images-outline" onPress={() => void pick(false)} />
          {photo ? <Button label={t('photoRemove')} variant="ghost" onPress={() => { setPhoto(null); setPhotoSheet(false); }} /> : null}
        </View>
      </BottomSheet>

      <ScannerModal
        visible={scanning}
        onClose={() => setScanning(false)}
        onCode={(code) => { set('barcode', code); setScanning(false); }}
        feedback={null}
        count={0}
        title={t('scanTitle')}
        hint={t('scanHint')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  photo: { width: 96, height: 96, borderRadius: radii.lg, backgroundColor: colors.primaryWash, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 22 },
  photoText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.primary, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.pageBg },
  error: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.dangerText },
});
