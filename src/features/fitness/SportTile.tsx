import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/design-system/tokens';
import { sportIconFor } from './sports';

/** Quadrado com o ícone do esporte, do mesmo tamanho e cor do `IconTile` das listas. */
export function SportTile({ sport, size = 40 }: { sport: string | null | undefined; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.36), backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={sportIconFor(sport)} size={Math.round(size * 0.55)} color={colors.primary} />
    </View>
  );
}
