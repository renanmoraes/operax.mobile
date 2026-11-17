import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';
import { Badge, Button, Card, Chip, Field, Muted, PressableScale, Screen, ScreenHeader, SectionHeader } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { RequirePermission } from '@/src/features/auth/useCan';
import { MoneyField } from '@/src/features/contact/MoneyField';
import { brl } from '@/src/features/contact/format';
import { patchDraft, useDraft } from '@/src/features/catalog/draftStore';
import { BLANK_MODEL, companyModel, OPTION_NAMES, optionsOfModel, optionsToSave, READY_MODELS, sameName, type VariationModel } from '@/src/features/catalog/models';
import { acceptsInitialBalance, type Draft } from '@/src/features/catalog/newProduct';
import { BarcodeField } from '@/src/features/catalog/ui/BarcodeField';
import { PhotoStrip } from '@/src/features/catalog/ui/PhotoStrip';
import { GRID_LIMIT, MAX_VARIATION_PHOTOS, rowHasData, syncRows, tidyValue, uniqueValues, type Option, type VariationRow } from '@/src/features/catalog/variations';
import { listVariationModels, saveVariationModel } from '@/src/shared/api/catalog.api';

const MAX_OPTIONS = 3;

export default function VariationsGuarded() {
  const { t } = useTranslation('catalog');
  return (
    <RequirePermission need="productsManage" title={t('guardTitle')}>
      <Variations />
    </RequirePermission>
  );
}

