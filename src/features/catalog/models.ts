import { keyOf, uniqueValues, type Option } from './variations';

/** Uma opção do modelo: o nome, os valores que a empresa costuma usar e atalhos que marcam vários de uma vez. */
export type ModelOption = { name: string; suggestions: string[]; shortcuts: { label: string; values: string[] }[] };
export type VariationModel = { id: string; label: string; options: ModelOption[]; company?: boolean };

const range = (from: number, to: number, step = 1): string[] => {
  const out: string[] = [];
  for (let n = from; n <= to; n += step) out.push(String(n));
  return out;
};
const COLORS = ['Preto', 'Branco', 'Azul', 'Vermelho', 'Verde', 'Rosa', 'Cinza', 'Bege', 'Marrom', 'Amarelo'];
const color = (colors = COLORS): ModelOption => ({ name: 'Cor', suggestions: colors, shortcuts: [] });

/**
 * Modelos que vêm prontos (os mesmos do Operax web). Só dão o nome das opções e os valores de sempre:
 * a pessoa marca o que o produto tem. O texto é o dado que vai para o cadastro, não tradução de tela.
 */
export const READY_MODELS: VariationModel[] = [
  { id: 'roupa', label: 'Roupa', options: [{ name: 'Tamanho', suggestions: ['PP', 'P', 'M', 'G', 'GG', 'XG'], shortcuts: [{ label: 'P ao GG', values: ['P', 'M', 'G', 'GG'] }] }, color()] },
  { id: 'calcado', label: 'Calçado', options: [{ name: 'Tamanho', suggestions: range(33, 44), shortcuts: [{ label: 'Feminino 34 a 39', values: range(34, 39) }, { label: 'Masculino 38 a 44', values: range(38, 44) }] }, color()] },
  { id: 'infantil', label: 'Infantil', options: [{ name: 'Tamanho', suggestions: range(2, 16, 2), shortcuts: [{ label: '2 a 8', values: ['2', '4', '6', '8'] }] }, color()] },
  { id: 'chapeu', label: 'Chapéu e boné', options: [{ name: 'Numeração', suggestions: range(52, 62), shortcuts: [{ label: 'Adulto 55 a 60', values: range(55, 60) }, { label: 'Infantil 52 a 54', values: range(52, 54) }] }, color()] },
  { id: 'eletro', label: 'Eletro', options: [{ name: 'Voltagem', suggestions: ['110 V', '220 V', 'Bivolt'], shortcuts: [] }, color(COLORS.slice(0, 6))] },
  { id: 'alimento', label: 'Alimento', options: [{ name: 'Sabor', suggestions: ['Original', 'Chocolate', 'Morango', 'Baunilha'], shortcuts: [] }, { name: 'Peso', suggestions: ['250 g', '500 g', '1 kg', '5 kg'], shortcuts: [] }] },
  { id: 'bebida', label: 'Bebida', options: [{ name: 'Volume', suggestions: ['350 ml', '600 ml', '1 L', '2 L'], shortcuts: [] }] },
];

/** Nomes de opção que os canais reconhecem; outro nome também vale. */
export const OPTION_NAMES = ['Tamanho', 'Numeração', 'Cor', 'Voltagem', 'Sabor', 'Volume', 'Capacidade', 'Peso', 'Material', 'Estampa', 'Modelo', 'Fragrância', 'Acabamento', 'Quantidade'];

export const BLANK_MODEL: VariationModel = { id: 'blank', label: '', options: [{ name: '', suggestions: [], shortcuts: [] }] };

export type CompanyModelDto = { id: string; name: string; options: { name: string; values: string[] }[] };

/** Modelo salvo pela empresa: os valores que ela guardou viram as sugestões. */
export const companyModel = (m: CompanyModelDto): VariationModel => ({
  id: `company:${m.id}`,
  label: m.name,
  company: true,
  options: m.options.map((o) => ({ name: o.name, suggestions: o.values, shortcuts: [] })),
});

/** O que o modelo escolhido vira na tela: as opções sem valor marcado (a pessoa marca o que o produto tem). */
export const optionsOfModel = (m: VariationModel): Option[] => m.options.map((o) => ({ name: o.name, values: [] }));

/** O que guardar de um modelo ao salvar: o nome das opções e os valores sugeridos mais os que a pessoa marcou. */
export function optionsToSave(blocks: { name: string; suggestions: string[]; values: string[] }[]): { name: string; values: string[] }[] {
  return blocks.filter((b) => b.name.trim()).map((b) => ({ name: b.name.trim(), values: uniqueValues([...b.suggestions, ...b.values]) }));
}

export const sameName = (a: string, b: string) => keyOf(a) === keyOf(b);
