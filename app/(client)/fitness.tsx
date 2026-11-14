import { View } from 'react-native';
import { Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function ClientFitnessScreen() {
  return (
    <Screen>
      <ScreenHeader title="Fitness" />
      <View style={{ padding: spacing.xl }}>
        <Muted>Em breve: fitness e integração com relógios.</Muted>
      </View>
    </Screen>
  );
}
