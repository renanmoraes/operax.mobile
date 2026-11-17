import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Loading, Muted, Screen, TopBar } from '@/src/design-system/ui';
import { text } from '@/src/design-system/tokens';

/**
 * Moldura das telas do portal: barra com voltar, texto de apoio e os três estados (carregando, erro, pronto).
 * `error` mostra a mensagem do servidor quando há; sem ela, o texto padrão.
 */
export function PortalPage({
  title,
  lead,
  loading,
  error,
  onRetry,
  right,
  children,
}: {
  title: string;
  lead?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation('portal');
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <TopBar safe title={title} onBack={() => router.back()} right={right} />
      {loading ? (
        <Loading label={t('common.loading')} />
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title={error} actionLabel={onRetry ? t('common.retry') : undefined} onAction={onRetry} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          {lead ? <Muted style={styles.lead}>{lead}</Muted> : null}
          {children}
        </ScrollView>
      )}
    </Screen>
  );
}

/** Texto de erro de uma consulta: a mensagem do servidor quando existe, senão o padrão. */
export function errorText(e: unknown, fallback: string): string {
  const m = (e as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof m === 'string' && m ? m : fallback;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  lead: { ...text.body, lineHeight: 21, marginBottom: 4 },
});
