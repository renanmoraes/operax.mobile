import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { confirmDialog, showDialog } from '@/src/design-system/Dialog';
import { Button, Chip, Field } from '@/src/design-system/ui';
import { colors, typography } from '@/src/design-system/tokens';
import { useCan } from '@/src/features/auth/useCan';
import { birthToIso, cpfValid, maskCpf, maskDate, maskPhone, phoneForServer } from '@/src/features/pos/signup';
import { createDependent, listDependents, removeDependent, updateDependent, type ContactDependent } from '@/src/shared/api/contacts.api';
import { ageOf, ymdToBr } from '../format';
import { QueryState, RowCard } from '../parts';

/** O servidor guarda o parentesco como texto; o web grava estes (em português), então o app grava os mesmos. */
const RELATIONS = [
  ['spouse', 'Cônjuge ou companheiro(a)'], ['child', 'Filho(a)'], ['stepchild', 'Enteado(a)'], ['parent', 'Pai ou mãe'], ['sibling', 'Irmão ou irmã'],
  ['grandparent', 'Avô ou avó'], ['grandchild', 'Neto(a)'], ['guardian', 'Tutor(a) ou responsável'], ['other', 'Outro'],
] as const;
type RelKey = (typeof RELATIONS)[number][0];
const keyOf = (stored: string): RelKey | null => RELATIONS.find(([, pt]) => pt === stored)?.[0] ?? null;

export function DependentsSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation('contact');
  const can = useCan();
  const canEdit = can('contactsUpdate');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['contact', contactId, 'dependents'], queryFn: () => listDependents(contactId) });
  const [editing, setEditing] = useState<ContactDependent | 'new' | null>(null);
  const items = q.data ?? [];
  const relLabel = (stored: string) => {
    const k = keyOf(stored);
    return k ? t(`dependents.relations.${k}`) : stored;
  };

  return (
    <View style={{ gap: 12 }}>
      <QueryState loading={q.isLoading} error={q.isError} failure={q.error} empty={items.length === 0} emptyIcon="people-outline" emptyTitle={t('dependents.empty')} onRetry={() => void q.refetch()}>
        <View style={{ gap: 10 }}>
          {items.map((d) => {
            const age = ageOf(d.birth_date);
            return (
              <RowCard
                key={d.id}
                title={d.full_name}
                lines={[[relLabel(d.relationship), age != null ? t('dependents.age', { count: age }) : null].filter(Boolean).join(' · '), ymdToBr(d.birth_date)]}
                onPress={canEdit ? () => setEditing(d) : undefined}
                right={canEdit ? <Ionicons name="create-outline" size={18} color={colors.textMuted} /> : undefined}
              />
            );
          })}
        </View>
      </QueryState>
      {canEdit ? <Button label={t('dependents.add')} variant="soft" onPress={() => setEditing('new')} /> : null}
      {editing ? (
        <DependentSheet
          contactId={contactId}
          dependent={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ['contact', contactId, 'dependents'] });
          }}
        />
      ) : null}
    </View>
  );
}

function DependentSheet({ contactId, dependent, onClose, onChanged }: { contactId: string; dependent: ContactDependent | null; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation('contact');
  const [name, setName] = useState(dependent?.full_name ?? '');
  const [birth, setBirth] = useState(ymdToBr(dependent?.birth_date));
  const [cpf, setCpf] = useState(maskCpf(dependent?.cpf ?? ''));
  const [rel, setRel] = useState<RelKey | null>(keyOf(dependent?.relationship ?? '') ?? (dependent ? 'other' : null));
  const [phone, setPhone] = useState(dependent?.phone_e164 ? maskPhone(dependent.phone_e164) : '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const birthIso = birthToIso(birth);
      const relPt = RELATIONS.find(([k]) => k === rel)?.[1] ?? '';
      const input = { full_name: name.trim(), birth_date: birthIso ?? '', cpf: cpf.replace(/\D/g, ''), relationship: dependent && rel === 'other' && keyOf(dependent.relationship) == null ? dependent.relationship : relPt, phone_e164: phone.trim() ? phoneForServer(phone) : null };
      return dependent ? updateDependent(contactId, dependent.id, input) : createDependent(contactId, input);
    },
    onSuccess: onChanged,
    onError: () => setError(t('dependents.saveFailed')),
  });

  const submit = () => {
    if (name.trim().length < 2) return setError(t('dependents.nameRequired'));
    if (!birthToIso(birth)) return setError(t('dependents.birthInvalid'));
    if (!cpfValid(cpf)) return setError(t('dependents.cpfInvalid'));
    if (!rel) return setError(t('dependents.relRequired'));
    if (phone.trim() && !phoneForServer(phone)) return setError(t('profile.phoneInvalid'));
    setError(null);
    save.mutate();
  };

  const remove = async () => {
    if (!dependent) return;
    const ok = await confirmDialog({ title: t('dependents.removeTitle', { name: dependent.full_name }), message: t('dependents.removeBody'), confirmLabel: t('dependents.remove'), tone: 'danger' });
    if (!ok) return;
    try {
      await removeDependent(contactId, dependent.id);
      onChanged();
    } catch {
      void showDialog({ title: t('dependents.removeFailed'), tone: 'warn' });
    }
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={t('dependents.editTitle')}
      footer={
        <View style={{ gap: 8 }}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label={t('dependents.save')} loading={save.isPending} onPress={submit} />
          {dependent ? <Button label={t('dependents.remove')} variant="ghost" onPress={() => void remove()} /> : null}
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        <Field label={t('dependents.name')} value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label={t('dependents.birth')} value={birth} onChangeText={(v) => setBirth(maskDate(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} />
        <Field label={t('dependents.cpf')} value={cpf} onChangeText={(v) => setCpf(maskCpf(v))} keyboardType="number-pad" maxLength={14} />
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>{t('dependents.relationship')}</Text>
          <View style={styles.wrap}>
            {RELATIONS.map(([k]) => (
              <Chip key={k} label={t(`dependents.relations.${k}`)} selected={rel === k} onPress={() => setRel(k)} />
            ))}
          </View>
        </View>
        <Field label={t('dependents.phone')} value={phone} onChangeText={(v) => setPhone(maskPhone(v))} keyboardType="phone-pad" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontFamily: typography.fontFamily, fontSize: 13, color: colors.dangerText },
});
