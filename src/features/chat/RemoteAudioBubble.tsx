import { useQuery } from '@tanstack/react-query';
import { getSignedMediaUrl } from '@/src/shared/api/media.api';
import { AudioBubble } from './AudioBubble';
import type { MessageStatus } from './MessageParts';

/**
 * Áudio que pode vir do servidor só com o id da mídia: busca o link assinado (e guarda por
 * alguns minutos) antes de entregar ao reprodutor. Áudio recém-gravado usa o arquivo local.
 */
export function RemoteAudioBubble({
  id,
  localUri,
  mediaId,
  durationS,
  at,
  mine,
  status,
}: {
  id: string;
  localUri?: string;
  mediaId?: string;
  durationS?: number;
  at: string;
  mine: boolean;
  status?: MessageStatus;
}) {
  const signed = useQuery({
    queryKey: ['media-url', mediaId],
    enabled: !localUri && !!mediaId,
    queryFn: () => getSignedMediaUrl(mediaId!),
    staleTime: 10 * 60_000,
  });
  const source = localUri ?? signed.data ?? null;
  return <AudioBubble id={id} source={source} durationS={durationS} at={at} mine={mine} status={status} />;
}
