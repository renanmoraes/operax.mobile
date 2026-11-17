import {
  createProduct, fetchStockLocations, registerInitialBalance, setReorderPoint, uploadProductImage,
  type CreatedProduct,
} from '@/src/shared/api/catalog.api';
import type { UploadFile } from '@/src/shared/api/upload';
import { acceptsInitialBalance, expiryIso, INITIAL_LOT, parseQty, toCreateInput, type Draft } from './newProduct';

export type Warning = 'photo' | 'reorder' | 'balance';
export type Registered = { product: CreatedProduct; warnings: Warning[] };

/**
 * Cria o produto e o que depende dele existir: foto, ponto de reposição e saldo inicial.
 * O produto nunca falha por causa do resto: reabrir a tela criaria outro igual, então o que não entrou vira aviso.
 * O saldo entra como movimento de entrada no local padrão, igual ao Operax web.
 */
export async function registerProduct(draft: Draft, photo: UploadFile | null): Promise<Registered> {
  const product = await createProduct(toCreateInput(draft));
  const warnings: Warning[] = [];

  if (photo) {
    try {
      await uploadProductImage(product.id, photo);
    } catch {
      warnings.push('photo');
    }
  }
  if (!draft.withStock) return { product, warnings };

  const point = parseQty(draft.reorder);
  if (point != null && point >= 0 && draft.reorder.trim()) {
    try {
      await setReorderPoint(product.id, point);
    } catch {
      warnings.push('reorder');
    }
  }

  const qty = parseQty(draft.initialQty);
  const variantId = product.variants?.[0]?.id;
  if (acceptsInitialBalance(draft.control) && qty && qty > 0 && variantId) {
    try {
      const locations = await fetchStockLocations();
      const where = locations.find((l) => l.is_default) ?? locations[0];
      if (!where) throw new Error('sem local');
      const expires = expiryIso(draft);
      await registerInitialBalance({
        variant_id: variantId,
        quantity: qty,
        destination_location_id: where.id,
        ...(expires ? { lot_code: INITIAL_LOT, expires_at: expires } : {}),
      });
    } catch {
      warnings.push('balance');
    }
  }
  return { product, warnings };
}
