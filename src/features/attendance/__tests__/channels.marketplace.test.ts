import i18n from '@/src/i18n';
import { channelName, isMarketplaceChannel } from '../channels';

describe('canais de marketplace', () => {
  it('reconhece o canal do Hub Comercial', () => {
    expect(isMarketplaceChannel('hub:mercado-livre')).toBe(true);
    expect(isMarketplaceChannel('HUB:shopee')).toBe(true);
    expect(isMarketplaceChannel('whatsapp')).toBe(false);
    expect(isMarketplaceChannel(null)).toBe(false);
  });

  it('usa o nome de marca do marketplace', () => {
    expect(channelName('hub:mercado-livre')).toBe('Mercado Livre');
    expect(channelName('hub:tiktok-shop')).toBe('TikTok Shop');
  });

  it('marketplace desconhecido vira o nome genérico, não o código', () => {
    expect(channelName('hub:novo-canal')).toBe(i18n.t('attendance:channel.marketplace'));
    expect(channelName('hub:novo-canal')).toBe('Marketplace');
    expect(channelName('marketplace')).toBe('Marketplace');
  });
});
