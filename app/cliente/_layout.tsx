import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/features/auth/AuthContext';

/** Telas do cliente empurradas por cima das abas (sem barra inferior). */
export default function ClientStackLayout() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || user?.kind !== 'client') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
