import { getItem, setItem } from '../storage';

/**
 * Identificador deste aparelho, sorteado uma vez e guardado no cofre do sistema. O portal deixa a pessoa logada em um navegador
 * e um celular ao mesmo tempo; com o identificador, entrar de novo neste celular não toma a vaga de si mesmo e não tira o push
 * das outras empresas dela. O servidor guarda só o hash dele.
 */
const KEY = 'operax.device_id';
const FORMAT = /^[A-Za-z0-9_-]{16,64}$/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

let cached: Promise<string> | null = null;

export function newDeviceId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 32; i += 1) id += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length];
  return id;
}

async function load(): Promise<string> {
  const saved = await getItem(KEY).catch(() => null);
  if (saved && FORMAT.test(saved)) return saved;
  const id = newDeviceId();
  await setItem(KEY, id).catch(() => undefined);
  return id;
}

export function deviceId(): Promise<string> {
  cached ??= load().catch(() => {
    cached = null;
    return newDeviceId();
  });
  return cached;
}
