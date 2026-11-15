import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { confirmDialog } from '@/src/design-system/Dialog';
import { Toast, useToast } from '@/src/design-system/Toast';
import { Avatar, Button, EmptyState, IconButton, Loading, PressableScale, Screen, TopBar } from '@/src/design-system/ui';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { RequirePermission, useCan } from '@/src/features/auth/useCan';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import {
  addToCart,
  atualizarPrecos,
  cartTotal,
  cartTotalWithOrderDiscount,
  changeQuantity,
  detalhesDoCarrinho,
  isCartReady,
  removeLine,
  setLineDiscount,
  vendidoEmQuilo,
  type CartLine,
  type DetalheDaLinha,
} from '@/src/features/pos/cart';
import { buildSalePayload, formatMoney, gramsText, keypadNumber, keypadPress, quantityText, uid, type KeypadKey } from '@/src/features/pos/checkout';
import { CheckoutSheet, type CheckoutResult } from '@/src/features/pos/CheckoutSheet';
import { CustomerSheet } from '@/src/features/pos/CustomerSheet';
import { LineDiscountSheet, OrderDiscountSheet } from '@/src/features/pos/DiscountSheet';
import { Keypad, OfferTag, PriceFromTo } from '@/src/features/pos/parts';
import { usePosClient, type PosClient } from '@/src/features/pos/posClient';
import { ReceiptActions } from '@/src/features/pos/ReceiptActions';
import { ScannerModal, type ScanFeedback } from '@/src/features/pos/ScannerModal';
import { WeighSheet } from '@/src/features/pos/WeighSheet';
import { getActiveApps } from '@/src/shared/api/attendance.api';
import { apiMessage, apiStatus, variantFromLabelQr, type PosContact, type PosProduct } from '@/src/shared/api/pos.api';
import { locale } from '@/src/i18n';

type Sheet =
  | { kind: 'weigh'; lineId: string }
  | { kind: 'lineDiscount'; lineId: string }
  | { kind: 'order' }
  | { kind: 'customer' }
  | { kind: 'seller' }
  | { kind: 'checkout' }
  | { kind: 'done'; saleId: string; number: string | null; total: number; contact: PosContact | null }
  | null;

const timeOf = (iso: string) => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export default function PosSaleGuarded() {
  const { t } = useTranslation('pos');
  return (
    <RequirePermission need="posSell" title={t('title')}>
      <PosGate />
    </RequirePermission>
  );
}

/** Com login real, o PDV só abre com o app `pos` instalado na empresa (igual ao web). */
function PosGate() {
  const { t } = useTranslation('pos');
  const { mode } = useAuth();
  const apps = useQuery({ queryKey: ['active-apps'], enabled: mode === 'live', staleTime: 10 * 60_000, queryFn: getActiveApps });
  if (mode === 'live' && apps.isPending) return <Screen><TopBar safe title={t('title')} onBack={() => router.back()} /><Loading /></Screen>;
  if (mode === 'live' && apps.isSuccess && !apps.data.includes('pos')) {
    return (
      <Screen>
        <TopBar safe title={t('title')} onBack={() => router.back()} />
        <EmptyState icon="storefront-outline" title={t('notInstalled')} />
      </Screen>
    );
  }
  return <PosSaleScreen />;
}

