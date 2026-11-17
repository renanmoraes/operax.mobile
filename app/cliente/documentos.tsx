import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsGroup, SettingsRow, EmptyState } from '@/src/design-system/ui';
import { showDialog } from '@/src/design-system/Dialog';
import { openRemoteFile } from '@/src/features/portal/openRemote';
import { PortalPage, errorText } from '@/src/features/portal/PortalPage';
import { shortDate } from '@/src/features/portal/format';
import { useFocusRefetch } from '@/src/features/portal/useFocusRefetch';
import { usePortalHome } from '@/src/features/portal/usePortal';
import { portalOpenDocument } from '@/src/shared/api/portal.api';

const KINDS = ['generic', 'fiscal', 'service_order', 'exam', 'other'] as const;

export default function DocumentsScreen() {
  const { t } = useTranslation('portal');
  const home = usePortalHome();
  useFocusRefetch(home.refetch);
  const [busy, setBusy] = useState<string | null>(null);
  const caps = home.data?.capabilities;
  const docs = (home.data?.documents ?? []).filter((d) => d.kind !== 'fiscal' || caps?.fiscal);

  const open = async (id: string, title: string) => {
    setBusy(id);
    try {
      const { url } = await portalOpenDocument(id);
      await openRemoteFile(url, title);
    } catch (e) {
      await showDialog({ title: errorText(e, t('documents.openFail')), tone: 'warn' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <PortalPage title={t('documents.title')} lead={t('documents.lead')} loading={home.isLoading} error={home.isError ? t('common.loadFail') : null} onRetry={() => void home.refetch()}>
      {!docs.length ? <EmptyState icon="document-text-outline" title={t('documents.empty')} /> : null}
      {docs.length ? (
        <SettingsGroup>
          {docs.map((d, i) => {
            const kind = (KINDS as readonly string[]).includes(d.kind) ? (d.kind as (typeof KINDS)[number]) : 'generic';
            return (
              <SettingsRow
                key={d.id}
                icon="document-text-outline"
                title={d.title}
                subtitle={`${t(`documents.kind.${kind}`)}${d.released_at ? ` · ${shortDate(d.released_at)}` : ''}`}
                onPress={d.has_file && busy !== d.id ? () => void open(d.id, d.title) : undefined}
                last={i === docs.length - 1}
              />
            );
          })}
        </SettingsGroup>
      ) : null}
    </PortalPage>
  );
}
