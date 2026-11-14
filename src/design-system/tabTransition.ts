import { Animated, Easing } from 'react-native';

type SceneProgress = { current: { progress: Animated.AnimatedInterpolation<number> } };

/**
 * Troca de aba com movimento: a tela nova entra deslizando um pouco do lado da aba tocada e
 * ganhando opacidade, enquanto a anterior sai para o outro lado. Curto e macio, para não
 * parecer um corte seco nem atrasar quem troca de aba o tempo todo.
 */
export const TAB_TRANSITION = {
  transitionSpec: {
    animation: 'timing' as const,
    config: { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) },
  },
  sceneStyleInterpolator: ({ current }: SceneProgress) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, -0.5, 0, 0.5, 1], outputRange: [0, 0.35, 1, 0.35, 0] }),
      transform: [
        { translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-36, 0, 36] }) },
        { scale: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.985, 1, 0.985] }) },
      ],
    },
  }),
};
