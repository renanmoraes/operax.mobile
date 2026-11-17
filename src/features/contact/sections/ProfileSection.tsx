import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { Button, Card, Chip, Field, IconButton, Loading, Muted, Segmented } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useCan } from '@/src/features/auth/useCan';
import { birthToIso, emailValid, maskDate, maskPhone, maskZip, phoneForServer } from '@/src/features/pos/signup';
import {
  addContactPhone, addContactTag, blockContact, getContact, listDistinctTags, removeContactPhone, removeContactTag, unblockContact, updateContact,
  type ApiContact, type ContactUpdate,
} from '@/src/shared/api/contacts.api';
import { dayLabel, ymdToBr } from '../format';
import { QueryState } from '../parts';

const STAGES = ['lead', 'interested', 'qualified', 'hot', 'prospect', 'customer', 'churned'] as const;
const SOURCES = ['whatsapp', 'manual', 'import', 'webchat', 'instagram', 'pos', 'portal', 'other'] as const;

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>{value}</Text>
    </View>
  );
}

export function ProfileSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['contact', contactId], queryFn: () => getContact(contactId) });
  const [editing, setEditing] = useState(false);
  const c = q.data;
  const canUpdate = can('contactsUpdate');
  const canTags = canUpdate || can('contacts:manage_tags');
  const canPhones = canUpdate || can('contacts:manage_phones');
  const canBlock = can('contacts:block');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['contact', contactId] });

  if (!c) {
    return q.isError ? <QueryState loading={false} error empty={false} emptyTitle="" onRetry={() => void q.refetch()}><View /></QueryState> : <Loading />;
  }

  const none = t('empty');
  const stage = (STAGES as readonly string[]).includes(c.lifecycle_stage ?? '') ? t(`profile.stages.${c.lifecycle_stage as (typeof STAGES)[number]}`) : c.lifecycle_stage || none;
  const origin = c.source ? ((SOURCES as readonly string[]).includes(c.source) ? t(`profile.sources.${c.source as (typeof SOURCES)[number]}`) : c.source) : none;
  const address = [
    [c.address_street, c.address_number].filter(Boolean).join(', '),
    c.address_complement,
    c.address_district,
    [c.address_city, c.address_state].filter(Boolean).join(' - '),
    c.address_zip ? maskZip(c.address_zip) : null,
  ].filter(Boolean).join('\n');

  const toggleBlock = async () => {
    try {
      if (c.is_blocked) {
        await unblockContact(contactId);
        void showDialog({ title: t('profile.unblocked'), tone: 'success' });
      } else {
        const ok = await confirmDialog({ title: t('profile.blockTitle'), message: t('profile.blockBody'), confirmLabel: t('profile.blockConfirm'), tone: 'danger' });
        if (!ok) return;
        await blockContact(contactId);
      }
      refresh();
    } catch {
      void showDialog({ title: t('profile.saveFailed'), tone: 'warn' });
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
        <Row label={t('profile.name')} value={c.name || none} />
        <Row label={t('profile.whatsapp')} value={c.phone_e164 ? maskPhone(c.phone_e164) : none} />
        <Row label={t('profile.email')} value={c.email || none} />
        <Row label={t('profile.birth')} value={ymdToBr(c.birth_date) || none} />
        <Row label={t('profile.sex')} value={c.sex === 'female' ? t('profile.sexFemale') : c.sex === 'male' ? t('profile.sexMale') : none} />
        <Row label={t('profile.company')} value={c.company_name || none} />
        <Row label={t('profile.document')} value={c.document_number || none} />
        <Row label={t('profile.stage')} value={stage} />
        <Row label={t('profile.origin')} value={origin} />
        <Row label={t('profile.address')} value={address || none} />
        <Row label={t('profile.created')} value={dayLabel(c.created_at) || none} last />
      </Card>

      {canUpdate ? <Button label={t('profile.edit')} variant="soft" icon="create-outline" onPress={() => setEditing(true)} /> : null}

      <PhonesBlock contact={c} canEdit={canPhones} onChanged={refresh} />
      <TagsBlock contact={c} canEdit={canTags} onChanged={refresh} />

      {canBlock ? <Button label={c.is_blocked ? t('profile.unblock') : t('profile.block')} variant={c.is_blocked ? 'secondary' : 'ghost'} onPress={() => void toggleBlock()} /> : null}

      {editing ? <EditSheet contact={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} /> : null}
    </View>
  );
}

