import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, IconName, IconTile, Muted, PressableScale, Rise } from '@/src/design-system/ui';
import { colors, text } from '@/src/design-system/tokens';
import { openSystemSettings } from './permissions';
import type { PermissionState } from './permissionState';

/** Botão de cada permissão: liberar, já ativa, ou abrir os ajustes do sistema quando foi negada. */
export function StatusAction({ state, onRequest, grantLabel }: { state: PermissionState | undefined; onRequest: () => void; grantLabel: string }) {
  const { t } = useTranslation('client');
  if (state === 'granted') return <Badge label={t('permissions.enabled')} tone="success" icon="checkmark" />;
  if (state === 'unavailable') return <Badge label={t('permissions.onPhoneApp')} tone="neutral" />;
  if (state === 'blocked') return <Button label={t('permissions.openSettings')} variant="soft" compact onPress={openSystemSettings} />;
  return <Button label={grantLabel} compact onPress={onRequest} />;
}

/** Cartão de uma permissão. Com `onPress`, o cartão inteiro abre a tela do assunto (ex.: Relógios). */
export function PermissionCard({ icon, title, body, action, index, onPress }: { icon: IconName; title: string; body: string; action: ReactNode; index: number; onPress?: () => void }) {
  const card = (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <IconTile icon={icon} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Muted style={styles.cardBody}>{body}</Muted>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ alignSelf: 'center' }} /> : null}
      </View>
      <View style={styles.cardAction}>{action}</View>
    </Card>
  );
  return (
    <Rise index={index}>
      {onPress ? (
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
          {card}
        </PressableScale>
      ) : (
        card
      )}
    </Rise>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14 },
  cardTop: { flexDirection: 'row', gap: 14 },
  cardTitle: { ...text.section, color: colors.text },
  cardBody: { marginTop: 4, fontSize: 13.5, lineHeight: 19.5 },
  cardAction: { alignItems: 'flex-start', paddingLeft: 60 },
});
