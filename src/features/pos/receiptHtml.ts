import type { PosReceipt } from '@/src/shared/api/pos.api';
import { formatMoney, quantityText } from './checkout';
import { locale } from '@/src/i18n';

type T = (key: string, opts?: Record<string, unknown>) => string;

const esc = (s: string | number | null | undefined) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const dateOnly = (ymd: string) => new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${ymd}T12:00:00`));

/**
 * Comprovante em HTML para o `expo-print` virar PDF. Largura de bobina (80 mm) para ficar com cara de
 * cupom no celular do cliente; os mesmos campos do comprovante impresso do web.
 */
export function receiptHtml(r: PosReceipt, t: T): string {
  const items = r.items
    .map(
      (i) => `
      <tr><td colspan="2" class="name">${esc(i.name)}${i.offer_label ? ` <span class="tag">${esc(i.offer_label)}</span>` : ''}</td></tr>
      <tr class="sub"><td>${esc(quantityText(i.quantity))} × ${esc(formatMoney(i.unit_price))}${
        i.list_unit_price && i.list_unit_price > i.unit_price ? ` <s>${esc(formatMoney(i.list_unit_price))}</s>` : ''
      }</td><td class="r">${esc(formatMoney(i.line_total))}</td></tr>`,
    )
    .join('');
  const payments = r.payments
    .map((p) => `<tr><td>${esc(t(`methods.${p.method}`, { defaultValue: p.method }))}</td><td class="r">${esc(formatMoney(p.amount_cents / 100))}</td></tr>`)
    .join('');
  const installments = r.installments.length
    ? `<div class="sec">${esc(t('receipt.installments'))}</div><table>${r.installments
        .map((p) => `<tr><td>${p.number}ª · ${esc(dateOnly(p.due_date))}</td><td class="r">${esc(formatMoney(p.amount_cents / 100))}</td></tr>`)
        .join('')}</table>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  @page { size: 80mm auto; margin: 6mm 5mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0c1222; font-size: 11px; margin: 0; width: 70mm; }
  h1 { font-size: 15px; margin: 0 0 2px; text-align: center; letter-spacing: .2px; }
  .muted { color: #5c677a; text-align: center; margin: 0; }
  .num { text-align: center; font-size: 12px; font-weight: 700; margin: 8px 0 2px; letter-spacing: .6px; }
  hr { border: 0; border-top: 1px dashed #b7c0cf; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .name { font-weight: 600; padding-top: 4px; }
  .sub td { color: #3d4759; }
  s { color: #8a93a3; }
  .tag { font-size: 9px; font-weight: 700; color: #163db0; background: #e3ebff; border-radius: 3px; padding: 0 3px; }
  .tot td { font-size: 15px; font-weight: 800; padding-top: 4px; }
  .sec { font-weight: 700; margin: 8px 0 2px; text-transform: uppercase; font-size: 9.5px; letter-spacing: .8px; color: #5c677a; }
  .foot { text-align: center; margin-top: 10px; color: #3d4759; }
  .reprint { text-align: center; font-size: 9px; letter-spacing: 1px; color: #9a3412; margin-top: 4px; }
</style></head><body>
  <h1>${esc(r.company_name)}</h1>
  <p class="muted">${esc(t('receipt.title'))}${r.situacao ? ` · ${esc(r.situacao)}` : ''}</p>
  ${r.human_number ? `<div class="num">${esc(t('receipt.number', { number: r.human_number }))}</div>` : ''}
  <p class="muted">${esc(dateTime(r.created_at))}</p>
  ${r.reprint ? `<div class="reprint">${esc(t('receipt.copy'))}</div>` : ''}
  <hr/>
  ${r.contact_name ? `<table><tr><td>${esc(t('receipt.customer'))}</td><td class="r">${esc(r.contact_name)}</td></tr></table>` : ''}
  ${r.agent_name ? `<table><tr><td>${esc(t('receipt.seller'))}</td><td class="r">${esc(r.agent_name)}</td></tr></table>` : ''}
  <hr/>
  <table>${items}</table>
  <hr/>
  <table>
    ${r.discount_amount > 0 ? `<tr><td>${esc(t('receipt.subtotal'))}</td><td class="r">${esc(formatMoney(r.gross_amount))}</td></tr><tr><td>${esc(t('receipt.discount'))}</td><td class="r">− ${esc(formatMoney(r.discount_amount))}</td></tr>` : ''}
    <tr class="tot"><td>${esc(t('receipt.total'))}</td><td class="r">${esc(formatMoney(r.amount))}</td></tr>
  </table>
  <div class="sec">${esc(t('receipt.payments'))}</div>
  <table>${payments}</table>
  ${installments}
  ${r.footer ? `<hr/><div class="foot">${esc(r.footer)}</div>` : ''}
</body></html>`;
}

/** Nome do arquivo do PDF: "comprovante-V-1041.pdf". */
export function receiptFileName(r: Pick<PosReceipt, 'human_number' | 'sale_id'>, prefix: string): string {
  const id = (r.human_number || r.sale_id.slice(0, 8)).replace(/[^\w-]+/g, '-');
  return `${prefix}-${id}.pdf`;
}
