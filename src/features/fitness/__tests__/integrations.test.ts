import { phoneHealthCards, pushProvider, receiveProviders, sendTargets, toggleKind } from '../integrations';
import type { ProviderView } from '../types';

const p = (id: ProviderView['id'], state: ProviderView['state'], connected = false): ProviderView => ({
  id,
  label: id,
  state,
  connected,
  status: connected ? 'connected' : null,
  last_sync_at: null,
  last_error: null,
  imported: 0,
});

describe('integrações de relógio', () => {
  it('Garmin conectada já recebe treino; Coros e Apple Watch ficam em breve', () => {
    const s = sendTargets([p('garmin', 'available', true), p('strava', 'available')]);
    expect(s.map((x) => [x.id, x.state, x.connected])).toEqual([
      ['garmin', 'available', true],
      ['coros', 'soon', false],
      ['apple', 'soon', false],
    ]);
  });

  it('sem Garmin liberada no backend, o envio dela também fica em breve', () => {
    expect(sendTargets([])[0]).toMatchObject({ id: 'garmin', state: 'soon', connected: false });
  });

  it('recebe separa os prontos dos que vêm em breve e tira o Apple Watch, que entra pelo Saúde', () => {
    const r = receiveProviders([p('garmin', 'available'), p('strava', 'available'), p('coros', 'soon'), p('apple', 'soon'), p('zepp', 'soon')]);
    expect(r.ready.map((x) => x.id)).toEqual(['garmin', 'strava']);
    expect(r.soon.map((x) => x.id)).toEqual(['coros', 'zepp']);
  });

  it('Galaxy Watch só aparece no Android', () => {
    expect(phoneHealthCards('android')).toEqual(['health', 'galaxy']);
    expect(phoneHealthCards('ios')).toEqual(['health']);
    expect(phoneHealthCards(null)).toEqual(['health']);
  });

  it('toggleKind liga e desliga na ordem da tela e nunca deixa vazio', () => {
    expect(toggleKind(['run', 'swim'], 'bike')).toEqual(['run', 'bike', 'swim']);
    expect(toggleKind(['run', 'swim'], 'run')).toEqual(['swim']);
    expect(toggleKind(['swim'], 'swim')).toEqual(['swim']);
  });

  it('preferências só valem para provedor conectado que recebe treino', () => {
    const garmin = { ...p('garmin', 'available', true), can_push: true, push: { auto: true, kinds: ['run' as const] } };
    expect(pushProvider([p('strava', 'available', true), garmin])?.id).toBe('garmin');
    expect(pushProvider([{ ...garmin, connected: false }])).toBeNull();
    expect(pushProvider([p('garmin', 'available', true)])).toBeNull();
  });
});
