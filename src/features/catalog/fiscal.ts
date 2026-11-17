/** Dados fiscais do produto para a nota de saída, como texto de formulário. */
export type Fiscal = { ncm: string; cest: string; /** "0" a "8"; vazio quando não informado. */ origin: string; cfop: string; cst: string };

export const EMPTY_FISCAL: Fiscal = { ncm: '', cest: '', origin: '', cfop: '', cst: '' };
export const ORIGINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'] as const;

/** Mantém só os números até o tamanho do campo. */
export const digitsOnly = (value: string, size: number): string => value.replace(/\D/g, '').slice(0, size);

export type FiscalProblem = 'ncm' | 'cest' | 'cfop' | 'cst';

/** O que o servidor recusaria, dito antes de gravar. Campo vazio é permitido: o fiscal é opcional. */
export function fiscalProblem(f: Fiscal): FiscalProblem | null {
  if (f.ncm && f.ncm.length !== 8) return 'ncm';
  if (f.cest && f.cest.length !== 7) return 'cest';
  if (f.cfop && f.cfop.length !== 4) return 'cfop';
  if (f.cst && f.cst.length < 2) return 'cst';
  return null;
}

/** Produto novo: manda só o que foi preenchido. Campo vazio fica de fora, e vale o padrão da empresa. */
export function fiscalPayload(f: Fiscal): { fiscal_ncm?: string; fiscal_cest?: string; fiscal_origem?: number; fiscal_cfop?: string; fiscal_cst_csosn?: string } {
  return {
    ...(f.ncm ? { fiscal_ncm: f.ncm } : {}),
    ...(f.cest ? { fiscal_cest: f.cest } : {}),
    ...(f.origin !== '' ? { fiscal_origem: Number(f.origin) } : {}),
    ...(f.cfop ? { fiscal_cfop: f.cfop } : {}),
    ...(f.cst ? { fiscal_cst_csosn: f.cst } : {}),
  };
}

export const hasFiscal = (f: Fiscal): boolean => Object.values(f).some((v) => v !== '');
