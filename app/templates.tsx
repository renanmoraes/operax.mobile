import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Badge, Body, Muted, Screen, Title } from '@/src/design-system/ui';
import { colors, spacing, typography } from '@/src/design-system/tokens';
import { listTemplates, sendTemplateMessage } from '@/src/shared/api/templates.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { templates as mockTemplates } from '@/src/mocks/data';
import { useState } from 'react';

export default function TemplatesScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { mode } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['templates'],
    enabled: mode === 'live',
    queryFn: () => listTemplates(),
  });
  const sendMut = useMutation({
    mutationFn: (templateId: string) =>
      sendTemplateMessage(conversationId!, { template_id: templateId }),
    onSuccess: () => {
      setToast('Template enfileirado');
      setTimeout(() => router.back(), 800);
    },
    onError: () => setToast('Falha ao enviar template'),
  });

  const data =
    mode === 'live'
      ? (query.data ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category || '—',
          language: t.language || 'pt_BR',
          preview: t.body || t.name,
          status: (t.status === 'approved' ? 'approved' : 'pending') as 'approved' | 'pending',
        }))
      : mockTemplates;

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Templates</Title>
        <Muted>Fora da janela 24h — apenas aprovados. {toast ? `· ${toast}` : ''}</Muted>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: 40 }}>
            {query.isLoading ? 'Carregando…' : 'Nenhum template.'}
          </Muted>
        }
        renderItem={({ item }) => {
          const approved = item.status === 'approved';
          return (
            <Pressable
              disabled={!approved}
              style={[styles.row, !approved && { opacity: 0.55 }]}
              onPress={() => {
                if (mode === 'live' && conversationId) {
                  sendMut.mutate(item.id);
                  return;
                }
                if (conversationId) router.back();
                else router.replace('/(app)/inbox');
              }}
            >
              <View style={styles.rowTop}>
                <Body style={styles.title}>{item.name}</Body>
                <Badge label={approved ? 'Aprovado' : item.status} tone={approved ? 'success' : 'warn'} />
              </View>
              <Muted>
                {item.category} · {item.language}
              </Muted>
              <Body style={{ marginTop: 6 }}>{item.preview}</Body>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  row: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: 4,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: typography.fontFamilySemiBold },
});
