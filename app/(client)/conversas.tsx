import { View } from 'react-native';
import { Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function ClientConversasScreen() {
  return (
    <Screen>
      <ScreenHeader title="Conversas" />
      <View style={{ padding: spacing.xl }}>
        <Muted>Em breve: conversas com a empresa.</Muted>
      </View>
    </Screen>
  );
}
