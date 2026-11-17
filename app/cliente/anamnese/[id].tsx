import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { colors, typography } from '@/src/design-system/tokens';
import { Button, Card, Muted } from '@/src/design-system/ui';
import { Question } from '@/src/features/portal/AnamneseQuestion';
import { PortalPage, errorText } from '@/src/features/portal/PortalPage';
import { usePortalAnamnesisForm, usePortalScope } from '@/src/features/portal/usePortal';
import { portalAnamnesisAnswer, type AnamneseAnswers } from '@/src/shared/api/portal.api';

/** O formulário de uma anamnese: o aluno responde e envia para a equipe. */
export default function AnamnesisFormScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('portal');
  const qc = useQueryClient();
  const { tenant } = usePortalScope();
  const form = usePortalAnamnesisForm(id);
  const [answers, setAnswers] = useState<AnamneseAnswers>({});

  const send = useMutation({
    mutationFn: () => portalAnamnesisAnswer(id, answers),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['portal', tenant, 'anamnesis-pending'] });
      await showDialog({ title: t('anam.sent'), tone: 'success' });
      router.back();
    },
    onError: (e) => void showDialog({ title: errorText(e, t('common.loadFail')), tone: 'warn' }),
  });

  const questions = form.data?.questions ?? [];
  const missing = questions.filter((q) => q.required && !answers[q.id]).length;

  return (
    <PortalPage title={form.data?.name ?? t('anam.title')} loading={form.isLoading} error={form.isError || (!form.isLoading && !form.data) ? t('anam.gone') : null}>
      <Muted>{t('anam.intro')}</Muted>
      <Card style={{ gap: 22 }}>
        {questions.map((q, i) => {
          const before = questions.slice(0, i).reverse().find((x) => x.section)?.section;
          return (
            <View key={q.id} style={{ gap: 12 }}>
              {q.section && q.section !== before ? <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: 17, color: colors.text }}>{q.section}</Text> : null}
              <Question
                q={q}
                value={answers[q.id]}
                onChange={(v) =>
                  setAnswers((old) => {
                    const next = { ...old };
                    if (v) next[q.id] = v;
                    else delete next[q.id];
                    return next;
                  })
                }
              />
            </View>
          );
        })}
      </Card>
      <Button label={missing > 0 ? t('anam.missingCount', { count: missing }) : t('anam.send')} loading={send.isPending} disabled={missing > 0} onPress={() => send.mutate()} />
    </PortalPage>
  );
}
