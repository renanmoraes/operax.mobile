import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { showDialog } from '@/src/design-system/Dialog';
import { Button, Field, Muted } from '@/src/design-system/ui';
import { PortalPage, errorText } from '@/src/features/portal/PortalPage';
import { usePortalProfile, usePortalScope } from '@/src/features/portal/usePortal';
import { portalUpdateProfile, type PortalProfile } from '@/src/shared/api/portal.api';

type Form = Partial<Record<keyof PortalProfile, string>>;

/** Dados cadastrais que o cliente pode corrigir: nome (até a empresa confirmar), nascimento e endereço. */
export default function MyDataScreen() {
  const { t } = useTranslation('portal');
  const qc = useQueryClient();
  const { tenant } = usePortalScope();
  const q = usePortalProfile();
  const profile = q.data;
  const [form, setForm] = useState<Form>({});

  const value = (k: keyof PortalProfile) => form[k] ?? ((profile?.[k] as string | null) ?? '');
  // Nascimento: o cliente digita DD/MM/AAAA; o servidor recebe AAAA-MM-DD (vazio apaga).
  const [birthText, setBirthText] = useState<string | null>(null);
  const birthShown = birthText ?? (value('birth_date') ? value('birth_date').split('-').reverse().join('/') : '');
  const onBirth = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    const text = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
    setBirthText(text);
    if (!d) setForm((f) => ({ ...f, birth_date: '' }));
    else if (d.length === 8) setForm((f) => ({ ...f, birth_date: `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}` }));
  };
  const set = (k: keyof PortalProfile) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => portalUpdateProfile(form as Record<string, string | null>),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['portal', tenant, 'profile'] });
      await showDialog({ title: t('account.form.saved'), tone: 'success' });
      router.back();
    },
    onError: (e) => void showDialog({ title: errorText(e, t('common.loadFail')), tone: 'warn' }),
  });

  return (
    <PortalPage title={t('account.form.title')} loading={q.isLoading} error={q.isError ? t('common.loadFail') : null} onRetry={() => void q.refetch()}>
      {profile ? (
        <>
          <Field label={t('account.form.name')} value={value('name')} onChangeText={set('name')} editable={!profile.name_locked} autoComplete="name" icon="person-outline" />
          {profile.name_locked ? <Muted>{t('account.form.nameLocked')}</Muted> : null}
          <Field label={t('account.form.birth')} value={birthShown} onChangeText={onBirth} placeholder={t('account.form.birthHint')} keyboardType="number-pad" maxLength={10} icon="calendar-outline" />
          <Field label={t('account.form.zip')} value={value('address_zip')} onChangeText={set('address_zip')} keyboardType="number-pad" maxLength={9} icon="location-outline" />
          <Field label={t('account.form.street')} value={value('address_street')} onChangeText={set('address_street')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label={t('account.form.number')} value={value('address_number')} onChangeText={set('address_number')} /></View>
            <View style={{ flex: 1.4 }}><Field label={t('account.form.complement')} value={value('address_complement')} onChangeText={set('address_complement')} /></View>
          </View>
          <Field label={t('account.form.district')} value={value('address_district')} onChangeText={set('address_district')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}><Field label={t('account.form.city')} value={value('address_city')} onChangeText={set('address_city')} /></View>
            <View style={{ flex: 1 }}><Field label={t('account.form.state')} value={value('address_state')} onChangeText={set('address_state')} maxLength={2} autoCapitalize="characters" /></View>
          </View>
          <Muted style={{ lineHeight: 19 }}>{t('account.contactNote')}</Muted>
          <Button label={t('common.save')} loading={save.isPending} disabled={!Object.keys(form).length} onPress={() => save.mutate()} />
        </>
      ) : null}
    </PortalPage>
  );
}
