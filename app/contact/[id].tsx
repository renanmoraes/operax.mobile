import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Badge, Body, Card, Muted, Screen, Title } from '@/src/design-system/ui';
import { spacing, typography } from '@/src/design-system/tokens';
import { getContact } from '@/src/shared/api/contacts.api';
import { useAuth } from '@/src/features/auth/AuthContext';
import { getContact as getMockContact } from '@/src/mocks/data';

export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mode } = useAuth();
  const query = useQuery({
    queryKey: ['contact', id],
    enabled: mode === 'live' && !!id,
    queryFn: () => getContact(id),
  });

  const mock = mode === 'mock' ? getMockContact(id) : null;
  const contact = mode === 'live' ? query.data : mock;

  if (!contact) {
    return (
      <Screen style={styles.center}>
        <Muted>{query.isLoading ? 'Carregando…' : 'Contato não encontrado.'}</Muted>
      </Screen>
    );
  }

  const tags = Array.isArray((contact as { tags?: unknown[] }).tags)
    ? (contact as { tags: Array<string | { tag?: string; name?: string }> }).tags.map((t) =>
        typeof t === 'string' ? t : t.tag || t.name || '',
      ).filter(Boolean)
    : [];

  return (
    <Screen style={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <Title>{contact.name || 'Contato'}</Title>
        <Muted>{('phone_e164' in contact ? contact.phone_e164 : (contact as { phone?: string }).phone) || '—'}</Muted>
        {contact.email ? <Muted>{contact.email}</Muted> : null}
        <View style={styles.tags}>
          {tags.map((tag) => (
            <Badge key={tag} label={tag} tone="primary" />
          ))}
          {'lead_score' in contact && contact.lead_score != null ? (
            <Badge label={`Lead ${contact.lead_score}`} tone="success" />
          ) : null}
        </View>
      </Card>
      <Card style={{ gap: spacing.xs }}>
        <Body style={styles.section}>Notas</Body>
        <Muted>{('notes' in contact && contact.notes) || 'Sem notas.'}</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  section: { fontFamily: typography.fontFamilySemiBold },
});
