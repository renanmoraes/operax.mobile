import { api } from './client';
import { appendUpload, type UploadFile } from './upload';

export type StockControl = 'not_tracked' | 'tracked' | 'lot_tracked' | 'serial_tracked';

export type ProductCategory = { id: string; name: string; sort_order?: number };
export async function listProductCategories(): Promise<ProductCategory[]> {
  const { data } = await api.get('/api/apps/products/categories');
  return Array.isArray(data) ? (data as ProductCategory[]) : [];
}

export type CreateProductInput = {
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
  /** Em reais. */
  base_price?: number;
  reference_cost?: number;
  unit_code?: string;
  /** Só vale quando a empresa tem o Estoque. */
  stock_policy?: StockControl;
};
export type CreatedProduct = { id: string; name: string; variants?: { id: string }[] };

export async function createProduct(input: CreateProductInput): Promise<CreatedProduct> {
  const { data } = await api.post('/api/apps/products/items', input);
  return data as CreatedProduct;
}

/** Foto de capa do produto (JPG, PNG ou WebP, até 5 MB). */
export async function uploadProductImage(productId: string, file: UploadFile): Promise<void> {
  const form = new FormData();
  await appendUpload(form, 'file', file);
  await api.post(`/api/apps/products/items/${productId}/image`, form, { timeout: 60_000, headers: { 'Content-Type': 'multipart/form-data' } });
}

/** SKU ou código de barras interno livre, para o produto que não tem. */
export async function generateProductCode(type: 'sku' | 'barcode', name?: string): Promise<string> {
  const { data } = await api.post('/api/apps/products/codes/generate', { type, name });
  return String(data?.code ?? '');
}

export type StockLocation = { id: string; name?: string; is_default?: boolean };
export async function fetchStockLocations(): Promise<StockLocation[]> {
  const { data } = await api.get('/api/apps/inventory-catalog/overview');
  return Array.isArray(data?.locations) ? (data.locations as StockLocation[]) : [];
}

export async function setReorderPoint(productId: string, reorderPoint: number): Promise<void> {
  await api.patch(`/api/apps/inventory-catalog/items/${productId}/stock-settings`, { reorder_point: reorderPoint });
}

export type InboundMovement = {
  variant_id: string;
  quantity: number;
  destination_location_id: string;
  lot_code?: string;
  /** AAAA-MM-DD */
  expires_at?: string;
};
/** Entrada de saldo inicial: nasce como movimento, com rastro. */
export async function registerInitialBalance(input: InboundMovement): Promise<void> {
  await api.post('/api/apps/inventory-catalog/movements', { movement_type: 'inbound', reason_code: 'initial_balance', ...input });
}
