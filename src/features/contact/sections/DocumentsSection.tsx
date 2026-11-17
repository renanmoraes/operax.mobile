import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { Button, IconButton } from '@/src/design-system/ui';
import { colors } from '@/src/design-system/tokens';
import { useCan } from '@/src/features/auth/useCan';
import { getDocumentDownloadUrl, listContactDocuments, removeContactDocument, type ContactDocument } from '@/src/shared/api/contacts.api';
import { uploadContactDocument } from '@/src/shared/api/pos.api';
import { stampLabel } from '../format';
import { QueryState, RowCard } from '../parts';

const iconFor = (mime: string | null): React.ComponentProps<typeof Ionicons>['name'] =>
  mime?.startsWith('image/') ? 'image-outline' : mime === 'application/pdf' ? 'document-text-outline' : 'document-outline';

export function DocumentsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const can = useCan();
  const canEdit = can('contactsUpdate');
  const qc = useQueryClient();
  const key = ['contact', contactId, 'documents'];
  const q = useQuery({ queryKey: key, queryFn: () => listContactDocuments(contactId) });
  const items = q.data ?? [];

  const open = async (d: ContactDocument) => {
    try {
      const { url } = await getDocumentDownloadUrl(contactId, d.id);
      await WebBrowser.openBrowserAsync(url);
    } catch {
      void showDialog({ title: t('documents.openFailed'), tone: 'warn' });
    }
  };

  const remove = async (d: ContactDocument) => {
    const ok = await confirmDialog({ title: t('documents.removeTitle'), message: t('documents.removeBody', { name: d.file_name }), confirmLabel: t('documents.remove'), tone: 'danger' });
    if (!ok) return;
    try {
      await removeContactDocument(contactId, d.id);
      void qc.invalidateQueries({ queryKey: key });
    } catch {
      void showDialog({ title: t('documents.removeFailed'), tone: 'warn' });
    }
  };

  const add = useMutation({
    mutationFn: async () => {
      const pick = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (pick.canceled || !pick.assets[0]) return false;
      const a = pick.assets[0];
      await uploadContactDocument(contactId, { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' }, a.name);
      return true;
    },
    onSuccess: (done) => {
      if (done) void qc.invalidateQueries({ queryKey: key });
    },
    onError: () => void showDialog({ title: t('documents.addFailed'), tone: 'warn' }),
  });

  return (
    <View style={{ gap: 12 }}>
      <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="folder-open-outline" emptyTitle={t('documents.empty')} onRetry={() => void q.refetch()}>
        <View style={{ gap: 10 }}>
          {items.map((d) => (
            <RowCard
              key={d.id}
              title={d.description || d.file_name}
              lines={[d.file_name !== d.description ? d.file_name : null, [d.size ? t('documents.size', { size: Math.max(1, Math.round(d.size / 1024)) }) : null, stampLabel(d.created_at)].filter(Boolean).join(' · ')]}
              accessibilityLabel={`${d.description || d.file_name}. ${t('documents.open')}`}
              onPress={() => void open(d)}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name={iconFor(d.mime_type)} size={20} color={colors.primary} />
                  {canEdit ? <IconButton icon="trash-outline" accessibilityLabel={t('documents.remove')} onPress={() => void remove(d)} /> : null}
                </View>
              }
            />
          ))}
        </View>
      </QueryState>
      {canEdit ? <Button label={t('documents.add')} variant="soft" loading={add.isPending} onPress={() => add.mutate()} /> : null}
    </View>
  );
}
