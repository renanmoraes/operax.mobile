import { shareImageWithMessage, type CanvasRef } from '../destinations';

const mockOpen = jest.fn();
const mockShareAsync = jest.fn();

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/cartao.png') }));
jest.mock('react-native-share', () => ({ __esModule: true, default: { open: (...a: unknown[]) => mockOpen(...a) }, Social: {} }));
jest.mock('expo-sharing', () => ({ shareAsync: (...a: unknown[]) => mockShareAsync(...a) }));
jest.mock('expo-media-library', () => ({}));
jest.mock('expo-clipboard', () => ({}));
jest.mock('@/src/design-system/Dialog', () => ({ confirmDialog: jest.fn(), showDialog: jest.fn() }));
jest.mock('@/src/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

const ref = { current: null } as unknown as CanvasRef;

beforeEach(() => {
  mockOpen.mockReset();
  mockShareAsync.mockReset();
});

describe('compartilhar imagem com legenda', () => {
  it('manda o PNG do cartão junto com a frase', async () => {
    mockOpen.mockResolvedValue({});
    await shareImageWithMessage(ref, 'Ganhei "Emaús" no Studio.');
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///tmp/cartao.png', type: 'image/png', message: 'Ganhei "Emaús" no Studio.' }));
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('se o menu falhar, cai no compartilhar do sistema só com a imagem', async () => {
    mockOpen.mockRejectedValue(new Error('boom'));
    await shareImageWithMessage(ref, 'x');
    expect(mockShareAsync).toHaveBeenCalledWith('file:///tmp/cartao.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  it('cancelar não é erro nem abre outro menu', async () => {
    mockOpen.mockRejectedValue(new Error('User did not share'));
    await shareImageWithMessage(ref, 'x');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});
