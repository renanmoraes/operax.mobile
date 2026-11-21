import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Sinos da comemoração de conquistas (`assets/audio/conquista-sinos.mp3`, som sintetizado para o app: um arpejo de
 * sinos que sobe e fica soando). Para trocar o som, basta substituir o arquivo.
 *
 * - Respeita o modo silencioso do aparelho (não toca com o iPhone no silencioso nem com o Android em silencioso/vibrar).
 * - Toca por cima da música de quem está treinando, sem pausar nem abaixar nada.
 * - Nunca derruba a tela: se o áudio falhar, a comemoração segue muda.
 */
const CHIME: number = require('@/assets/audio/conquista-sinos.mp3');

let current: { remove: () => void } | null = null;

export async function playAchievementChime(): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    stopAchievementChime();
    const player = createAudioPlayer(CHIME);
    player.volume = 0.85;
    player.play();
    current = player;
  } catch {
    // sem som
  }
}

/** Saiu da tela: solta o tocador (o som para). */
export function stopAchievementChime() {
  try {
    current?.remove();
  } catch {
    // já solto
  }
  current = null;
}
