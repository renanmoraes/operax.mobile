import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '@/src/design-system/ui';
import { channelName } from '@/src/features/attendance/channels';
import { listConversations } from '@/src/shared/api/conversations.api';
import { timeAgo } from '@/src/shared/format';
import { QueryState, RowCard } from '../parts';

export function ConversationsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const q = useQuery({
    queryKey: ['contact', contactId, 'conversations'],
    queryFn: () => listConversations({ contact_id: contactId, limit: 50, sort_by: 'recent' }),
  });
  const items = q.data?.data ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={items.length === 0} emptyIcon="chatbubbles-outline" emptyTitle={t('conversations.empty')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {items.map((c) => {
          const closed = c.status === 'closed';
          const when = c.last_customer_message_at ? t('conversations.lastMessage', { when: timeAgo(c.last_customer_message_at) }) : t('conversations.noMessage');
          return (
            <RowCard
              key={c.id}
              title={channelName(c.channel)}
              lines={[c.last_message_preview ?? c.preview, when, c.current_queue_name ? t('conversations.queue', { name: c.current_queue_name }) : null]}
              onPress={() => router.push(`/conversation/${c.id}`)}
              right={
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge label={closed ? t('conversations.closed') : t('conversations.open')} tone={closed ? 'neutral' : 'success'} />
                  {(c.unread_count ?? 0) > 0 ? <Badge label={t('conversations.unread', { count: c.unread_count })} tone="primary" /> : null}
                </View>
              }
            />
          );
        })}
      </View>
    </QueryState>
  );
}
