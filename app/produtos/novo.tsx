import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';
import { Button, Chip, Field, Loading, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { MoneyField } from '@/src/features/contact/MoneyField';
import { patchDraft, resetDraft, useDraft } from '@/src/features/catalog/draftStore';
import { digitsOnly, hasFiscal, ORIGINS } from '@/src/features/catalog/fiscal';
import { acceptsInitialBalance, byMeasure, CONDITIONS, hasVariations, problemOf, UNITS } from '@/src/features/catalog/newProduct';
import { registerProduct, type Warning } from '@/src/features/catalog/registerProduct';
import { BarcodeField } from '@/src/features/catalog/ui/BarcodeField';
import { FormSection } from '@/src/features/catalog/ui/FormSection';
import { PhotoStrip } from '@/src/features/catalog/ui/PhotoStrip';
import { MAX_PRODUCT_PHOTOS } from '@/src/features/catalog/variations';
import { maskDate } from '@/src/features/pos/signup';
import { getActiveApps } from '@/src/shared/api/attendance.api';
import { listProductCategories, type StockControl } from '@/src/shared/api/catalog.api';

const CONTROLS: StockControl[] = ['tracked', 'lot_tracked', 'serial_tracked'];
type Open = 'listing' | 'fiscal' | 'flags' | null;

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
  const d = useDraft();
  const qc = useQueryClient();
  const appsQ = useQuery({ queryKey: ['active-apps'], enabled: live, staleTime: 10 * 60_000, queryFn: getActiveApps });
  const catQ = useQuery({ queryKey: ['catalog', 'categories'], enabled: live, staleTime: 5 * 60_000, queryFn: listProductCategories });
  const apps = live ? appsQ.data ?? [] : ['inventory-catalog', 'associados'];
  // O Estoque é o que deixa lançar saldo: sem ele (ou sem a permissão), é só o cadastro do produto.
  const stockOn = apps.includes('inventory-catalog') && can('inventoryManage');
  const associates = apps.includes('associados');
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const toggle = (k: Exclude<Open, null>) => setOpen((o) => (o === k ? null : k));
  const withRows = hasVariations(d);
  const stockActive = stockOn && d.withStock;

  const problemText = (p: { key: string; params?: Record<string, string | number> }) => {
    const params = { ...p.params };
    if (typeof params.field === 'string') params.field = t(`problems.fields.${params.field as 'weight'}`);
    return t(`problems.${p.key as 'name'}`, params);
  };

  const warningText = (w: Warning) => t(`warnings.${w.code}`, { name: w.name ?? '', detail: w.detail ?? '' }).replace(/\s+$/, '');

  const save = useMutation({
    mutationFn: () => registerProduct(d, { associates, canSeeCost: true }),
    onSuccess: async ({ product, warnings }) => {
      // O produto novo já vale na busca do PDV, na lista de produtos e no estoque: nada de resposta antiga guardada.
      void qc.invalidateQueries({ queryKey: ['pos', 'products'] });
      void qc.invalidateQueries({ queryKey: ['catalog'] });
      const msg = [t('savedBody', { name: product.name }), ...warnings.map(warningText)].join('\n');
      const v = await showDialog({
        title: t('saved'),
        message: msg,
        tone: warnings.length ? 'warn' : 'success',
        actions: [{ label: t('another'), value: 'again' }, { label: t('done'), value: 'done', variant: 'ghost' }],
        dismissValue: 'done',
      });
      resetDraft({ categoryId: d.categoryId, unit: d.unit, withStock: d.withStock, control: d.control });
      if (v === 'again') setError(null);
      else back();
    },
    onError: () => setError(t('failed')),
  });

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const submit = async () => {
    const p = problemOf(d);
    if (p) return setError(problemText(p));
    setError(null);
    // O PDV acha o produto sem preço, mas não consegue vender: melhor avisar antes de cadastrar.
    const noPrice = d.priceCents === 0 && (d.rows.length === 0 || d.rows.some((r) => r.priceCents === 0));
    if (noPrice) {
      const ok = await confirmDialog({ title: t('noPrice.title'), message: t('noPrice.body'), confirmLabel: t('noPrice.confirm'), cancelLabel: t('noPrice.back'), tone: 'warn' });
      if (!ok) return;
    }
    save.mutate();
  };

  if (live && appsQ.isLoading) return <Screen><ScreenHeader safe title={t('title')} onBack={back} /><Loading /></Screen>;

  const photos = [...(d.cover ? [d.cover] : []), ...d.gallery];
  const optionSummary = d.options.filter((o) => o.values.length).map((o) => `${o.name}: ${o.values.join(', ')}`).join(' · ');

  return (
    <Screen>
      <ScreenHeader safe title={t('title')} onBack={back} />
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FormSection icon="images-outline" title={t('sections.photos')} open alwaysOpen>
            <PhotoStrip photos={photos} max={MAX_PRODUCT_PHOTOS} hint onChange={(next) => patchDraft({ cover: next[0] ?? null, gallery: next.slice(1) })} />
          </FormSection>

          <FormSection icon="cube-outline" title={t('sections.data')} open alwaysOpen>
            <Field label={t('name')} value={d.name} onChangeText={(v) => patchDraft({ name: v })} placeholder={t('namePlaceholder')} autoCapitalize="sentences" />
            <Field label={t('brand')} value={d.brand} onChangeText={(v) => patchDraft({ brand: v })} autoCapitalize="words" />
            <Field label={t('description')} value={d.description} onChangeText={(v) => patchDraft({ description: v })} multiline />
            {(catQ.data ?? []).length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>{t('category')}</Text>
                <View style={styles.wrap}>
                  <Chip label={t('noCategory')} selected={!d.categoryId} onPress={() => patchDraft({ categoryId: '' })} />
                  {(catQ.data ?? []).map((c) => <Chip key={c.id} label={c.name} selected={d.categoryId === c.id} onPress={() => patchDraft({ categoryId: c.id })} />)}
                </View>
              </View>
            ) : null}
            <BarcodeField label={t('sku')} kind="sku" scan={false} value={d.sku} onChange={(v) => patchDraft({ sku: v })} productName={d.name} />
            {withRows ? <Muted>{t('barcodeByVariation')}</Muted> : <BarcodeField label={t('barcode')} value={d.barcode} onChange={(v) => patchDraft({ barcode: v })} productName={d.name} />}
          </FormSection>

          <FormSection icon="pricetag-outline" title={t('sections.price')} open alwaysOpen>
            <MoneyField label={d.unit === 'UN' ? t('price') : t('priceByUnit', { unit: d.unit.toLowerCase() })} cents={d.priceCents} onChange={(v) => patchDraft({ priceCents: v })} />
            {withRows ? null : <MoneyField label={t('cost')} cents={d.costCents} onChange={(v) => patchDraft({ costCents: v })} />}
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('unit')}</Text>
              <View style={styles.wrap}>
                {UNITS.map((u) => <Chip key={u} label={t(`units.${u}`)} selected={d.unit === u} onPress={() => patchDraft({ unit: u })} />)}
              </View>
              {d.unit !== 'UN' ? <Muted>{t('unitHint')}</Muted> : null}
            </View>
          </FormSection>

          <FormSection icon="color-palette-outline" title={t('sections.variations')} open alwaysOpen>
            {withRows ? (
              <>
                <Text style={styles.strong}>{t('variations.count', { count: d.rows.length })}</Text>
                <Muted>{optionSummary}</Muted>
                <Muted>{t('variations.priceHint')}</Muted>
                <Button label={t('variations.edit')} variant="soft" icon="create-outline" onPress={() => router.push('/produtos/variacoes')} />
                <Button label={t('variations.clear')} variant="ghost" compact onPress={() => patchDraft({ options: [], rows: [] })} />
              </>
            ) : (
              <>
                <Text style={styles.strong}>{t('variations.none')}</Text>
                <Muted>{t('variations.noneHint')}</Muted>
                <Button label={t('variations.add')} variant="soft" icon="add" onPress={() => router.push('/produtos/variacoes')} />
              </>
            )}
          </FormSection>

          {stockOn ? (
            <FormSection icon="layers-outline" title={t('sections.stock')} open alwaysOpen>
              <View style={styles.toggle}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.strong}>{t('stock.toggle')}</Text>
                  <Muted>{t('stock.hint')}</Muted>
                </View>
                <Switch value={d.withStock} onValueChange={(v) => patchDraft({ withStock: v })} trackColor={{ true: colors.primary }} accessibilityLabel={t('stock.toggle')} />
              </View>
              {stockActive ? (
                <>
                  <View style={{ gap: 8 }}>
                    <Text style={styles.label}>{t('stock.control')}</Text>
                    <View style={styles.wrap}>
                      {CONTROLS.map((c) => <Chip key={c} label={t(`stock.controls.${c}`)} selected={d.control === c} onPress={() => patchDraft({ control: c })} />)}
                    </View>
                    <Muted>{t(`stock.controlHints.${d.control}`)}</Muted>
                  </View>
                  {acceptsInitialBalance(d.control) ? (
                    withRows ? <Muted>{t('stock.byVariation')}</Muted> : (
                      <>
                        <Field label={t('stock.initialQty')} value={d.initialQty} onChangeText={(v) => patchDraft({ initialQty: v })} keyboardType={byMeasure(d.unit) ? 'decimal-pad' : 'number-pad'} />
                        <Muted>{t('stock.initialQtyHint')}</Muted>
                        <Field label={`${t('stock.expires')} · ${t('optional')}`} value={d.expires} onChangeText={(v) => patchDraft({ expires: maskDate(v) })} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} />
                        <Muted>{t('stock.expiresHint')}</Muted>
                      </>
                    )
                  ) : null}
                  <Field label={t('stock.reorder')} value={d.reorder} onChangeText={(v) => patchDraft({ reorder: v })} keyboardType={byMeasure(d.unit) ? 'decimal-pad' : 'number-pad'} />
                  <Muted>{t('stock.reorderHint')}</Muted>
                </>
              ) : null}
            </FormSection>
          ) : null}

          <FormSection icon="megaphone-outline" title={t('sections.listing')} summary={[d.condition !== 'new' ? t(`listing.conditions.${d.condition}`) : '', d.weight ? `${d.weight} g` : ''].filter(Boolean).join(' · ') || t('optional')} open={open === 'listing'} onToggle={() => toggle('listing')}>
            <Muted>{t('listing.hint')}</Muted>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('listing.condition')}</Text>
              <View style={styles.wrap}>
                {CONDITIONS.map((c) => <Chip key={c} label={t(`listing.conditions.${c}`)} selected={d.condition === c} onPress={() => patchDraft({ condition: c })} />)}
              </View>
            </View>
            <Field label={t('listing.weight')} value={d.weight} onChangeText={(v) => patchDraft({ weight: v })} keyboardType="number-pad" />
            <View style={styles.three}>
              <View style={{ flex: 1 }}><Field label={t('listing.height')} value={d.height} onChangeText={(v) => patchDraft({ height: v })} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label={t('listing.width')} value={d.width} onChangeText={(v) => patchDraft({ width: v })} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label={t('listing.length')} value={d.length} onChangeText={(v) => patchDraft({ length: v })} keyboardType="decimal-pad" /></View>
            </View>
          </FormSection>

          <FormSection icon="document-text-outline" title={t('sections.fiscal')} summary={hasFiscal(d.fiscal) ? [d.fiscal.ncm && `NCM ${d.fiscal.ncm}`, d.fiscal.cfop && `CFOP ${d.fiscal.cfop}`].filter(Boolean).join(' · ') : t('optional')} open={open === 'fiscal'} onToggle={() => toggle('fiscal')}>
            <Muted>{t('fiscal.hint')}</Muted>
            <Field label={t('fiscal.ncm')} value={d.fiscal.ncm} onChangeText={(v) => patchDraft({ fiscal: { ...d.fiscal, ncm: digitsOnly(v, 8) } })} keyboardType="number-pad" maxLength={8} />
            <Field label={t('fiscal.cest')} value={d.fiscal.cest} onChangeText={(v) => patchDraft({ fiscal: { ...d.fiscal, cest: digitsOnly(v, 7) } })} keyboardType="number-pad" maxLength={7} />
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>{t('fiscal.origin')}</Text>
              <View style={styles.wrap}>
                {ORIGINS.map((o) => <Chip key={o} label={t(`fiscal.origins.${o}`)} selected={d.fiscal.origin === o} onPress={() => patchDraft({ fiscal: { ...d.fiscal, origin: d.fiscal.origin === o ? '' : o } })} />)}
              </View>
            </View>
            <Field label={t('fiscal.cfop')} value={d.fiscal.cfop} onChangeText={(v) => patchDraft({ fiscal: { ...d.fiscal, cfop: digitsOnly(v, 4) } })} keyboardType="number-pad" maxLength={4} />
            <Field label={t('fiscal.cst')} value={d.fiscal.cst} onChangeText={(v) => patchDraft({ fiscal: { ...d.fiscal, cst: digitsOnly(v, 3) } })} keyboardType="number-pad" maxLength={3} />
          </FormSection>

          <FormSection icon="apps-outline" title={t('sections.flags')} summary={[d.inWorkflow && t('flags.workflow'), d.memberPlan && t('flags.memberPlan')].filter(Boolean).join(' · ') || t('optional')} open={open === 'flags'} onToggle={() => toggle('flags')}>
            <View style={styles.toggle}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.strong}>{t('flags.workflow')}</Text>
                <Muted>{t('flags.workflowHint')}</Muted>
              </View>
              <Switch value={d.inWorkflow} onValueChange={(v) => patchDraft({ inWorkflow: v })} trackColor={{ true: colors.primary }} accessibilityLabel={t('flags.workflow')} />
            </View>
            {associates ? (
              <View style={styles.toggle}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.strong}>{t('flags.memberPlan')}</Text>
                  <Muted>{t('flags.memberPlanHint')}</Muted>
                </View>
                <Switch value={d.memberPlan} onValueChange={(v) => patchDraft({ memberPlan: v })} trackColor={{ true: colors.primary }} accessibilityLabel={t('flags.memberPlan')} />
              </View>
            ) : null}
          </FormSection>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label={t('save')} loading={save.isPending} onPress={() => void submit()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  three: { flexDirection: 'row', gap: 10 },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  strong: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.pageBg },
  error: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.dangerText },
});
