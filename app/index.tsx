import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/features/auth/AuthContext';
import { colors } from '@/src/design-system/tokens';
import { resolveAuthRoute } from '@/src/features/auth/resolveAuthRoute';

export default function Index() {
  const { ready, role, isAuthenticated, needsMfa, user } = useAuth();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.chromeNavy,
        }}
      >
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (role == null) {
    return <Redirect href={resolveAuthRoute({ phase: 'role_unselected' })} />;
  }

  if (role === 'staff') {
    return (
      <Redirect
        href={resolveAuthRoute({ phase: 'staff', authenticated: isAuthenticated, needsMfa })}
      />
    );
  }

  const activeTenantId = user?.kind === 'client' ? user.active_tenant_id : null;
  return (
    <Redirect
      href={resolveAuthRoute({ phase: 'client', authenticated: isAuthenticated, activeTenantId })}
    />
  );
}
