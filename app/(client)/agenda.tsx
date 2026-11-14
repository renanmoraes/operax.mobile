import { View } from 'react-native';
import { Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { spacing } from '@/src/design-system/tokens';

export default function ClientAgendaScreen() {
  return (
    <Screen>
      <ScreenHeader title="Agenda" />
      <View style={{ padding: spacing.xl }}>
        <Muted>Em breve: agenda e serviços da empresa.</Muted>
      </View>
    </Screen>
  );
}
