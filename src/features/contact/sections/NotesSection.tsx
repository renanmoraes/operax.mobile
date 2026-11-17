import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge, Muted } from '@/src/design-system/ui';
import { getContactChatPreview } from '@/src/shared/api/contacts.api';
import { stampLabel } from '../format';
import { QueryState, RowCard } from '../parts';

export function NotesSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const q = useQuery({ queryKey: ['contact', contactId, 'preview'], queryFn: () => getContactChatPreview(contactId) });
  const notes = q.data?.operator_notes ?? [];
  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={notes.length === 0} emptyIcon="document-text-outline" emptyTitle={t('notes.empty')} emptySub={t('notes.hint')} onRetry={() => void q.refetch()}>
      <View style={{ gap: 10 }}>
        {notes.map((n) => (
          <RowCard
            key={n.id}
            title={n.body}
            lines={[[n.author_name ? t('notes.by', { name: n.author_name }) : null, stampLabel(n.created_at)].filter(Boolean).join(' · ')]}
            accessibilityLabel={`${n.body}. ${t('notes.openConversation')}`}
            onPress={n.conversation_id ? () => router.push(`/conversation/${n.conversation_id}`) : undefined}
            right={n.is_global ? <Badge label={t('notes.global')} tone="primary" /> : undefined}
          />
        ))}
        <Muted style={{ textAlign: 'center', paddingTop: 4 }}>{t('notes.hint')}</Muted>
      </View>
    </QueryState>
  );
}