function Variations() {
  const { t } = useTranslation('catalogVariations');
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const d = useDraft();
  const modelsQ = useQuery({ queryKey: ['catalog', 'variation-models'], staleTime: 5 * 60_000, queryFn: listVariationModels });
  const models: VariationModel[] = useMemo(() => [...READY_MODELS, ...(modelsQ.data ?? []).map(companyModel)], [modelsQ.data]);
  const [bulk, setBulk] = useState(false);
  const [saveSheet, setSaveSheet] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const withStock = d.withStock && acceptsInitialBalance(d.control);

  const setOptions = (options: Option[]) => patchDraft({ options, rows: syncRows(d.rows, options) });
  const setRow = (key: string, patch: Partial<VariationRow>) => patchDraft({ rows: d.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  const pickModel = (m: VariationModel) => {
    const hints: Draft['hints'] = {};
    for (const o of m.options) hints[o.name] = { suggestions: o.suggestions, shortcuts: o.shortcuts };
    patchDraft({ options: optionsOfModel(m), hints, rows: [] });
  };

  const chooser = d.options.length === 0;

  if (chooser) {
    return (
      <Screen>
        <ScreenHeader safe title={t('title')} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}>
          <Text style={styles.h}>{t('chooseModel')}</Text>
          <Muted>{t('chooseHint')}</Muted>
          <View style={styles.wrap}>
            {READY_MODELS.map((m) => <Chip key={m.id} label={m.label} onPress={() => pickModel(m)} />)}
            <Chip label={t('blank')} onPress={() => pickModel(BLANK_MODEL)} />
          </View>
          {models.some((m) => m.company) ? (
            <>
              <SectionHeader title={t('companyModels')} />
              <View style={styles.wrap}>
                {models.filter((m) => m.company).map((m) => <Chip key={m.id} label={m.label} onPress={() => pickModel(m)} />)}
              </View>
            </>
          ) : null}
        </ScrollView>
      </Screen>
    );
  }

  const tooMany = d.rows.length > GRID_LIMIT;
  /** Sugestões de uma opção: as do modelo e as digitadas, mais o que já foi marcado. Nome trocado perde as sugestões do modelo. */
  const hintOf = (name: string) => d.hints[name] ?? { suggestions: [], shortcuts: [] };

  const toggleValue = (i: number, value: string) => {
    const o = d.options[i];
    const has = o.values.some((v) => sameName(v, value));
    setOptions(d.options.map((x, k) => (k === i ? { ...x, values: has ? x.values.filter((v) => !sameName(v, value)) : [...x.values, value] } : x)));
  };

  return (
    <Screen>
      <ScreenHeader safe title={t('title')} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SectionHeader title={t('options')} />
          {d.options.map((o, i) => (
            <OptionBlock
              key={i}
              option={o}
              suggestions={uniqueValues([...o.values, ...hintOf(o.name).suggestions])}
              shortcuts={hintOf(o.name).shortcuts}
              onName={(name) => setOptions(d.options.map((x, k) => (k === i ? { ...x, name } : x)))}
              onToggle={(v) => toggleValue(i, v)}
              onAdd={(v) => {
                const value = tidyValue(v);
                if (!value) return;
                patchDraft({ hints: { ...d.hints, [o.name]: { ...hintOf(o.name), suggestions: uniqueValues([...hintOf(o.name).suggestions, value]) } } });
                if (!o.values.some((x) => sameName(x, value))) toggleValue(i, value);
              }}
              onShortcut={(values) => setOptions(d.options.map((x, k) => (k === i ? { ...x, values: uniqueValues([...x.values, ...values]) } : x)))}
              onRemove={d.options.length > 1 ? () => setOptions(d.options.filter((_, k) => k !== i)) : undefined}
            />
          ))}
          {d.options.length < MAX_OPTIONS ? (
            <Button label={t('addOption')} variant="soft" compact icon="add" onPress={() => patchDraft({ options: [...d.options, { name: '', values: [] }] })} />
          ) : <Muted>{t('optionsLimit')}</Muted>}
          <Button label={t('saveModel')} variant="ghost" compact icon="bookmark-outline" disabled={!d.options.some((o) => o.name.trim())} onPress={() => setSaveSheet(true)} />

          <SectionHeader title={`${t('rows')} · ${t('rowsCount', { count: d.rows.length })}`} />
          {tooMany ? <Text style={styles.error}>{t('limit', { count: GRID_LIMIT })}</Text> : null}
          {d.rows.length === 0 ? <Muted>{t('rowsEmpty')}</Muted> : (
            <>
              <Button label={t('bulk')} variant="soft" compact icon="flash-outline" onPress={() => setBulk(true)} />
              {d.rows.map((r) => (
                <RowCard key={r.key} row={r} open={openRow === r.key} withStock={withStock} onToggle={() => setOpenRow(openRow === r.key ? null : r.key)} onChange={(patch) => setRow(r.key, patch)} />
              ))}
            </>
          )}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button label={t('done')} onPress={() => router.back()} disabled={tooMany} />
        </View>
      </KeyboardAvoidingView>

      <BulkSheet visible={bulk} withStock={withStock} onClose={() => setBulk(false)} onApply={(price, stock) => {
        patchDraft({ rows: d.rows.map((r) => ({ ...r, ...(price > 0 ? { priceCents: price } : {}), ...(stock ? { stock } : {}) })) });
        setBulk(false);
      }} />
      <SaveModelSheet visible={saveSheet} onClose={() => setSaveSheet(false)} options={d.options} hints={d.hints} onSaved={() => void qc.invalidateQueries({ queryKey: ['catalog', 'variation-models'] })} />
    </Screen>
  );
}

function OptionBlock({ option, suggestions, shortcuts, onName, onToggle, onAdd, onShortcut, onRemove }: {
  option: Option; suggestions: string[]; shortcuts: { label: string; values: string[] }[]; onName: (n: string) => void; onToggle: (v: string) => void;
  onAdd: (v: string) => void; onShortcut: (v: string[]) => void; onRemove?: () => void;
}) {
  const { t } = useTranslation('catalogVariations');
  const [value, setValue] = useState('');
  return (
    <Card style={{ gap: 12 }}>
      <Field label={t('optionName')} value={option.name} onChangeText={onName} placeholder={t('optionNamePlaceholder')} autoCapitalize="words" />
      {!option.name.trim() ? (
        <View style={styles.wrap}>
          {OPTION_NAMES.slice(0, 8).map((n) => <Chip key={n} label={n} onPress={() => onName(n)} />)}
        </View>
      ) : null}
      <Text style={styles.label}>{`${t('values')} · ${t('valuesCount', { count: option.values.length })}`}</Text>
      {shortcuts.length ? (
        <View style={styles.wrap}>
          {shortcuts.map((s) => <Chip key={s.label} label={s.label} onPress={() => onShortcut(s.values)} />)}
        </View>
      ) : null}
      <View style={styles.wrap}>
        {suggestions.map((s) => <Chip key={s} label={s} selected={option.values.some((v) => sameName(v, s))} onPress={() => onToggle(s)} />)}
      </View>
      <View style={styles.addRow}>
        <View style={{ flex: 1 }}>
          <Field label={t('addValue')} value={value} onChangeText={setValue} autoCapitalize="none" />
        </View>
        <Button label={t('addValueButton')} variant="soft" compact disabled={!value.trim()} onPress={() => { onAdd(value); setValue(''); }} />
      </View>
      {onRemove ? <Button label={t('removeOption')} variant="ghost" compact onPress={onRemove} /> : null}
    </Card>
  );
}

function RowCard({ row, open, withStock, onToggle, onChange }: { row: VariationRow; open: boolean; withStock: boolean; onToggle: () => void; onChange: (patch: Partial<VariationRow>) => void }) {
  const { t } = useTranslation('catalogVariations');
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <PressableScale onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.rowHead}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={styles.rowName} numberOfLines={2}>{row.name}</Text>
          <View style={styles.wrap}>
            {row.priceCents > 0 ? <Badge label={brl(row.priceCents)} tone="primary" /> : null}
            {withStock && row.stock.trim() ? <Badge label={`${row.stock}`} tone="success" icon="layers" /> : null}
            {!row.active ? <Badge label={t('active')} tone="neutral" /> : null}
            {rowHasData(row) && row.priceCents === 0 && !row.stock.trim() ? <Badge label={t('hasData')} tone="neutral" /> : null}
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </PressableScale>
      {open ? (
        <View style={styles.rowBody}>
          <MoneyField label={t('price')} cents={row.priceCents} onChange={(v) => onChange({ priceCents: v })} />
          <Muted>{t('priceHint')}</Muted>
          <MoneyField label={t('cost')} cents={row.costCents} onChange={(v) => onChange({ costCents: v })} />
          <BarcodeField label={t('sku')} kind="sku" scan={false} value={row.sku} onChange={(v) => onChange({ sku: v })} productName={row.name} />
          <BarcodeField label={t('barcode')} value={row.barcode} onChange={(v) => onChange({ barcode: v })} productName={row.name} />
          {withStock ? (
            <>
              <Field label={t('stock')} value={row.stock} onChangeText={(v) => onChange({ stock: v })} keyboardType="decimal-pad" />
              <Muted>{t('stockHint')}</Muted>
            </>
          ) : null}
          <Field label={t('weight')} value={row.weight} onChangeText={(v) => onChange({ weight: v })} keyboardType="number-pad" />
          <View style={styles.three}>
            <View style={{ flex: 1 }}><Field label={t('height')} value={row.height} onChangeText={(v) => onChange({ height: v })} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label={t('width')} value={row.width} onChangeText={(v) => onChange({ width: v })} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label={t('length')} value={row.length} onChangeText={(v) => onChange({ length: v })} keyboardType="decimal-pad" /></View>
          </View>
          <Text style={styles.label}>{t('photos')}</Text>
          <PhotoStrip photos={row.photos} max={MAX_VARIATION_PHOTOS} onChange={(photos) => onChange({ photos })} />
          <View style={styles.toggle}>
            <Text style={[styles.rowName, { flex: 1 }]}>{t('active')}</Text>
            <Switch value={row.active} onValueChange={(v) => onChange({ active: v })} trackColor={{ true: colors.primary }} accessibilityLabel={t('active')} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function BulkSheet({ visible, withStock, onClose, onApply }: { visible: boolean; withStock: boolean; onClose: () => void; onApply: (priceCents: number, stock: string) => void }) {
  const { t } = useTranslation('catalogVariations');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState('');
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('bulkTitle')} footer={<Button label={t('apply')} onPress={() => onApply(price, stock.trim())} />}>
      <View style={{ gap: 14 }}>
        <Muted>{t('bulkHint')}</Muted>
        <MoneyField label={t('bulkPrice')} cents={price} onChange={setPrice} />
        {withStock ? <Field label={t('bulkStock')} value={stock} onChangeText={setStock} keyboardType="decimal-pad" /> : null}
      </View>
    </BottomSheet>
  );
}

function SaveModelSheet({ visible, onClose, options, hints, onSaved }: { visible: boolean; onClose: () => void; options: Option[]; hints: Draft['hints']; onSaved: () => void }) {
  const { t } = useTranslation('catalogVariations');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => saveVariationModel({ name: name.trim(), options: optionsToSave(options.map((o) => ({ name: o.name, suggestions: hints[o.name]?.suggestions ?? [], values: o.values }))) }),
    onSuccess: () => { onSaved(); setName(''); onClose(); void showDialog({ title: t('modelSaved'), tone: 'success' }); },
    onError: () => setError(t('modelFailed')),
  });
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('saveModel')}
      footer={<View style={{ gap: 8 }}>{error ? <Text style={styles.error}>{error}</Text> : null}<Button label={t('saveModel')} loading={save.isPending} onPress={() => { if (!name.trim()) return setError(t('modelNameRequired')); setError(null); save.mutate(); }} /></View>}>
      <Field label={t('modelName')} value={name} onChangeText={setName} autoCapitalize="sentences" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: typography.fontFamilyBold, fontSize: 20, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  three: { flexDirection: 'row', gap: 10 },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBody: { paddingHorizontal: 14, paddingBottom: 16, gap: 14 },
  rowName: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.pageBg },
  error: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.dangerText },
});
