import { api } from './client';

export type ApiPipeline = {
  id: string;
  name: string;
  stages?: ApiStage[];
};

export type ApiStage = {
  id: string;
  name: string;
  position?: number;
};

export type ApiCard = {
  id: string;
  stage_id: string;
  title?: string | null;
  value_estimated?: number | null;
  contact?: { name?: string | null };
  contact_name?: string | null;
};

export async function listPipelines(): Promise<ApiPipeline[]> {
  const { data } = await api.get('/api/kanban/pipelines');
  return (Array.isArray(data) ? data : data?.data ?? []) as ApiPipeline[];
}

export async function getPipeline(id: string): Promise<ApiPipeline> {
  const { data } = await api.get(`/api/kanban/pipelines/${id}`);
  return data as ApiPipeline;
}

export async function listStageCards(stageId: string): Promise<ApiCard[]> {
  const { data } = await api.get(`/api/kanban/stages/${stageId}/cards`, {
    params: { limit: 50 },
  });
  if (Array.isArray(data)) return data as ApiCard[];
  return (data?.data ?? data?.items ?? []) as ApiCard[];
}

export async function moveCard(cardId: string, stageId: string) {
  const { data } = await api.patch(`/api/kanban/cards/${cardId}`, { stage_id: stageId });
  return data;
}
