import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/features/auth/AuthContext';
import { colors } from '@/src/design-system/tokens';

export default function Index() {
  const { ready, isAuthenticated, needsMfa } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chromeNavy }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (needsMfa) return <Redirect href="/(auth)/mfa" />;
  if (isAuthenticated) return <Redirect href="/(app)/inbox" />;
  return <Redirect href="/(auth)/login" />;
}