function PhonesBlock({ contact, canEdit, onChanged }: { contact: ApiContact; canEdit: boolean; onChanged: () => void }) {
  const { t } = useTranslation('contact');
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const phones = contact.phones ?? [];
  const add = useMutation({
    mutationFn: () => addContactPhone(contact.id, { phone_e164: phoneForServer(phone) ?? '', label: label.trim() || undefined }),
    onSuccess: () => { setPhone(''); setLabel(''); onChanged(); },
    onError: () => void showDialog({ title: t('profile.saveFailed'), tone: 'warn' }),
  });
  if (!phones.length && !canEdit) return null;
  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.blockTitle}>{t('profile.phones')}</Text>
      {phones.map((p) => (
        <View key={p.id} style={styles.phoneRow}>
          <Text style={styles.rowValueLeft}>{maskPhone(p.phone_e164)}{p.label ? ` · ${p.label}` : ''}</Text>
          {canEdit ? (
            <IconButton
              icon="close"
              accessibilityLabel={t('profile.removePhone', { phone: maskPhone(p.phone_e164) })}
              onPress={() => void removeContactPhone(contact.id, p.id).then(onChanged).catch(() => showDialog({ title: t('profile.saveFailed'), tone: 'warn' }))}
            />
          ) : null}
        </View>
      ))}
      {canEdit ? (
        <View style={{ gap: 10 }}>
          <Field label={t('profile.addPhone')} value={phone} onChangeText={(v) => setPhone(maskPhone(v))} keyboardType="phone-pad" />
          <Field label={t('profile.phoneLabel')} value={label} onChangeText={setLabel} />
          <Button label={t('profile.addTagButton')} variant="soft" loading={add.isPending} disabled={!phoneForServer(phone)} onPress={() => add.mutate()} />
        </View>
      ) : null}
    </Card>
  );
}

function TagsBlock({ contact, canEdit, onChanged }: { contact: ApiContact; canEdit: boolean; onChanged: () => void }) {
  const { t } = useTranslation('contact');
  const [tag, setTag] = useState('');
  const own = (Array.isArray(contact.tags) ? contact.tags : []).map((x) => (typeof x === 'string' ? x : x.tag || x.name || '')).filter(Boolean);
  const suggestions = useQuery({ queryKey: ['contact-tags-all'], enabled: canEdit, staleTime: 5 * 60_000, queryFn: listDistinctTags });
  const free = (suggestions.data ?? []).filter((s) => !own.includes(s) && (!tag.trim() || s.toLowerCase().includes(tag.trim().toLowerCase()))).slice(0, 8);
  const fail = () => void showDialog({ title: t('profile.tagFailed'), tone: 'warn' });
  const add = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    try {
      await addContactTag(contact.id, v);
      setTag('');
      onChanged();
    } catch {
      fail();
    }
  };
  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.blockTitle}>{t('profile.tags')}</Text>
      {own.length === 0 ? <Muted>{t('profile.noTags')}</Muted> : null}
      <View style={styles.wrap}>
        {own.map((x) => (
          <Pressable
            key={x}
            disabled={!canEdit}
            onPress={() => void removeContactTag(contact.id, x).then(onChanged).catch(fail)}
            accessibilityRole={canEdit ? 'button' : undefined}
            accessibilityLabel={canEdit ? t('profile.removeTag', { tag: x }) : x}
            style={styles.tag}
          >
            <Text style={styles.tagText}>{x}</Text>
            {canEdit ? <Ionicons name="close" size={14} color={colors.primaryDeep} /> : null}
          </Pressable>
        ))}
      </View>
      {canEdit ? (
        <View style={{ gap: 10 }}>
          <Field label={t('profile.addTag')} value={tag} onChangeText={setTag} autoCapitalize="none" />
          {free.length ? <View style={styles.wrap}>{free.map((s) => <Chip key={s} label={s} onPress={() => void add(s)} />)}</View> : null}
          <Button label={t('profile.addTagButton')} variant="soft" disabled={!tag.trim()} onPress={() => void add(tag)} />
        </View>
      ) : null}
    </Card>
  );
}

