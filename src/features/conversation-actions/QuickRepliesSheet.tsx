import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import { filterQuickReplies, QuickReplyLike } from '@/src/features/chat/quickReplyMatch';
import { listQuickReplies } from '@/src/shared/api/quick-replies.api';

/**
 * Botão de raio: todas as respostas rápidas, com busca. Ao tocar, o texto vai pronto para o
 * campo (variáveis do contato já preenchidas) para revisar e enviar. Embaixo, as mensagens
 * ativas (templates da Meta) para quando a janela de 24 h fechou.
 */
export function QuickRepliesSheet({
  visible,
  onClose,
  live,
  demoItems,
  onPick,
  onTemplates,
  within24h,
}: {
  visible: boolean;
  onClose: () => void;
  live: boolean;
  demoItems: QuickReplyLike[];
  onPick: (q: QuickReplyLike) => void;
  onTemplates: () => void;
  within24h: boolean;
}) {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['quick-replies', 'sheet'],
    enabled: live && visible,
    queryFn: () => listQuickReplies({ limit: 100 }),
    staleTime: 30_000,
  });
  const all = live ? query.data ?? [] : demoItems;
  const items = filterQuickReplies(all, search.replace(/^\//, ''), 100);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Respostas rápidas" closeLabel="Fechar respostas rápidas">
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar pelo atalho ou título"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Buscar resposta rápida"
          style={styles.searchInput}
        />
      </View>
      <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
        {items.length === 0 ? (
          <Text style={styles.empty}>{query.isLoading && live ? 'Carregando…' : search ? 'Nenhum atalho encontrado' : 'Nenhuma resposta rápida cadastrada'}</Text>
        ) : (
          items.map((q, i) => (
            <Pressable
              key={q.id}
              onPress={() => {
                onPick(q);
                setSearch('');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${q.title}`}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.rowPress }]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.slug}>{`/${q.slug}`}</Text>
                <Text style={styles.title} numberOfLines={1}>{q.title}</Text>
              </View>
              <Text style={styles.body} numberOfLines={2}>{q.body}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      <Pressable onPress={onTemplates} accessibilityRole="button" style={({ pressed }) => [styles.templates, pressed && { opacity: 0.8 }]}>
        <View style={styles.templatesIcon}>
          <Ionicons name="document-text" size={18} color="#c2410c" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.templatesTitle}>Mensagens ativas (templates)</Text>
          <Text style={styles.templatesSub}>{within24h ? 'Para quando a janela de 24 h fechar' : 'A janela de 24 h fechou: use um template'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { height: 44, borderRadius: radii.pill, backgroundColor: '#f0f2f5', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: typography.fontFamily, fontSize: 15, color: colors.text, padding: 0 },
  empty: { ...text.callout, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  row: { paddingVertical: 11, paddingHorizontal: 4 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slug: { ...text.captionStrong, color: colors.primary, backgroundColor: colors.primaryWash, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  title: { ...text.calloutStrong, color: colors.text, flex: 1 },
  body: { ...text.caption, color: colors.textSoft, marginTop: 4 },
  templates: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: '#fff8f1' },
  templatesIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff1e2', alignItems: 'center', justifyContent: 'center' },
  templatesTitle: { ...text.calloutStrong, color: colors.text },
  templatesSub: { ...text.caption, color: colors.textMuted, marginTop: 1 },
});
