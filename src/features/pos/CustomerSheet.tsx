import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Avatar, Button, Field, PressableScale, Segmented } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { apiMessage, apiStatus, type PosContact } from '@/src/shared/api/pos.api';
import type { PosClient } from './posClient';
import { birthToIso, cpfValid, digits, emailValid, maskCpf, maskDate, maskPhone, maskZip, phoneForServer } from './signup';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cliente da venda: buscar quem já existe, deixar avulsa ou cadastrar na hora, em passos. */
export function CustomerSheet({
  client,
  current,
  canCreate,
  canConsent,
  canUploadDocument,
  onPick,
  onClose,
}: {
  client: PosClient;
  current: PosContact | null;
  canCreate: boolean;
  canConsent: boolean;
  canUploadDocument: boolean;
  onPick: (c: PosContact | null, warning?: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('pos');
  const [mode, setMode] = useState<'search' | 'signup'>('search');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const results = useQuery({ queryKey: ['pos', 'contacts', term], queryFn: () => client.searchContacts(term), enabled: term.length >= 2 });

  return (
    <BottomSheet visible onClose={onClose} title={mode === 'signup' ? t('signup.title') : t('customer.title')}>
      {mode === 'signup' ? (
        <SignupWizard
          client={client}
          initialName={/\d/.test(q) ? '' : q}
          initialPhone={/^\+?[\d\s()-]{8,}$/.test(q) ? q : ''}
          canConsent={canConsent}
          canUploadDocument={canUploadDocument}
          onDone={onPick}
          onCancel={() => setMode('search')}
        />
      ) : (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('customer.search')}
              placeholderTextColor="#6b7486"
              style={styles.searchInput}
              autoFocus
              autoCorrect={false}
              accessibilityLabel={t('customer.search')}
            />
            {results.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          <View>
            <ContactRow icon="person-outline" title={t('customer.walkIn')} selected={!current} onPress={() => onPick(null)} />
            {current && !(results.data ?? []).some((c) => c.id === current.id) ? (
              <ContactRow contact={current} title={current.name} subtitle={current.phone ? maskPhone(current.phone) : undefined} selected onPress={() => onPick(current)} />
            ) : null}
            {(results.data ?? [])
              .slice()
              .sort((a, b) => Number(fold(b.name).startsWith(fold(term))) - Number(fold(a.name).startsWith(fold(term))))
              .map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  title={c.name || maskPhone(c.phone ?? '')}
                  subtitle={[c.phone ? maskPhone(c.phone) : null, c.document_number ? maskCpf(c.document_number) : null].filter(Boolean).join(' · ') || undefined}
                  selected={current?.id === c.id}
                  onPress={() => onPick(c)}
                />
              ))}
            {term.length >= 2 && results.isSuccess && results.data.length === 0 ? <Text style={styles.empty}>{t('customer.noResults')}</Text> : null}
          </View>
          {canCreate ? <Button label={t('customer.create')} icon="person-add-outline" variant="soft" onPress={() => setMode('signup')} /> : null}
        </>
      )}
    </BottomSheet>
  );
}

function ContactRow({
  contact,
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  contact?: PosContact;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.rowPress }]}>
      {contact ? (
        <Avatar initials={initialsOf(contact.name || '?')} size={38} />
      ) : (
        <View style={styles.rowIcon}>
          <Ionicons name={icon ?? 'person-outline'} size={18} color={colors.textSoft} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
    </Pressable>
  );
}

type Step = 'contact' | 'document' | 'extra' | 'consent';

/**
 * Cadastro em passos: só o 1º é obrigatório (nome e WhatsApp). O cadastro vai ao servidor no fim, de
 * uma vez; duplicado (409) volta ao passo do dado repetido e oferece usar quem já existe.
 */
