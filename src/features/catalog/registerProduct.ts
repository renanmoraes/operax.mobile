import {
  createProduct, createVariantGrid, deleteVariant, editVariants, fetchStockLocations, registerInitialBalance, setReorderPoint, stockEntryBySize, updateProduct,
  uploadProductExtraImage, uploadProductImage, uploadVariantExtraImage, uploadVariantImage, type CreatedProduct, type VariantEdit,
} from '@/src/shared/api/catalog.api';
import { acceptsInitialBalance, complementOf, expiryIso, hasVariations, INITIAL_LOT, parseQty, toCreateInput, type Draft } from './newProduct';
import { gridAttributes, keyOf, variantFields } from './variations';

/** O que não entrou depois de o produto existir. O produto não falha por isso: reabrir a tela criaria outro igual. */
export type Warning = { code: 'variations' | 'variationFields' | 'variationExtra' | 'variationPhotos' | 'variationStock' | 'complement' | 'photos' | 'reorder' | 'balance'; name?: string; detail?: string };
export type Registered = { product: CreatedProduct; warnings: Warning[] };

export type RegisterOptions = {
  /** O app Associados está instalado (só então "é plano de associado" vale). */
  associates: boolean;
  /** Pode ver e gravar custo (`products:manage` ou `inventory:read`). */
  canSeeCost: boolean;
};

const messageOf = (e: unknown): string => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  const text = Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : '';
  return text.trim();
};

/**
 * Cria o produto e tudo o que depende dele existir, na mesma ordem do Operax web: variações (grade, campos de cada uma,
 * fotos e saldo), dados que só existem como edição (marca, condição, medidas, fluxo, plano), fotos do produto,
 * ponto de reposição e saldo inicial. O saldo entra como movimento de entrada no local padrão, com rastro.
 */
export async function registerProduct(d: Draft, opts: RegisterOptions): Promise<Registered> {
  const product = await createProduct(toCreateInput(d));
  const warnings: Warning[] = [];
  const withRows = hasVariations(d);

  if (withRows) await applyVariations(product, d, opts, warnings);

  const complement = complementOf(d, { associates: opts.associates });
  if (Object.keys(complement).length > 0) {
    try {
      await updateProduct(product.id, complement);
    } catch {
      warnings.push({ code: 'complement' });
    }
  }

  try {
    if (d.cover) await uploadProductImage(product.id, d.cover);
    for (const photo of d.gallery) await uploadProductExtraImage(product.id, photo);
  } catch (e) {
    warnings.push({ code: 'photos', detail: messageOf(e) });
  }

  if (!d.withStock) return { product, warnings };

  const point = parseQty(d.reorder);
  if (point != null && point >= 0 && d.reorder.trim()) {
    try {
      await setReorderPoint(product.id, point);
    } catch (e) {
      warnings.push({ code: 'reorder', detail: messageOf(e) });
    }
  }

  // Com variações, o saldo de cada uma já entrou junto com elas.
  if (withRows) return { product, warnings };
  const qty = parseQty(d.initialQty);
  const variantId = product.variants?.[0]?.id;
  if (acceptsInitialBalance(d.control) && qty && qty > 0 && variantId) {
    try {
      const locations = await fetchStockLocations();
      const where = locations.find((l) => l.is_default) ?? locations[0];
      if (!where) throw new Error('sem local');
      const expires = expiryIso(d);
      await registerInitialBalance({
        variant_id: variantId,
        quantity: qty,
        destination_location_id: where.id,
        ...(expires ? { lot_code: INITIAL_LOT, expires_at: expires } : {}),
      });
    } catch (e) {
      warnings.push({ code: 'balance', detail: messageOf(e) });
    }
  }
  return { product, warnings };
}

async function applyVariations(product: CreatedProduct, d: Draft, opts: RegisterOptions, warnings: Warning[]): Promise<void> {
  const idByKey = new Map<string, string>();
  const wanted = new Set(d.rows.map((r) => r.key));

  try {
    const answer = await createVariantGrid(product.id, gridAttributes(d.options, d.rows));
    for (const v of answer.item.variants) {
      const key = keyOf(v.name);
      if (wanted.has(key)) idByKey.set(key, v.id);
    }
    // A grade cria todas as combinações; a que a pessoa tirou antes de salvar sai agora.
    const extras = answer.item.variants.filter((v) => !wanted.has(keyOf(v.name)) && keyOf(v.name) !== 'padrao');
    for (const v of extras) {
      try {
        await deleteVariant(product.id, v.id);
      } catch (e) {
        warnings.push({ code: 'variationExtra', name: v.name, detail: messageOf(e) });
      }
    }
  } catch (e) {
    warnings.push({ code: 'variations', detail: messageOf(e) });
    return;
  }

  // O que cada variação leva além do nome (preço, custo, SKU, código, peso e medidas), numa ida só. As desativadas saem aqui também.
  const batch: (VariantEdit & { id: string })[] = [];
  for (const r of d.rows) {
    const id = idByKey.get(r.key);
    if (!id) continue;
    const fields: VariantEdit = { ...variantFields(r, opts.canSeeCost), ...(r.active ? {} : { status: 'inactive' as const }) };
    if (Object.keys(fields).length > 0) batch.push({ id, ...fields });
  }
  if (batch.length > 0) {
    try {
      const answer = await editVariants(product.id, batch);
      for (const f of answer.falhas) {
        const row = d.rows.find((r) => idByKey.get(r.key) === f.id);
        warnings.push({ code: 'variationFields', name: row?.name, detail: f.message });
      }
    } catch (e) {
      warnings.push({ code: 'variationFields', detail: messageOf(e) });
    }
  }

  for (const r of d.rows) {
    const id = idByKey.get(r.key);
    if (!id || r.photos.length === 0) continue;
    try {
      const [cover, ...rest] = r.photos;
      await uploadVariantImage(product.id, id, cover);
      for (const photo of rest) await uploadVariantExtraImage(product.id, id, photo);
    } catch (e) {
      warnings.push({ code: 'variationPhotos', name: r.name, detail: messageOf(e) });
    }
  }

  if (d.withStock && d.control === 'tracked') {
    const rows = d.rows
      .map((r) => ({ variant_id: idByKey.get(r.key) ?? '', quantity: parseQty(r.stock) ?? 0 }))
      .filter((r) => r.variant_id && r.quantity > 0);
    if (rows.length > 0) {
      try {
        await stockEntryBySize(product.id, rows);
      } catch (e) {
        warnings.push({ code: 'variationStock', detail: messageOf(e) });
      }
    }
  }
}
