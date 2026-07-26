import { api } from './client';

export async function getSignedMediaUrl(mediaId: string): Promise<string> {
  const { data } = await api.get(`/api/media/${mediaId}/signed-url`);
  return (data?.url ?? data?.signed_url ?? data) as string;
}
