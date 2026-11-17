import { api } from './client';
import { appendUpload, type UploadFile } from './upload';

export type StockControl = 'not_tracked' | 'tracked' | 'lot_tracked' | 'serial_tracked';

export type ProductCategory = { id: string; name: string; sort_order?: number };
export async function listProductCategories(): Promise<ProductCategory[]> {
  const { data } = await api.get('/api/apps/products/categories');
  return Array.isArray(data) ? (data as ProductCategory[]) : [];
}

export type ProductCondition = 'new' | 'used' | 'refurbished';

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
  fiscal_ncm?: string;
  fiscal_cest?: string;
  fiscal_origem?: number;
  fiscal_cfop?: string;
  fiscal_cst_csosn?: string;
};

/** O que só existe como edição: o produto nasce comum e estes dados entram logo depois. */
export type ProductComplement = {
  brand_name?: string | null;
  product_condition?: ProductCondition;
  weight_grams?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;
  show_in_workflow?: boolean;
  is_member_plan?: boolean;
};
export async function updateProduct(id: string, body: ProductComplement): Promise<void> {
  await api.patch(`/api/apps/products/items/${id}`, body);
}
export type CreatedProduct = { id: string; name: string; variants?: { id: string; name?: string }[] };

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

/** Foto extra do produto (a galeria, depois da capa). */
export async function uploadProductExtraImage(productId: string, file: UploadFile): Promise<void> {
  const form = new FormData();
  await appendUpload(form, 'file', file);
  await api.post(`/api/apps/products/items/${productId}/extra-image`, form, { timeout: 60_000, headers: { 'Content-Type': 'multipart/form-data' } });
}

// ── Variações ────────────────────────────────────────────────────────────────

export type GridAnswer = { criadas: number; item: { variants: { id: string; name: string }[] } };
/** Cria todas as combinações das opções de uma vez (produto simples vira produto com variações). */
export async function createVariantGrid(productId: string, attributes: { name: string; values: string[] }[]): Promise<GridAnswer> {
  const { data } = await api.post(`/api/apps/products/items/${productId}/variants/grid`, { attributes });
  return data as GridAnswer;
}

export type VariantEdit = {
  sku?: string;
  barcode?: string | null;
  sale_price?: number | null;
  reference_cost?: number | null;
  status?: 'active' | 'inactive';
  weight_grams?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;
};
/** O que mudou em várias variações do mesmo produto, numa ida só. */
export async function editVariants(productId: string, variants: (VariantEdit & { id: string })[]): Promise<{ gravadas: number; falhas: { id: string; message: string }[] }> {
  const { data } = await api.patch(`/api/apps/products/items/${productId}/variants`, { variants });
  return { gravadas: data?.gravadas ?? 0, falhas: data?.falhas ?? [] };
}

export async function deleteVariant(productId: string, variantId: string): Promise<void> {
  await api.delete(`/api/apps/products/items/${productId}/variants/${variantId}`);
}

export async function uploadVariantImage(productId: string, variantId: string, file: UploadFile): Promise<void> {
  const form = new FormData();
  await appendUpload(form, 'file', file);
  await api.post(`/api/apps/products/items/${productId}/variants/${variantId}/image`, form, { timeout: 60_000, headers: { 'Content-Type': 'multipart/form-data' } });
}
export async function uploadVariantExtraImage(productId: string, variantId: string, file: UploadFile): Promise<void> {
  const form = new FormData();
  await appendUpload(form, 'file', file);
  await api.post(`/api/apps/products/items/${productId}/variants/${variantId}/extra-image`, form, { timeout: 60_000, headers: { 'Content-Type': 'multipart/form-data' } });
}

/** Saldo de várias variações do mesmo produto numa transação só. */
export async function stockEntryBySize(productId: string, rows: { variant_id: string; quantity: number }[], reason = 'Saldo inicial por variação'): Promise<void> {
  await api.post(`/api/apps/inventory-catalog/items/${productId}/stock-entry`, { rows, reason_text: reason });
}

export type VariationModelDto = { id: string; name: string; options: { name: string; values: string[] }[] };
export async function listVariationModels(): Promise<VariationModelDto[]> {
  const { data } = await api.get('/api/apps/products/variation-models');
  return Array.isArray(data) ? (data as VariationModelDto[]) : [];
}
export async function saveVariationModel(body: { name: string; options: { name: string; values: string[] }[] }): Promise<VariationModelDto> {
  const { data } = await api.post('/api/apps/products/variation-models', body);
  return data as VariationModelDto;
}

/** Produto que já usa este código (SKU ou código de barras), para avisar antes de cadastrar repetido. */
export async function findByCode(code: string): Promise<{ id: string; name: string } | null> {
  const { data } = await api.get('/api/apps/products/items', { params: { q: code, page_size: 5 } });
  const rows = (Array.isArray(data?.rows) ? data.rows : []) as { id: string; name: string; sku?: string | null; barcode?: string | null }[];
  const norm = code.trim().toUpperCase();
  const hit = rows.find((r) => (r.barcode ?? '').trim().toUpperCase() === norm || (r.sku ?? '').trim().toUpperCase() === norm);
  return hit ? { id: hit.id, name: hit.name } : null;
}
