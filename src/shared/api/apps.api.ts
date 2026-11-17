import { api } from './client';

/** Apps que a empresa tem instalados (qualquer pessoa logada lê; é o que o web usa para mostrar ou esconder telas). */
export async function fetchActiveApps(): Promise<string[]> {
  const { data } = await api.get('/api/tenant/apps/ui-contributions');
  return Array.isArray(data?.active_slugs) ? (data.active_slugs as string[]) : [];
}
