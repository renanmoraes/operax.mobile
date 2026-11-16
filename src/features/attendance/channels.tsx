import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '@/src/i18n';
import { colors, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { listInboxConnections, type InboxConnection } from '@/src/shared/api/attendance.api';

/**
 * Empresa com vários números e canais: cada número (conexão) tem uma cor fixa, calculada pelo id (a mesma
 * conta em toda tela, como no Operax web), e o nome que a empresa deu nos ajustes ("Vendas", "Suporte").
 * O atendente reconhece de relance por qual número a conversa chegou, sem ler.
 */

const TONES = [
  { fg: '#0f766e', bg: '#d7f5ee' },
  { fg: '#c2410c', bg: '#ffedd5' },
  { fg: '#be185d', bg: '#fce7f3' },
  { fg: '#1d4ed8', bg: '#dbe7ff' },
  { fg: '#4d7c0f', bg: '#e8f6d2' },
] as const;

export function connectionTone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const CHANNEL_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  whatsapp: 'logo-whatsapp',
  instagram: 'logo-instagram',
  messenger: 'chatbubbles',
  telegram: 'paper-plane',
  webchat: 'globe-outline',
  marketplace: 'storefront-outline',
};

/** Conversa de marketplace (Hub Comercial): o canal é `hub:<canal>`, por exemplo `hub:mercado-livre`. */
export const isMarketplaceChannel = (channel: string | null | undefined): boolean => (channel ?? '').toLowerCase().startsWith('hub:');

/** Nome de marca de cada marketplace, igual ao site (não se traduz). */
const MARKETPLACE_NAMES: Record<string, string> = {
  'mercado-livre': 'Mercado Livre',
  amazon: 'Amazon',
  shopee: 'Shopee',
  magalu: 'Magalu',
  ifood: 'iFood Mercado',
  'tiktok-shop': 'TikTok Shop',
};

/** Nome do canal ("Instagram", "Chat no site"; marketplaces como `hub:mercado-livre` → "Mercado Livre"). */
export function channelName(channel: string | null | undefined): string {
  const c = (channel ?? '').toLowerCase();
  if (isMarketplaceChannel(c)) return MARKETPLACE_NAMES[c.slice(4)] ?? i18n.t('attendance:channel.marketplace');
  if (c === 'whatsapp' || c === 'instagram' || c === 'messenger' || c === 'telegram' || c === 'webchat' || c === 'marketplace') return i18n.t(`attendance:channel.${c}`);
  return i18n.t('attendance:channel.other');
}

export const connectionLabel = (c: InboxConnection) => c.display_name || c.external_display_name || channelName(c.channel_type);

/** Números de exemplo do modo demonstração (para a tela poder ser vista sem servidor). */
export const DEMO_CONNECTIONS: InboxConnection[] = [
  { id: 'demo-vendas', channel_type: 'whatsapp', display_name: 'Vendas', external_display_name: '+55 11 90000-0001' },
  { id: 'demo-suporte', channel_type: 'whatsapp', display_name: 'Suporte', external_display_name: '+55 11 90000-0002' },
];

/** Demonstração: as conversas de WhatsApp se dividem entre os dois números de exemplo. */
function demoConnectionFor(conv: { id: string; channel: string }): string | null {
  if (conv.channel !== 'whatsapp') return null;
  let h = 0;
  for (let i = 0; i < conv.id.length; i++) h += conv.id.charCodeAt(i);
  return h % 2 ? 'demo-vendas' : 'demo-suporte';
}

/** Números da empresa que este usuário atende. `multi`: só vale mostrar o número quando há mais de um. */
export function useInboxConnections() {
  const { mode } = useAuth();
  const live = mode === 'live';
  const q = useQuery({ queryKey: ['inbox-connections'], enabled: live, staleTime: 5 * 60_000, queryFn: listInboxConnections });
  const data = q.data;
  return useMemo(() => {
    const connections = live ? data ?? [] : DEMO_CONNECTIONS;
    const byId = new Map(connections.map((c) => [c.id, c]));
    /** Número por onde a conversa chegou (no demo, distribuído entre os de exemplo). */
    const idOf = (conv: { id: string; channel: string; connectionId?: string | null }) => (live ? conv.connectionId ?? null : demoConnectionFor(conv));
    // A conexão do Hub Comercial (marketplace) não é um número: não liga o selo de número nem entra no filtro.
    const numbers = connections.filter((c) => (c.channel_type ?? '').toLowerCase() !== 'marketplace');
    return { connections: numbers, byId, idOf, multi: numbers.length > 1 };
  }, [live, data]);
}

/** Selo do número/canal: bolinha na cor do número e o nome. Outros canais (Instagram, site) mostram o ícone. */
export function ChannelChip({ connection, channel, size = 'sm' }: { connection?: InboxConnection | null; channel?: string | null; size?: 'sm' | 'xs' }) {
  const ch = (connection?.channel_type ?? channel ?? 'whatsapp').toLowerCase();
  const tone = connection ? connectionTone(connection.id) : { fg: colors.textSoft, bg: '#eef1f6' };
  const label = connection ? connectionLabel(connection) : channelName(ch);
  const icon = CHANNEL_ICON[ch] ?? (ch.startsWith('hub:') ? 'storefront-outline' : 'chatbubble-ellipses-outline');
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }, size === 'xs' && styles.chipXs]} accessibilityLabel={label}>
      {connection && ch === 'whatsapp' ? <View style={[styles.dot, { backgroundColor: tone.fg }]} /> : <Ionicons name={icon} size={size === 'xs' ? 11 : 12} color={tone.fg} />}
      <Text style={[styles.label, { color: tone.fg }, size === 'xs' && { fontSize: 11 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Filtro por número no topo do atendimento (só aparece com mais de um número). */
export function NumberFilter({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { t } = useTranslation('attendance');
  const { connections, multi } = useInboxConnections();
  if (!multi) return null;
  return (
    <View style={styles.filterRow}>
      <Pressable onPress={() => onChange(null)} accessibilityRole="radio" accessibilityState={{ selected: value === null }} style={[styles.filter, value === null && styles.filterOn]}>
        <Text style={[styles.filterText, value === null && { color: '#fff' }]}>{t('number.all')}</Text>
      </Pressable>
      {connections.map((c) => {
        const on = value === c.id;
        const tone = connectionTone(c.id);
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(on ? null : c.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t('number.filterA11y', { name: connectionLabel(c) })}
            style={[styles.filter, on && { backgroundColor: tone.fg, borderColor: tone.fg }]}
          >
            <View style={[styles.dot, { backgroundColor: on ? '#fff' : tone.fg }]} />
            <Text style={[styles.filterText, on && { color: '#fff' }]} numberOfLines={1}>
              {connectionLabel(c)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 22, paddingHorizontal: 8, borderRadius: 999, maxWidth: 150 },
  chipXs: { height: 19, paddingHorizontal: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, flexShrink: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  filterOn: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.text, maxWidth: 140 },
});