function EditSheet({ contact, onClose, onSaved }: { contact: ApiContact; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('contact');
  const [f, setF] = useState({
    name: contact.name ?? '',
    email: contact.email ?? '',
    phone: contact.phone_e164 ? maskPhone(contact.phone_e164) : '',
    birth: ymdToBr(contact.birth_date),
    sex: (contact.sex ?? '') as '' | 'female' | 'male',
    company: contact.company_name ?? '',
    document: contact.document_number ?? '',
    stage: contact.lifecycle_stage ?? '',
    zip: contact.address_zip ? maskZip(contact.address_zip) : '',
    street: contact.address_street ?? '',
    number: contact.address_number ?? '',
    complement: contact.address_complement ?? '',
    district: contact.address_district ?? '',
    city: contact.address_city ?? '',
    state: contact.address_state ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const orNull = (v: string) => (v.trim() ? v.trim() : null);
      const body: ContactUpdate = {
        name: orNull(f.name),
        email: orNull(f.email),
        company_name: orNull(f.company),
        document_number: orNull(f.document),
        birth_date: f.birth ? birthToIso(f.birth) : null,
        sex: f.sex || null,
        address_zip: orNull(f.zip.replace(/\D/g, '')),
        address_street: orNull(f.street),
        address_number: orNull(f.number),
        address_complement: orNull(f.complement),
        address_district: orNull(f.district),
        address_city: orNull(f.city),
        address_state: orNull(f.state.toUpperCase()),
      };
      if (f.stage) body.lifecycle_stage = f.stage;
      const phone = phoneForServer(f.phone);
      if (phone && phone !== (contact.phone_e164 ?? '').replace(/\D/g, '')) body.phone_e164 = phone;
      return updateContact(contact.id, body);
    },
    onSuccess: onSaved,
    onError: () => setError(t('profile.saveFailed')),
  });

  const submit = () => {
    if (f.email.trim() && !emailValid(f.email)) return setError(t('profile.emailInvalid'));
    if (f.birth && !birthToIso(f.birth)) return setError(t('profile.birthInvalid'));
    if (f.phone.trim() && !phoneForServer(f.phone)) return setError(t('profile.phoneInvalid'));
    setError(null);
    save.mutate();
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={t('profile.editTitle')}
      footer={
        <View style={{ gap: 8 }}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label={t('profile.save')} loading={save.isPending} onPress={submit} />
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        <Field label={t('profile.name')} value={f.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" />
        <Field label={t('profile.whatsapp')} value={f.phone} onChangeText={(v) => set('phone', maskPhone(v))} keyboardType="phone-pad" />
        <Field label={t('profile.email')} value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
        <Field label={t('profile.birth')} value={f.birth} onChangeText={(v) => set('birth', maskDate(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} />
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>{t('profile.sex')}</Text>
          <Segmented
            value={f.sex || 'none'}
            onChange={(k) => set('sex', k === 'none' ? '' : (k as 'female' | 'male'))}
            options={[{ key: 'none', label: t('profile.sexNone') }, { key: 'female', label: t('profile.sexFemale') }, { key: 'male', label: t('profile.sexMale') }]}
          />
        </View>
        <Field label={t('profile.company')} value={f.company} onChangeText={(v) => set('company', v)} />
        <Field label={t('profile.document')} value={f.document} onChangeText={(v) => set('document', v)} keyboardType="number-pad" />
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>{t('profile.stage')}</Text>
          <View style={styles.wrap}>
            {STAGES.map((s) => <Chip key={s} label={t(`profile.stages.${s}`)} selected={f.stage === s} onPress={() => set('stage', s)} />)}
          </View>
        </View>
        <Text style={styles.blockTitle}>{t('profile.address')}</Text>
        <Field label={t('profile.zip')} value={f.zip} onChangeText={(v) => set('zip', maskZip(v))} keyboardType="number-pad" maxLength={9} />
        <Field label={t('profile.street')} value={f.street} onChangeText={(v) => set('street', v)} />
        <Field label={t('profile.number')} value={f.number} onChangeText={(v) => set('number', v)} />
        <Field label={t('profile.complement')} value={f.complement} onChangeText={(v) => set('complement', v)} />
        <Field label={t('profile.district')} value={f.district} onChangeText={(v) => set('district', v)} />
        <Field label={t('profile.city')} value={f.city} onChangeText={(v) => set('city', v)} />
        <Field label={t('profile.state')} value={f.state} onChangeText={(v) => set('state', v.toUpperCase())} autoCapitalize="characters" maxLength={2} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, gap: 2 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  rowValue: { fontFamily: typography.fontFamilyMedium, fontSize: 15.5, color: colors.text },
  rowValueLeft: { flex: 1, fontFamily: typography.fontFamily, fontSize: 15, color: colors.text },
  blockTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryTint, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  tagText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primaryDeep },
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  error: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.dangerText },
});