function PosSaleScreen() {
  const { t } = useTranslation('pos');
  const { t: tc } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const client = usePosClient();
  const { mode } = useAuth();
  const can = useCan();
  const { toast, show } = useToast(2600);

  const boot = useQuery({ queryKey: ['pos', 'bootstrap', mode], queryFn: () => client.bootstrap() });
  const settings = boot.data?.settings ?? null;
  const usesShift = settings?.shifts_enabled === true;
  const shift = boot.data?.shift ?? null;

  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleKey, setSaleKey] = useState(uid);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [contact, setContact] = useState<PosContact | null>(null);
  const [orderDiscount, setOrderDiscount] = useState<{ type: 'percent' | 'fixed'; value: number } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [scanner, setScanner] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
  const [scanCount, setScanCount] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const searchRef = useRef<TextInputInstance>(null);

  const seller = sellerId ?? boot.data?.operator_user_id ?? null;
  const sellers = boot.data?.sellers ?? [];
  const sellerName = sellers.find((s) => s.id === seller)?.name ?? null;

  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const searching = q.trim().length >= 2 && !/^\d+$/.test(q.trim());
  const results = useQuery({ queryKey: ['pos', 'products', mode, term], queryFn: () => client.searchProducts(term), enabled: term.length >= 2 && !/^\d+$/.test(term) });

  const credit = useQuery({ queryKey: ['pos', 'credit', mode, contact?.id], queryFn: () => client.contactCredit(contact!.id), enabled: !!contact, staleTime: 0 });

  const details = useMemo(() => detalhesDoCarrinho(cart), [cart]);
  const subtotal = useMemo(() => cartTotal(cart), [cart]);
  const total = useMemo(() => cartTotalWithOrderDiscount(cart, orderDiscount?.type ?? null, orderDiscount?.value ?? null), [cart, orderDiscount]);
  const ready = isCartReady(cart);
  const pendingWeigh = cart.filter((l) => l.quantity == null);
  const units = cart.reduce((s, l) => s + (l.is_weighed ? 1 : (l.quantity ?? 0)), 0);

  // O carrinho mais recente, para leituras seguidas da câmera não se atropelarem antes do próximo render.
  const cartRef = useRef<CartLine[]>(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const flash = useCallback((id: string) => {
    setFlashId(id);
    setTimeout(() => setFlashId((v) => (v === id ? null : v)), 900);
  }, []);

  /** Põe no carrinho e diz qual linha entrou (a de peso abre a pesagem). */
  const push = useCallback(
    (product: PosProduct, quantity: number | null): CartLine | null => {
      const next = addToCart(cartRef.current, product, quantity);
      cartRef.current = next;
      setCart(next);
      const added = product.is_weighed ? next[next.length - 1] : (next.find((l) => l.variant_id === product.variant_id) ?? null);
      if (added) flash(added.line_id);
      return added;
    },
    [flash],
  );

  const addFromSearch = (p: PosProduct) => {
    const line = push(p, p.is_weighed ? null : 1);
    setQ('');
    Keyboard.dismiss();
    if (p.is_weighed && line) setSheet({ kind: 'weigh', lineId: line.line_id });
  };

  const resolve = useMutation({
    mutationFn: async (code: string) => {
      const vid = variantFromLabelQr(code);
      if (vid) {
        const [p] = await client.refreshProducts([vid]);
        if (!p) throw Object.assign(new Error('not found'), { response: { status: 404 } });
        return { ...p, quantity: p.is_weighed ? null : 1 };
      }
      return client.resolveBarcode(code);
    },
  });

  const lookup = async (code: string, fromScanner: boolean) => {
    try {
      const p = await resolve.mutateAsync(code);
      const line = push(p, p.quantity ?? (p.is_weighed ? null : 1));
      if (fromScanner) {
        setScanCount((n) => n + 1);
        setScanFeedback({ text: p.is_weighed && p.quantity == null ? t('scanner.addedWeighed', { name: p.name }) : t('scanner.added', { name: p.name }), tone: p.is_weighed && p.quantity == null ? 'warn' : 'ok' });
      } else {
        setQ('');
        if (p.is_weighed && p.quantity == null && line) setSheet({ kind: 'weigh', lineId: line.line_id });
      }
    } catch (e) {
      const msg = apiStatus(e) === 404 ? t('search.notFound', { code }) : (apiMessage(e) ?? t('search.failed'));
      if (fromScanner) setScanFeedback({ text: msg, tone: 'error' });
      else show(msg, 'error');
    }
  };

  const submitSearch = () => {
    const raw = q.trim();
    if (!raw) return;
    if (/^\d+$/.test(raw) || variantFromLabelQr(raw)) return void lookup(raw, false);
    const list = results.data ?? [];
    const exact = list.filter((p) => p.barcode?.toLowerCase() === raw.toLowerCase() || p.sku?.toLowerCase() === raw.toLowerCase());
    const pick = exact.length === 1 ? exact[0] : list.length === 1 ? list[0] : null;
    if (pick) addFromSearch(pick);
  };

  const closeScanner = () => {
    setScanner(false);
    setScanFeedback(null);
    setScanCount(0);
    // O que veio da câmera e ainda não foi pesado abre a pesagem na sequência.
    const first = cartRef.current.find((l) => l.quantity == null);
    if (first) setTimeout(() => setSheet({ kind: 'weigh', lineId: first.line_id }), 350);
  };

  const clearCart = async () => {
    const ok = await confirmDialog({ title: t('cart.clearTitle'), message: t('cart.clearText'), confirmLabel: t('cart.clear'), tone: 'danger', icon: 'trash-outline' });
    if (!ok) return;
    setCart([]);
    setOrderDiscount(null);
  };

  const reread = async (cur: CartLine[]) => {
    try {
      return atualizarPrecos(cur, await client.refreshProducts(cur.map((l) => l.variant_id)));
    } catch {
      return { cart: cur, mudou: false };
    }
  };

  const [opening, setOpening] = useState(false);
  const openCheckout = async () => {
    setOpening(true);
    setCheckoutError(null);
    const { cart: fresh, mudou } = await reread(cart);
    setOpening(false);
    if (mudou) {
      setCart(fresh);
      show(t('cart.pricesChanged'), 'info');
    }
    setSheet({ kind: 'checkout' });
  };

  const finish = useMutation({
    mutationFn: (r: CheckoutResult) =>
      client.createSale(
        buildSalePayload({
          saleKey,
          cart,
          sellerId: seller,
          contactId: contact?.id ?? null,
          registerId: boot.data?.default_register_id ?? null,
          orderDiscount,
          payments: r.payments,
          installments: r.installments,
          firstDueDate: r.firstDueDate,
        }),
      ),
    onSuccess: (sale) => {
      setSheet({ kind: 'done', saleId: sale.id, number: sale.human_number ?? null, total, contact });
      setCart([]);
      setSaleKey(uid());
      setOrderDiscount(null);
      setContact(null);
      void qc.invalidateQueries({ queryKey: ['pos', 'sales'] });
      if (usesShift) void qc.invalidateQueries({ queryKey: ['pos', 'bootstrap'] });
    },
    onError: async (e) => {
      const { cart: fresh, mudou } = await reread(cart);
      if (mudou) {
        setCart(fresh);
        setSheet(null);
        show(t('checkout.pricesChanged'), 'error');
        return;
      }
      setCheckoutError(apiMessage(e) ?? t('checkout.failed'));
    },
  });

  if (boot.isPending) {
    return (
      <Screen>
        <TopBar safe title={t('title')} onBack={() => router.back()} />
        <Loading />
      </Screen>
    );
  }
  if (boot.isError) {
    return (
      <Screen>
        <TopBar safe title={t('title')} onBack={() => router.back()} />
        <EmptyState icon="cloud-offline-outline" title={t('search.failed')} actionLabel={tc('actions.retry')} onAction={() => void boot.refetch()} />
      </Screen>
    );
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <View style={styles.headerRow}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel={tc('actions.back')} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('title')}</Text>
          {usesShift && shift ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {t('shift.open', { name: shift.register_name ?? '', time: timeOf(shift.opened_at) })} · {t('shift.sales', { count: shift.sales_count })}
            </Text>
          ) : null}
        </View>
        {can('posRead') ? <IconButton icon="receipt-outline" onPress={() => router.push('/pdv/vendas' as never)} accessibilityLabel={t('salesOfDay')} /> : null}
      </View>
    </View>
  );

  if (usesShift && !shift) {
    return (
      <Screen>
        {header}
        <ShiftClosed client={client} registerId={boot.data?.default_register_id ?? null} canOpen={can('posShiftsOpen')} onOpened={() => { show(t('shift.opened')); void qc.invalidateQueries({ queryKey: ['pos', 'bootstrap'] }); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={19} color={colors.textMuted} />
          <TextInput
            ref={searchRef}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder={t('search.placeholder')}
            placeholderTextColor="#6b7486"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.searchInput}
            accessibilityLabel={t('search.placeholder')}
          />
          {resolve.isPending && !scanner ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          {q ? <IconButton icon="close-circle" size={32} onPress={() => setQ('')} accessibilityLabel={tc('actions.close')} /> : null}
        </View>
        <PressableScale onPress={() => setScanner(true)} accessibilityRole="button" accessibilityLabel={t('search.scan')} style={styles.scanBtn} scaleTo={0.92}>
          <Ionicons name="barcode-outline" size={26} color="#fff" />
        </PressableScale>
      </View>

      <View style={styles.chips}>
        <PressableScale onPress={() => setSheet({ kind: 'customer' })} accessibilityRole="button" style={[styles.chip, contact && styles.chipOn]}>
          {contact ? <Avatar initials={initialsOf(contact.name)} size={22} /> : <Ionicons name="person-outline" size={15} color={colors.textSoft} />}
          <Text style={[styles.chipText, contact && { color: colors.primaryDeep }]} numberOfLines={1}>
            {contact ? contact.name : t('customer.walkIn')}
          </Text>
          <Ionicons name="chevron-down" size={14} color={contact ? colors.primaryDeep : colors.textMuted} />
        </PressableScale>
        {sellers.length > 1 ? (
          <PressableScale onPress={() => setSheet({ kind: 'seller' })} accessibilityRole="button" style={styles.chip}>
            <Ionicons name="ribbon-outline" size={15} color={colors.textSoft} />
            <Text style={styles.chipText} numberOfLines={1}>
              {sellerName ?? t('customer.seller')}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </PressableScale>
        ) : null}
      </View>

      {searching ? (
        <SearchResults loading={results.isFetching} items={results.data ?? []} term={term} onPick={addFromSearch} />
      ) : cart.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyArt}>
            <Ionicons name="scan-outline" size={52} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
          <Text style={styles.emptyText}>{t('cart.emptyHint')}</Text>
          <Button label={t('cart.openCamera')} icon="camera-outline" onPress={() => setScanner(true)} style={{ alignSelf: 'stretch', marginTop: 6 }} />
        </View>
      ) : (
        <FlatList
          data={cart}
          keyExtractor={(l) => l.line_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <CartRow
              line={item}
              detail={details.get(item.line_id)}
              flash={flashId === item.line_id}
              canDiscount={can('posDiscountLine') || can('posPriceOverride')}
              onWeigh={() => setSheet({ kind: 'weigh', lineId: item.line_id })}
              onQty={(qty) => setCart((c) => changeQuantity(c, item.line_id, qty))}
              onDiscount={() => setSheet({ kind: 'lineDiscount', lineId: item.line_id })}
              onRemove={() => setCart((c) => removeLine(c, item.line_id))}
            />
          )}
        />
      )}

      {cart.length > 0 && !searching ? (
        <View style={[styles.register, { paddingBottom: insets.bottom + 14 }]}>
          {pendingWeigh.length ? (
            <Pressable onPress={() => setSheet({ kind: 'weigh', lineId: pendingWeigh[0].line_id })} accessibilityRole="button" style={styles.weighAlert}>
              <Ionicons name="scale-outline" size={16} color="#fdba74" />
              <Text style={styles.weighAlertText}>{t('cart.weighHint')}</Text>
            </Pressable>
          ) : null}
          <View style={styles.registerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.registerLabel}>{t('cart.items', { count: units })}</Text>
                {can('posDiscountOrder') ? (
                  <Pressable onPress={() => setSheet({ kind: 'order' })} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.registerLink}>
                      {orderDiscount ? `− ${orderDiscount.type === 'percent' ? `${quantityText(orderDiscount.value)}%` : formatMoney(orderDiscount.value)}` : t('discount.orderButton')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <PriceFromTo big light from={subtotal > total ? formatMoney(subtotal) : null} to={formatMoney(total)} />
            </View>
            <IconButton icon="trash-outline" tone="glass" onPress={() => void clearCart()} accessibilityLabel={t('cart.clear')} />
          </View>
          <PressableScale onPress={() => void openCheckout()} disabled={!ready || opening} accessibilityRole="button" style={[styles.receive, (!ready || opening) && { opacity: 0.45 }]}>
            {opening ? <ActivityIndicator color={colors.chromeNavy} /> : <Ionicons name="wallet-outline" size={20} color={colors.chromeNavy} />}
            <Text style={styles.receiveText}>{t('checkout.receive')}</Text>
          </PressableScale>
        </View>
      ) : null}

      <ScannerModal visible={scanner} onClose={closeScanner} onCode={(c) => void lookup(c, true)} feedback={scanFeedback} count={scanCount} />

      {sheet?.kind === 'weigh' ? (
        <WeighSheet
          key={sheet.lineId}
          cart={cart}
          lineId={sheet.lineId}
          onClose={() => setSheet(null)}
          onRemove={() => {
            setCart((c) => removeLine(c, sheet.lineId));
            setSheet(null);
          }}
          onApply={(qty) => {
            setCart((c) => changeQuantity(c, sheet.lineId, qty));
            const next = cart.find((l) => l.quantity == null && l.line_id !== sheet.lineId);
            setSheet(next ? { kind: 'weigh', lineId: next.line_id } : null);
          }}
        />
      ) : null}
      {sheet?.kind === 'lineDiscount' ? (
        <LineDiscountSheet
          cart={cart}
          lineId={sheet.lineId}
          canDiscount={can('posDiscountLine')}
          canOverride={can('posPriceOverride')}
          onClose={() => setSheet(null)}
          onApply={(type, value) => {
            setCart((c) => setLineDiscount(c, sheet.lineId, type, value));
            setSheet(null);
          }}
        />
      ) : null}
      {sheet?.kind === 'order' ? (
        <OrderDiscountSheet
          cart={cart}
          current={orderDiscount}
          maxPercent={settings?.max_discount_percent_without_approval ?? null}
          onClose={() => setSheet(null)}
          onApply={(d) => {
            setOrderDiscount(d);
            setSheet(null);
          }}
        />
      ) : null}
      {sheet?.kind === 'customer' ? (
        <CustomerSheet
          client={client}
          current={contact}
          canCreate={can('contactsCreate')}
          canConsent={can('complianceWrite')}
          canUploadDocument={can('contactsUpdate')}
          onClose={() => setSheet(null)}
          onPick={(c, warning) => {
            setContact(c);
            setSheet(null);
            if (warning) show(warning, 'info');
          }}
        />
      ) : null}
      {sheet?.kind === 'seller' ? (
        <BottomSheet visible onClose={() => setSheet(null)} title={t('customer.sellerTitle')}>
          {sellers.map((s) => (
            <Pressable key={s.id} onPress={() => { setSellerId(s.id); setSheet(null); }} accessibilityRole="button" style={styles.sellerRow}>
              <Avatar initials={initialsOf(s.name)} size={36} />
              <Text style={[styles.chipText, { flex: 1, fontSize: 15 }]}>{s.name}</Text>
              {s.id === seller ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </BottomSheet>
      ) : null}
      {sheet?.kind === 'checkout' ? (
        <CheckoutSheet
          total={total}
          subtotal={subtotal}
          hasContact={!!contact}
          onAccountEnabled={settings?.on_account_enabled !== false}
          creditCents={contact ? (credit.data?.balance_cents ?? 0) : 0}
          pending={finish.isPending}
          error={checkoutError}
          onClose={() => setSheet(null)}
          onConfirm={(r) => {
            setCheckoutError(null);
            finish.mutate(r);
          }}
        />
      ) : null}
      {sheet?.kind === 'done' ? (
        <BottomSheet visible onClose={() => setSheet(null)}>
          <Animated.View entering={FadeIn.duration(220)} style={styles.done}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={34} color="#fff" />
            </View>
            <Text style={styles.doneTitle}>{t('done.title')}</Text>
            <Text style={styles.doneSub}>
              {sheet.number ? `${t('done.number', { number: sheet.number })} · ` : ''}
              {formatMoney(sheet.total)}
            </Text>
          </Animated.View>
          <ReceiptActions client={client} saleId={sheet.saleId} contact={sheet.contact} onMessage={(m, tone) => show(m, tone)} />
          <Button label={t('done.newSale')} icon="add" onPress={() => { setSheet(null); searchRef.current?.focus(); }} />
        </BottomSheet>
      ) : null}

      <Toast toast={toast} top={insets.top + 64} />
    </Screen>
  );
}

function SearchResults({ loading, items, term, onPick }: { loading: boolean; items: PosProduct[]; term: string; onPick: (p: PosProduct) => void }) {
  const { t } = useTranslation('pos');
  if (loading && !items.length) return <Loading />;
  if (!items.length && term.length >= 2 && !loading) return <EmptyState icon="search-outline" title={t('search.none')} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(p) => p.variant_id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
      renderItem={({ item: p }) => (
        <PressableScale onPress={() => onPick(p)} accessibilityRole="button" style={styles.result}>
          <View style={styles.resultIcon}>
            <Ionicons name={p.is_weighed ? 'scale-outline' : 'cube-outline'} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.lineName} numberOfLines={1}>
              {p.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.lineMeta}>{p.sku ?? t('search.noCode')}</Text>
              {p.offer ? <OfferTag label={p.offer.label} /> : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <PriceFromTo from={p.offer && p.list_price != null && p.list_price > p.unit_price ? formatMoney(p.list_price) : null} to={formatMoney(p.unit_price)} />
            {p.is_weighed ? <Text style={styles.lineMeta}>{t('search.perUnit', { unit: p.unit_code })}</Text> : null}
          </View>
        </PressableScale>
      )}
    />
  );
}

function CartRow({
  line,
  detail,
  flash,
  canDiscount,
  onWeigh,
  onQty,
  onDiscount,
  onRemove,
}: {
  line: CartLine;
  detail?: DetalheDaLinha;
  flash: boolean;
  canDiscount: boolean;
  onWeigh: () => void;
  onQty: (q: number) => void;
  onDiscount: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('pos');
  const kg = vendidoEmQuilo(line);
  const net = detail?.liquido ?? 0;
  const from = detail?.emOferta ? detail.tabela : line.discount_type && line.discount_value != null ? (detail?.bruto ?? 0) : 0;
  const unitText = detail?.dividida
    ? detail.partes.map((p) => `${quantityText(p.quantity)} ${line.unit_code} × ${formatMoney(p.unit_price)}`).join(' + ')
    : `${formatMoney(detail?.partes[0]?.unit_price ?? line.unit_price)} / ${line.unit_code}`;
  return (
    <Animated.View layout={LinearTransition.duration(200)} entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={[styles.line, flash && styles.lineFlash]}>
      <View style={styles.lineTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.lineName} numberOfLines={2}>
            {line.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
            {detail?.rotulo ? <OfferTag label={detail.rotulo} /> : null}
            {line.discount_type ? (
              <View style={styles.discTag}>
                <Ionicons name="pricetags-outline" size={10} color={colors.primaryDeep} />
              </View>
            ) : null}
            <Text style={styles.lineMeta} numberOfLines={2}>
              {unitText}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {line.quantity != null ? <PriceFromTo from={from > net ? formatMoney(from) : null} to={formatMoney(net)} /> : null}
        </View>
      </View>
      <View style={styles.lineBottom}>
        {line.is_weighed ? (
          <PressableScale onPress={onWeigh} accessibilityRole="button" style={[styles.weighBtn, line.quantity == null && styles.weighBtnNeed]}>
            <Ionicons name="scale-outline" size={16} color={line.quantity == null ? colors.warnText : colors.primaryDeep} />
            <Text style={[styles.weighText, line.quantity == null && { color: colors.warnText }]}>
              {line.quantity == null ? t('cart.needWeigh') : kg ? `${gramsText(line.quantity)} g` : `${quantityText(line.quantity)} ${line.unit_code}`}
            </Text>
          </PressableScale>
        ) : (
          <QtyStepper value={line.quantity ?? 1} onChange={onQty} />
        )}
        <View style={{ flex: 1 }} />
        {canDiscount ? <IconButton icon="pricetag-outline" size={38} onPress={onDiscount} accessibilityLabel={t('cart.discount', { name: line.name })} tone={line.discount_type ? 'soft' : 'light'} /> : null}
        <IconButton icon="trash-outline" size={38} onPress={onRemove} accessibilityLabel={t('cart.remove', { name: line.name })} />
      </View>
    </Animated.View>
  );
}

/** − 3 + ; tocar no número abre um teclado para digitar a quantidade de uma vez. */
function QtyStepper({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  const { t } = useTranslation('pos');
  const [typing, setTyping] = useState<string | null>(null);
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(value - 1)} accessibilityRole="button" accessibilityLabel={t('cart.less')} style={styles.stepBtn} hitSlop={6}>
        <Ionicons name={value <= 1 ? 'trash-outline' : 'remove'} size={18} color={colors.text} />
      </Pressable>
      <Pressable onPress={() => setTyping('')} accessibilityRole="button" style={styles.stepNum}>
        <Text style={styles.stepNumText}>{value}</Text>
      </Pressable>
      <Pressable onPress={() => onChange(value + 1)} accessibilityRole="button" accessibilityLabel={t('cart.more')} style={styles.stepBtn} hitSlop={6}>
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
      {typing != null ? (
        <BottomSheet visible onClose={() => setTyping(null)}>
          <View style={styles.qtyDisplay}>
            <Text style={styles.qtyDisplayText}>{typing || String(value)}</Text>
          </View>
          <Keypad decimals={0} onKey={(k: KeypadKey) => setTyping((v) => keypadPress(v ?? '', k, 0, 4))} />
          <Button
            label={t('weigh.done')}
            icon="checkmark"
            onPress={() => {
              const n = keypadNumber(typing ?? '');
              if (n != null) onChange(n);
              setTyping(null);
            }}
          />
        </BottomSheet>
      ) : null}
    </View>
  );
}

/** Empresa que vende com caixa: sem turno aberto, abrir com o dinheiro da gaveta. */
function ShiftClosed({ client, registerId, canOpen, onOpened }: { client: PosClient; registerId: string | null; canOpen: boolean; onOpened: () => void }) {
  const { t } = useTranslation('pos');
  const [raw, setRaw] = useState('');
  const open = useMutation({ mutationFn: () => client.openShift(registerId!, keypadNumber(raw) ?? 0), onSuccess: onOpened });
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
      <View style={styles.shiftCard}>
        <Ionicons name="lock-closed-outline" size={22} color={colors.warnText} />
        <View style={{ flex: 1 }}>
          <Text style={styles.lineName}>{t('shift.closedTitle')}</Text>
          <Text style={styles.lineMeta}>{canOpen ? t('shift.closedText') : t('shift.noPermission')}</Text>
        </View>
      </View>
      {canOpen && registerId ? (
        <>
          <View style={[styles.qtyDisplay, { alignItems: 'flex-end' }]}>
            <Text style={styles.registerLabel}>{t('shift.openingCash')}</Text>
            <Text style={styles.qtyDisplayText}>R$ {raw || '0'}</Text>
          </View>
          <Keypad decimals={2} onKey={(k) => setRaw((v) => keypadPress(v, k, 2, 6))} />
          {open.isError ? <Text style={[styles.lineMeta, { color: colors.dangerText }]}>{apiMessage(open.error) ?? t('shift.failed')}</Text> : null}
          <Button label={t('shift.openButton')} icon="lock-open-outline" loading={open.isPending} onPress={() => open.mutate()} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontFamily: typography.fontFamilyBold, fontSize: 21, color: colors.text, letterSpacing: -0.5 },
  headerSub: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  searchWrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, alignItems: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingLeft: 16, paddingRight: 8, borderRadius: radii.control, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  searchInput: { flex: 1, fontFamily: typography.fontFamily, fontSize: 16, color: colors.text, paddingVertical: 0 },
  scanBtn: { width: 54, height: 54, borderRadius: radii.control, backgroundColor: colors.chromeNavy, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, maxWidth: 220 },
  chipOn: { backgroundColor: colors.primaryWash, borderColor: colors.primaryTint },
  chipText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.textSoft, flexShrink: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 8, marginTop: -40 },
  emptyArt: { width: 104, height: 104, borderRadius: 34, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: colors.primaryTint, borderStyle: 'dashed' },
  emptyTitle: { fontFamily: typography.fontFamilyBold, fontSize: 19, color: colors.text },
  emptyText: { fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 21, color: colors.textMuted, textAlign: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderSoft },
  resultIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  line: { padding: 14, borderRadius: radii.lg, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderSoft, gap: 12, ...shadows.card },
  lineFlash: { borderColor: colors.success, backgroundColor: '#f2fbf5' },
  lineTop: { flexDirection: 'row', gap: 12 },
  lineName: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, lineHeight: 20, color: colors.text },
  lineMeta: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, fontVariant: ['tabular-nums'], flexShrink: 1 },
  discTag: { width: 18, height: 18, borderRadius: 5, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  lineBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weighBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.primaryWash },
  weighBtnNeed: { backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: '#fed7aa' },
  weighText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.primaryDeep, fontVariant: ['tabular-nums'] },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: radii.pill, backgroundColor: '#f1f4fa' },
  stepBtn: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepNum: { minWidth: 34, alignItems: 'center' },
  stepNumText: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  register: { paddingHorizontal: 18, paddingTop: 14, backgroundColor: colors.chromeNavy, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12, ...shadows.hero },
  weighAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md, backgroundColor: 'rgba(253,186,116,0.12)' },
  weighAlertText: { fontFamily: typography.fontFamilyMedium, fontSize: 13, color: '#fdba74', flex: 1 },
  registerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  registerLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: colors.cyan, letterSpacing: 1, textTransform: 'uppercase' },
  registerLink: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  receive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: radii.control, backgroundColor: colors.cyan },
  receiveText: { fontFamily: typography.fontFamilyBold, fontSize: 17, color: colors.chromeNavy, letterSpacing: -0.2 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  done: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  doneTitle: { fontFamily: typography.fontFamilyBold, fontSize: 21, color: colors.text, letterSpacing: -0.4 },
  doneSub: { fontFamily: typography.fontFamilyMedium, fontSize: 15, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  shiftCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.warnSoft },
  qtyDisplay: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radii.lg, backgroundColor: colors.chromeNavy, alignItems: 'flex-end' },
  qtyDisplayText: { fontFamily: typography.fontFamilyBold, fontSize: 40, color: '#fff', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
});
