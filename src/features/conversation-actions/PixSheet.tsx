import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { Button, Chip, Field, PressableScale } from '@/src/design-system/ui';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';
import { listSavedPixKeys, PixData, PixKeyType, PIX_KEY_TYPES } from '@/src/shared/api/conversation-actions.api';
import { DEMO_PIX_KEYS, formatPixKey, pixKeyError, pixKeyTypeLabel } from './logic';
import { PixCard } from './PixCard';
import { useCan } from '@/src/features/auth/useCan';

type PixForm = { type: PixKeyType; key: string; holder: string; savedId: string | null };
const EMPTY_FORM: PixForm = { type: 'cnpj', key: '', holder: '', savedId: null };

const KEYBOARD: Record<PixKeyType, 'default' | 'email-address' | 'number-pad' | 'phone-pad'> = {
  cpf: 'number-pad',
  cnpj: 'number-pad',
  phone: 'phone-pad',
  email: 'email-address',
  random: 'default',
  copy_paste: 'default',
};

/** Enviar chave Pix na conversa (igual ao "+ → Enviar chave Pix" do Operax web). */
export function PixSheet({
  visible,
  onClose,
  live,
  sending,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  live: boolean;
  sending?: boolean;
  onSend: (pix: PixData & { save?: boolean }) => void;
}) {
  const { t } = useTranslation('inbox');
  const { user } = useAuth();
  // A conta faz parte da chave: chaves Pix de uma empresa nunca aparecem em outra.
  const saved = useQuery({ queryKey: ['pix-keys', user?.id, user?.kind === 'staff' ? user.tenant_id : null], enabled: live && visible, queryFn: listSavedPixKeys, staleTime: 60_000 });
  const keys = live ? saved.data ?? [] : DEMO_PIX_KEYS;
  const [save, setSave] = useState(false);
  const canSaveKeys = useCan()('pixKeysManage');
  const [touched, setTouched] = useState(false);

  // Enquanto a pessoa não mexe, o formulário mostra a chave mais usada (como no web), sem efeito.
  const [form, setForm] = useState<PixForm | null>(null);
  const mostUsed = [...keys].sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0))[0];
  const f: PixForm = form ?? (mostUsed ? { type: mostUsed.key_type, key: mostUsed.key, holder: mostUsed.holder_name, savedId: mostUsed.id } : EMPTY_FORM);
  const { type, key, holder, savedId: usingSaved } = f;
  const update = (patch: Partial<PixForm>) => setForm({ ...f, ...patch });
  const setHolder = (v: string) => update({ holder: v });

  const keyErr = pixKeyError(type, key);
  const holderErr = holder.trim().length >= 2 ? null : t('pix.holderError');
  const ok = !keyErr && !holderErr;
  const isNewKey = !keys.some((k) => k.key === key.trim() && k.key_type === type);

  const reset = () => {
    setTouched(false);
    setSave(false);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('pix.title')}
      closeLabel={t('pix.close')}
      footer={
        <Button
          label={t('pix.send')}
          loading={sending}
          onPress={() => {
            setTouched(true);
            if (!ok) return;
            onSend({ key: key.trim(), key_type: type, holder_name: holder.trim(), save: isNewKey && save });
            reset();
          }}
        />
      }
    >
      <View style={{ gap: 14 }}>
        {keys.length ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>{t('pix.saved')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
              <View style={{ width: 12 }} />
              {keys.map((k) => {
                const on = usingSaved === k.id;
                return (
                  <PressableScale
                    key={k.id}
                    onPress={() => {
                      setForm({ type: k.key_type, key: k.key, holder: k.holder_name, savedId: k.id });
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t('pix.useKey', { type: pixKeyTypeLabel(k.key_type), key: k.key })}
                    style={[styles.saved, on && styles.savedOn]}
                  >
                    <Text style={[styles.savedType, on && { color: '#0f766e' }]}>{pixKeyTypeLabel(k.key_type)}</Text>
                    <Text style={styles.savedKey} numberOfLines={1}>{formatPixKey(k.key_type, k.key)}</Text>
                  </PressableScale>
                );
              })}
              <View style={{ width: 12 }} />
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>{t('pix.typeLabel')}</Text>
          <View style={styles.types}>
            {PIX_KEY_TYPES.map((opt) => (
              <Chip
                key={opt.value}
                label={pixKeyTypeLabel(opt.value)}
                selected={type === opt.value}
                onPress={() => {
                  update({ type: opt.value, savedId: null });
                }}
              />
            ))}
          </View>
        </View>

        <View>
          <Field
            label={type === 'copy_paste' ? t('pix.copyPasteLabel') : t('pix.keyLabel')}
            value={key}
            onChangeText={(v) => {
              update({ key: v, savedId: null });
            }}
            placeholder={type === 'email' ? 'nome@empresa.com' : type === 'phone' ? '(11) 98765-4321' : ''}
            keyboardType={KEYBOARD[type]}
            autoCapitalize="none"
            multiline={type === 'copy_paste'}
          />
          {touched && keyErr ? <Text style={styles.error}>{keyErr}</Text> : null}
        </View>

        <View>
          <Field label={t('pix.holderLabel')} value={holder} onChangeText={setHolder} placeholder={t('pix.holderPlaceholder')} autoCapitalize="words" />
          {touched && holderErr ? <Text style={styles.error}>{holderErr}</Text> : null}
        </View>

        {/* Guardar chave para a equipe exige a permissão de gerenciar chaves Pix (mesma do web). */}
        {isNewKey && key.trim() && canSaveKeys ? (
          <View style={styles.saveRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.saveTitle}>{t('pix.saveTitle')}</Text>
              <Text style={styles.saveSub}>{t('pix.saveSub')}</Text>
            </View>
            <Switch value={save} onValueChange={setSave} trackColor={{ true: '#0f766e', false: colors.track }} thumbColor="#fff" accessibilityLabel={t('pix.saveTitle')} />
          </View>
        ) : null}

        {ok ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>{t('pix.preview')}</Text>
            <View style={styles.preview}>
              <PixCard pix={{ key: key.trim(), key_type: type, holder_name: holder.trim() }} />
            </View>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: { ...text.label, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saved: { width: 170, padding: 12, borderRadius: radii.lg, backgroundColor: '#f6f8fb', borderWidth: 1.5, borderColor: 'transparent' },
  savedOn: { backgroundColor: '#effaf7', borderColor: '#0f766e' },
  savedType: { ...text.label, color: colors.textMuted },
  savedKey: { fontFamily: typography.fontFamilySemiBold, fontSize: 13.5, color: colors.text, marginTop: 3, fontVariant: ['tabular-nums'] },
  error: { ...text.caption, color: colors.dangerText, marginTop: 6, marginLeft: 4 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: '#f6f8fb' },
  saveTitle: { ...text.calloutStrong, color: colors.text },
  saveSub: { ...text.caption, color: colors.textMuted, marginTop: 1 },
  preview: { alignItems: 'center', paddingVertical: 14, borderRadius: radii.lg, backgroundColor: '#eef3fb' },
});
