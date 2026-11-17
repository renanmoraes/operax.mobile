import { api } from './client';

/** O que a empresa trocou no vocabulário (app de terminologia): `{ 'entity.contact': 'paciente', ... }`. */
export async function fetchTenantVocabulary(): Promise<Record<string, string>> {
  const { data } = await api.get('/api/tenant/apps/vocabulary');
  return (data && typeof data === 'object' ? data : {}) as Record<string, string>;
}
