/**
 * O vencimento que a tela do crediário sugere sozinha.
 *
 * É hoje, no mês que vem. A tela vinha propondo o próprio dia da venda, e
 * ninguém vende fiado com a parcela vencendo na hora: quem não trocava a data
 * à mão criava a dívida já atrasada, e no dia seguinte ela aparecia no funil
 * de cobrança com multa e juros por uma venda feita na véspera.
 *
 * Dia curto não desliza: 31 de janeiro vira 28 de fevereiro, e não 3 de março.
 * É a mesma âncora que o backend usa para as parcelas seguintes
 * (`installment-schedule.util.ts`), então a primeira não fica fora do padrão
 * das outras.
 *
 * A data sai do relógio de quem está no balcão, montada campo a campo.
 * `toISOString()` daria o dia em UTC, que às dez da noite aqui já virou
 * amanhã — o vencimento nasceria um dia adiantado sem ninguém perceber.
 */
export function primeiroVencimentoSugerido(hoje = new Date()): string {
  const ano = hoje.getFullYear();
  const mesAlvo = hoje.getMonth() + 1;
  const diasNoMesAlvo = new Date(ano, mesAlvo + 1, 0).getDate();
  const dia = Math.min(hoje.getDate(), diasNoMesAlvo);
  const d = new Date(ano, mesAlvo, dia);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
