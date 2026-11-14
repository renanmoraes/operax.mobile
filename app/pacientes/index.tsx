import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonList } from '@/src/design-system/Skeleton';
import { EmptyState, PressableScale, Screen, ScreenHeader } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { phoneLabel } from '@/src/features/agenda/bookingDetails';
import { contacts as mockContacts } from '@/src/mocks/data';
import { listContacts } from '@/src/shared/api/contacts.api';
import { RequirePermission } from '@/src/features/auth/useCan';

type Person = { id: string; name: string; phone: string | null; email: string | null; tags: string[] };

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Pacientes e clientes da empresa: busca, lista em ordem alfabética e acesso à ficha. */
export default function PatientsScreenGuarded() {
  return (
    <RequirePermission need="contacts" title="Pacientes">
      <PatientsScreen />
    </RequirePermission>
  );
}

function PatientsScreen() {
  const insets = useSafeAreaInsets();
  const { mode } = useAuth();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');

  // Busca no servidor só depois de uma pausa na digitação.
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ['contacts', 'list', term],
    enabled: mode === 'live',
    queryFn: () => listContacts({ search: term || undefined, limit: 60 }),
  });

  const people: Person[] = useMemo(() => {
    if (mode === 'live') {
      return (query.data?.items ?? []).map((c) => ({
        id: c.id,
        name: c.name || c.phone_e164 || 'Sem nome',
        phone: c.phone_e164 ?? null,
        email: c.email ?? null,
        tags: (c.tags ?? []).map((t) => (typeof t === 'string' ? t : t.tag || t.name || '')).filter(Boolean),
      }));
    }
    const f = fold(term);
    return mockContacts
      .filter((c) => !f || fold(`${c.name} ${c.phone} ${c.email ?? ''}`).includes(f))
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email ?? null, tags: c.tags }));
  }, [mode, query.data, term]);

  const sections = useMemo(() => {
    const groups = new Map<string, Person[]>();
    for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))) {
      const letter = fold(p.name).charAt(0).toUpperCase() || '#';
      const key = /[A-Z]/.test(letter) ? letter : '#';
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [people]);

  const total = mode === 'live' ? query.data?.total ?? 0 : mockContacts.length;

  return (
    <Screen>
      <ScreenHeader safe title="Pacientes" subtitle={total ? `${total} ${total === 1 ? 'pessoa' : 'pessoas'}` : undefined} onBack={() => router.back()} />
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Nome, telefone ou e-mail"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            accessibilityLabel="Buscar paciente"
            style={styles.searchInput}
          />
          {search ? <Ionicons name="close-circle" size={17} color={colors.textMuted} onPress={() => setSearch('')} accessibilityLabel="Limpar busca" /> : null}
        </View>
      </View>

      {mode === 'live' && query.isLoading ? (
        <SkeletonList variant="contact" count={8} style={{ marginHorizontal: 20, marginTop: 6 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(p) => p.id}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
          refreshControl={mode === 'live' ? <RefreshControl refreshing={query.isFetching && !query.isLoading} onRefresh={() => void query.refetch()} tintColor={colors.primary} /> : undefined}
          renderSectionHeader={({ section }) => <Text style={styles.letter}>{section.title}</Text>}
          ListEmptyComponent={<EmptyState icon="people-outline" title={term ? 'Ninguém encontrado' : 'Nenhum paciente ainda'} subtitle={term ? 'Confira o nome ou busque pelo telefone.' : 'Os contatos da empresa aparecem aqui.'} />}
          renderItem={({ item, index, section }) => (
            <PressableScale
              onPress={() => router.push(`/contact/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}${item.phone ? `, ${phoneLabel(item.phone)}` : ''}`}
              style={[styles.row, index === 0 && styles.rowFirst, index === section.data.length - 1 && styles.rowLast]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(item.name)}</Text>
              </View>
              <View style={[styles.body, index < section.data.length - 1 && styles.divider]}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{[phoneLabel(item.phone), item.email].filter(Boolean).join(' · ') || 'Sem contato'}</Text>
                {item.tags.length ? (
                  <View style={styles.tags}>
                    {item.tags.slice(0, 3).map((t) => (
                      <View key={t} style={styles.tag}>
                        <Text style={styles.tagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
            </PressableScale>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  search: { height: 44, borderRadius: radii.pill, backgroundColor: colors.cardBg, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, ...shadows.card },
  searchInput: { flex: 1, minWidth: 0, fontFamily: typography.fontFamily, fontSize: 15, color: colors.text, padding: 0 },
  letter: { ...text.label, color: colors.primary, letterSpacing: 0.6, paddingTop: 16, paddingBottom: 6, paddingLeft: 4, backgroundColor: colors.pageBg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 12, backgroundColor: colors.cardBg },
  rowFirst: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  rowLast: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.primary },
  body: { flex: 1, minWidth: 0, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  name: { ...text.bodyStrong, color: colors.text },
  meta: { ...text.caption, color: colors.textMuted, marginTop: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  tag: { paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: colors.primaryWash, justifyContent: 'center' },
  tagText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11, color: colors.primaryDeep },
});
