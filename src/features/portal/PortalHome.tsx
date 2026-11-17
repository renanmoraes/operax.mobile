import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/src/design-system/tokens';
import { Badge, Card, Muted, SectionHeader, SettingsGroup, SettingsRow, type IconName } from '@/src/design-system/ui';
import { orderStatus } from './format';
import { usePortalHome, usePortalShortcuts, type PortalShortcut } from './usePortal';

const ICON: Record<PortalShortcut['key'], IconName> = {
  services: 'construct-outline',
  payments: 'wallet-outline',
  exams: 'flask-outline',
  reminders: 'notifications-outline',
  card: 'id-card-outline',
  documents: 'document-text-outline',
};

/** O que pede resposta do cliente agora: orçamento ou serviço esperando aprovação. Some quando não há nada. */
export function PortalAttention() {
  const { t } = useTranslation('portal');
  const home = usePortalHome();
  const waiting = (home.data?.service_orders ?? []).filter((o) => o.can_respond || o.can_approve).slice(0, 2);
  if (!waiting.length) return null;
  return (
    <View style={{ gap: 10, marginTop: 14 }}>
      {waiting.map((o) => (
        <Card key={o.id} onPress={() => router.push(`/cliente/servico/${encodeURIComponent(o.id)}`)} accessibilityLabel={`${o.title}, ${orderStatus(o).label}`} style={styles.attention}>
          <View style={styles.dot}><Ionicons name="construct-outline" size={18} color={colors.warnText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.attTitle} numberOfLines={1}>{o.title}</Text>
            <Muted style={{ fontSize: 12.5 }}>{t('services.status.awaitingYou')}</Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      ))}
    </View>
  );
}

/** Atalhos para tudo que a empresa liberou no portal, com selo do que espera o cliente. */
export function PortalShortcutList() {
  const { t } = useTranslation('portal');
  const items = usePortalShortcuts(t as unknown as (k: string, o?: Record<string, unknown>) => string);
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <SectionHeader title={t('hub.title')} />
      <SettingsGroup>
        {items.map((it, i) => (
          <SettingsRow
            key={it.key}
            icon={ICON[it.key]}
            title={t(`hub.${it.key}` as 'hub.services')}
            subtitle={it.sub}
            subtitleTone={it.badge ? 'warn' : undefined}
            right={it.badge ? <Badge label={String(it.badge)} tone="warn" /> : undefined}
            onPress={() => router.push(it.href as never)}
            last={i === items.length - 1}
          />
        ))}
      </SettingsGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  attention: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.warn },
  dot: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.warnSoft, alignItems: 'center', justifyContent: 'center' },
  attTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
});
