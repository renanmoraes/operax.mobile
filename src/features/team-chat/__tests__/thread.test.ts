import { mergeThread, retainWindow } from '../thread';

const msgs = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(from + i) }));
const ids = (l: { id: string }[]) => l.map((m) => Number(m.id));

describe('conversa paginada do chat de equipe', () => {
  it('mensagem nova não some com a que saiu da janela das mais recentes', () => {
    let older = msgs(1, 60);
    older = retainWindow(older, msgs(61, 120));
    // chega a 121: a janela vira 62–121
    older = retainWindow(older, msgs(62, 121));
    const thread = mergeThread(older, msgs(62, 121));
    expect(ids(thread)).toEqual(Array.from({ length: 121 }, (_, i) => i + 1));
  });

  it('sem histórico carregado, só mostra a janela atual', () => {
    expect(retainWindow([], msgs(1, 3))).toEqual([]);
    expect(ids(mergeThread([], msgs(2, 4)))).toEqual([2, 3, 4]);
  });

  it('a versão da janela atual vence (mensagem editada)', () => {
    const older = [{ id: '1', text: 'velho' }];
    expect(mergeThread(older, [{ id: '1', text: 'novo' }])).toEqual([{ id: '1', text: 'novo' }]);
  });
});
