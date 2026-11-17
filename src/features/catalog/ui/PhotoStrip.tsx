import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/src/design-system/BottomSheet';
import { showDialog } from '@/src/design-system/Dialog';
import { Button, Muted, PressableScale } from '@/src/design-system/ui';
import { colors, radii, typography } from '@/src/design-system/tokens';
import type { UploadFile } from '@/src/shared/api/upload';
import { pickPhotos } from '../photos';

/**
 * Fotos de um produto ou de uma variação: a primeira é a capa. Toca no "+" para tirar ou escolher várias; toca
 * numa foto para usar como capa ou tirar. A lista fica com o dono da tela (`photos` + `onChange`).
 */
export function PhotoStrip({ photos, max, onChange, hint }: { photos: UploadFile[]; max: number; onChange: (next: UploadFile[]) => void; hint?: boolean }) {
  const { t } = useTranslation('catalog');
  const [source, setSource] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const add = async (camera: boolean) => {
    setSource(false);
    const r = await pickPhotos(camera, max - photos.length);
    if (r.error) void showDialog({ title: r.error === 'type' ? t('photo.type') : t('photo.tooBig'), tone: 'warn' });
    if (r.files.length) onChange([...photos, ...r.files]);
  };

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((p, i) => (
          <PressableScale key={`${p.uri}-${i}`} onPress={() => setOpenIndex(i)} accessibilityRole="button" accessibilityLabel={`${t('photo.title')} ${i + 1}${i === 0 ? `, ${t('photo.cover')}` : ''}`} style={styles.tile}>
            <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {i === 0 ? (
              <View style={styles.cover}>
                <Text style={styles.coverText}>{t('photo.cover')}</Text>
              </View>
            ) : null}
          </PressableScale>
        ))}
        {photos.length < max ? (
          <PressableScale onPress={() => setSource(true)} accessibilityRole="button" accessibilityLabel={t('photo.add')} style={[styles.tile, styles.add]}>
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={styles.addText}>{t('photo.add')}</Text>
          </PressableScale>
        ) : null}
      </ScrollView>
      {hint ? <Muted>{t('photo.hint', { max })}</Muted> : null}

      <BottomSheet visible={source} onClose={() => setSource(false)} title={t('photo.title')}>
        <View style={{ gap: 10 }}>
          <Button label={t('photo.camera')} icon="camera-outline" onPress={() => void add(true)} />
          <Button label={t('photo.gallery')} variant="soft" icon="images-outline" onPress={() => void add(false)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={openIndex !== null} onClose={() => setOpenIndex(null)} title={t('photo.title')}>
        <View style={{ gap: 10 }}>
          {openIndex !== null && openIndex > 0 ? (
            <Button
              label={t('photo.makeCover')}
              variant="soft"
              icon="star-outline"
              onPress={() => {
                const next = [...photos];
                const [p] = next.splice(openIndex, 1);
                onChange([p, ...next]);
                setOpenIndex(null);
              }}
            />
          ) : null}
          <Button
            label={t('photo.remove')}
            variant="ghost"
            icon="trash-outline"
            onPress={() => {
              if (openIndex !== null) onChange(photos.filter((_, i) => i !== openIndex));
              setOpenIndex(null);
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 2 },
  tile: { width: 92, height: 92, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.primaryWash },
  add: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  addText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.primary, textAlign: 'center', paddingHorizontal: 4 },
  cover: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(15,23,42,0.78)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  coverText: { fontFamily: typography.fontFamilySemiBold, fontSize: 10.5, color: '#fff' },
});