function SignupWizard({
  client,
  initialName,
  initialPhone,
  canConsent,
  canUploadDocument,
  onDone,
  onCancel,
}: {
  client: PosClient;
  initialName: string;
  initialPhone: string;
  canConsent: boolean;
  canUploadDocument: boolean;
  onDone: (c: PosContact, warning?: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('pos');
  const steps: Step[] = canConsent ? ['contact', 'document', 'extra', 'consent'] : ['contact', 'document', 'extra'];
  const [step, setStep] = useState<Step>('contact');
  const [f, setF] = useState({
    name: initialName,
    phone: initialPhone ? maskPhone(initialPhone) : '',
    email: '',
    cpf: '',
    birth: '',
    sex: '' as '' | 'female' | 'male',
    zip: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
  });
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [service, setService] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<PosContact | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const index = steps.indexOf(step);
  const last = index === steps.length - 1;

  const problem = (s: Step): string | null => {
    if (s === 'contact') {
      if (!f.name.trim() || !f.phone.trim()) return t('signup.required');
      if (!phoneForServer(f.phone)) return t('signup.phoneInvalid');
      if (f.email.trim() && !emailValid(f.email)) return t('signup.emailInvalid');
    }
    if (s === 'document' && f.cpf.trim() && !cpfValid(f.cpf)) return t('signup.cpfInvalid');
    if (s === 'extra' && f.birth.trim() && !birthToIso(f.birth)) return t('signup.birthInvalid');
    return null;
  };

  const go = (dir: 1 | -1) => {
    setError(null);
    if (dir === 1) {
      const p = problem(step);
      if (p) return setError(p);
    }
    const next = steps[index + dir];
    if (next) setStep(next);
    else if (dir === -1) onCancel();
  };

  const pickPhoto = async (camera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    if (camera) {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return;
    }
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets[0];
    if (a) setPhoto({ uri: a.uri, name: a.fileName ?? 'documento.jpg', type: a.mimeType ?? 'image/jpeg' });
  };

  const save = async () => {
    for (const s of steps) {
      const p = problem(s);
      if (p) {
        setStep(s);
        return setError(p);
      }
    }
    setSaving(true);
    setError(null);
    setExisting(null);
    const phone = phoneForServer(f.phone)!;
    try {
      const c = await client.createContact({
        name: f.name.trim(),
        phone,
        email: f.email.trim() || undefined,
        document_number: f.cpf ? digits(f.cpf) : undefined,
        birth_date: f.birth ? (birthToIso(f.birth) ?? undefined) : undefined,
        sex: f.sex || undefined,
        address_zip: f.zip ? digits(f.zip) : undefined,
        address_street: f.street.trim() || undefined,
        address_number: f.number.trim() || undefined,
        address_complement: f.complement.trim() || undefined,
        address_district: f.district.trim() || undefined,
        address_city: f.city.trim() || undefined,
        address_state: f.state.trim().toUpperCase() || undefined,
      });
      // Foto e consentimento depois do cadastro: se falharem, o cliente já existe e a venda segue.
      const extras: Promise<unknown>[] = [];
      if (photo && canUploadDocument) extras.push(client.uploadDocument(c.id, photo, t('signup.photo')));
      if (canConsent) {
        extras.push(client.recordConsent(c.id, { consent_type: 'service', status: service ? 'opted_in' : 'opted_out', source_description: 'PDV mobile' }));
        extras.push(client.recordConsent(c.id, { consent_type: 'marketing', status: marketing ? 'opted_in' : 'opted_out', source_description: 'PDV mobile' }));
      }
      const settled = await Promise.allSettled(extras);
      onDone(c, settled.some((s) => s.status === 'rejected') ? t('signup.partial') : undefined);
    } catch (e) {
      const msg = apiMessage(e);
      if (apiStatus(e) === 409) {
        setError(msg ?? t('signup.duplicate'));
        if (msg && /cpf|cnpj/i.test(msg)) setStep('document');
        else if (msg && /e-?mail/i.test(msg)) setStep('contact');
        else {
          setStep('contact');
          const found = await client.searchContacts(digits(phone).slice(-8)).catch(() => []);
          setExisting(found.find((x) => digits(x.phone ?? '').endsWith(digits(phone).slice(-8))) ?? null);
        }
      } else setError(msg ?? t('signup.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.progress}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.dot, i <= index && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.stepLabel}>
        {t('signup.step', { n: index + 1, total: steps.length })} · {t(`signup.steps.${step}`)}
      </Text>

      <View style={{ gap: 12 }}>
        {step === 'contact' ? (
          <>
            <Field label={t('signup.name')} value={f.name} onChangeText={set('name')} autoCapitalize="words" autoComplete="name" />
            <Field label={t('signup.phone')} value={f.phone} onChangeText={(v) => set('phone')(maskPhone(v))} keyboardType="phone-pad" autoComplete="tel" placeholder="(11) 98765-4321" />
            <Field label={t('signup.email')} value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          </>
        ) : null}
        {step === 'document' ? (
          <>
            <Field label={t('signup.cpf')} value={f.cpf} onChangeText={(v) => set('cpf')(maskCpf(v))} keyboardType="number-pad" placeholder="000.000.000-00" />
            <Text style={styles.hint}>{t('signup.cpfHint')}</Text>
            {canUploadDocument ? (
              photo ? (
                <View style={styles.photo}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{t('signup.photoReady')}</Text>
                    <Pressable onPress={() => setPhoto(null)} accessibilityRole="button">
                      <Text style={styles.link}>{t('signup.removePhoto')}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={styles.fieldLabel}>{t('signup.photo')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button label={t('signup.takePhoto')} icon="camera-outline" variant="secondary" compact onPress={() => void pickPhoto(true)} style={{ flex: 1 }} />
                    <Button label={t('signup.pickPhoto')} icon="images-outline" variant="secondary" compact onPress={() => void pickPhoto(false)} style={{ flex: 1 }} />
                  </View>
                </View>
              )
            ) : null}
          </>
        ) : null}
        {step === 'extra' ? (
          <>
            <Field label={t('signup.birth')} value={f.birth} onChangeText={(v) => set('birth')(maskDate(v))} keyboardType="number-pad" placeholder="31/12/1990" />
            <Text style={styles.fieldLabel}>{t('signup.sex')}</Text>
            <Segmented
              value={f.sex || 'none'}
              onChange={(v) => set('sex')(v === 'none' ? '' : v)}
              options={[
                { key: 'none', label: t('signup.noSex') },
                { key: 'female', label: t('signup.female') },
                { key: 'male', label: t('signup.male') },
              ]}
            />
            <Field label={t('signup.zip')} value={f.zip} onChangeText={(v) => set('zip')(maskZip(v))} keyboardType="number-pad" placeholder="00000-000" />
            <Field label={t('signup.street')} value={f.street} onChangeText={set('street')} autoCapitalize="words" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label={t('signup.number')} value={f.number} onChangeText={set('number')} />
              </View>
              <View style={{ flex: 2 }}>
                <Field label={t('signup.complement')} value={f.complement} onChangeText={set('complement')} />
              </View>
            </View>
            <Field label={t('signup.district')} value={f.district} onChangeText={set('district')} autoCapitalize="words" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 3 }}>
                <Field label={t('signup.city')} value={f.city} onChangeText={set('city')} autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('signup.state')} value={f.state} onChangeText={(v) => set('state')(v.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase())} autoCapitalize="none" />
              </View>
            </View>
          </>
        ) : null}
        {step === 'consent' ? (
          <>
            <ConsentRow title={t('signup.consentService')} hint={t('signup.consentServiceHint')} value={service} onChange={setService} />
            <ConsentRow title={t('signup.consentMarketing')} hint={t('signup.consentMarketingHint')} value={marketing} onChange={setMarketing} />
            <View style={styles.lgpd}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryDeep} />
              <Text style={styles.lgpdText}>{t('signup.lgpd')}</Text>
            </View>
          </>
        ) : null}
      </View>

      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
          {existing ? (
            <PressableScale onPress={() => onDone(existing)} accessibilityRole="button" style={styles.useExisting}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.link}>{t('signup.useExisting', { name: existing.name })}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={t('signup.back')} variant="ghost" onPress={() => go(-1)} compact style={{ flex: 0 }} />
        {!last && index > 0 ? <Button label={t('signup.skip')} variant="secondary" onPress={() => setStep(steps[index + 1])} compact style={{ flex: 0 }} /> : null}
        {last ? (
          <Button label={saving ? t('signup.saving') : t('signup.save')} icon="checkmark" loading={saving} onPress={() => void save()} style={{ flex: 1 }} />
        ) : (
          <Button label={t('signup.next')} icon="arrow-forward" onPress={() => go(1)} style={{ flex: 1 }} />
        )}
      </View>
    </View>
  );
}

function ConsentRow({ title, hint, value, onChange }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.consent}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.track }} thumbColor="#fff" accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 14, borderRadius: radii.control, backgroundColor: '#f1f4fa' },
  searchInput: { flex: 1, fontFamily: typography.fontFamily, fontSize: 15.5, color: colors.text, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radii.md },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f4fa', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: colors.text },
  rowSub: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  empty: { fontFamily: typography.fontFamily, fontSize: 13.5, color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  progress: { flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.track },
  dotOn: { backgroundColor: colors.primary },
  stepLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
  hint: { fontFamily: typography.fontFamily, fontSize: 12.5, color: colors.textMuted, marginTop: -6 },
  fieldLabel: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.textSoft },
  photo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: '#f1f4fa' },
  photoImg: { width: 64, height: 44, borderRadius: 8 },
  link: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.primary },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.md, backgroundColor: '#f6f8fc' },
  lgpd: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radii.md, backgroundColor: colors.primaryWash },
  lgpdText: { flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13, lineHeight: 18, color: colors.primaryDeep },
  error: { padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerSoft, gap: 8 },
  errorText: { fontFamily: typography.fontFamilyMedium, fontSize: 13.5, color: colors.dangerText },
  useExisting: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
