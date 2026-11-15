import { primeiroVencimentoSugerido } from '../primeiroVencimento';

describe('primeiro vencimento sugerido no crediário', () => {
  it('é o mesmo dia, no mês que vem', () => {
    // Vender fiado com a parcela vencendo hoje criava a dívida já atrasada.
    expect(primeiroVencimentoSugerido(new Date(2026, 8, 25))).toBe('2026-10-25');
  });

  it('vira o ano sem tropeçar', () => {
    expect(primeiroVencimentoSugerido(new Date(2026, 11, 10))).toBe('2027-01-10');
  });

  it('dia que não existe no mês seguinte cai no último dia dele', () => {
    // 31/01 não vira 03/03: fevereiro fecha no dia 28.
    expect(primeiroVencimentoSugerido(new Date(2026, 0, 31))).toBe('2026-02-28');
    // E no ano bissexto, no 29.
    expect(primeiroVencimentoSugerido(new Date(2028, 0, 31))).toBe('2028-02-29');
  });

  it('31 de março vira 30 de abril', () => {
    expect(primeiroVencimentoSugerido(new Date(2026, 2, 31))).toBe('2026-04-30');
  });

  it('usa o fuso de quem está no balcão, não UTC', () => {
    // Às 22h de Belo Horizonte já é o dia seguinte em UTC. A data proposta
    // tem que ser a do balcão.
    expect(primeiroVencimentoSugerido(new Date(2026, 8, 25, 22, 30))).toBe('2026-10-25');
  });
});
