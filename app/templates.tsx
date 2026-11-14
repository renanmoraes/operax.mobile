import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, EmptyState, Loading, Muted, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { listTemplates, sendTemplateMessage } from '@/src/shared/api/templates.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { templates as mockTemplates } from '@/src/mocks/data';

export default function TemplatesScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const insets = useSafeAreaInsets();
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
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Templates Meta" subtitle="Fora da janela de 24 h, só aprovados" onBack={() => router.back()} />
      </View>
      {toast ? (
        <View style={{ alignSelf: 'center', marginBottom: 8 }}>
          <Badge label={toast} tone={toast.startsWith('Falha') ? 'danger' : 'success'} />
        </View>
      ) : null}
      {mode === 'live' && query.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: 10 }}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Nenhum template" subtitle="Templates aprovados pela Meta aparecem aqui." />}
          renderItem={({ item }) => {
            const approved = item.status === 'approved';
            return (
              <Card
                style={[{ gap: 8 }, !approved && { opacity: 0.6 }]}
                onPress={
                  approved
                    ? () => {
                        if (mode === 'live' && conversationId) {
                          sendMut.mutate(item.id);
                          return;
                        }
                        if (conversationId) router.back();
                        else router.replace('/(app)/inbox');
                      }
                    : undefined
                }
              >
                <View style={styles.rowTop}>
                  <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                  <Badge label={approved ? 'Aprovado' : 'Em análise'} tone={approved ? 'success' : 'warn'} />
                </View>
                <Muted style={{ fontSize: 12.5 }}>
                  {item.category} · {item.language}
                </Muted>
                <View style={styles.preview}>
                  <Text style={styles.previewText} numberOfLines={4}>{item.preview}</Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  preview: { backgroundColor: colors.primaryWash, borderRadius: radii.md, borderBottomLeftRadius: 6, padding: 12 },
  previewText: { fontFamily: typography.fontFamily, fontSize: 14, lineHeight: 20, color: colors.text },
});
