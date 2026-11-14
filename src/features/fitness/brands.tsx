import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radii, text } from '@/src/design-system/tokens';
import type { ImportedSessionView, ProviderView } from './types';

type SourceView = ImportedSessionView['sources'][number];

/**
 * Marcas dos relógios e apps, com os arquivos oficiais que o Operax já tem
 * (bancada/strava-marca e o pacote de marca da Garmin). Regras que valem aqui:
 *
 * - Garmin: na conexão, nome completo "Garmin Connect™" com o ícone oficial, sem alterar.
 *   Onde aparece dado do Garmin, atribuição "Garmin [modelo]" junto do título; sem modelo, só "Garmin".
 *   A etiqueta Garmin não vai em avatar, selo ou onde não há dado do Garmin.
 * - Strava: conectar só pelo botão oficial "Connect with Strava"; dado vindo do Strava leva
 *   "Powered by Strava". Não sugerir que o app é feito ou patrocinado pelo Strava.
 * - Polar, Coros, Zepp e Apple: só a inicial até chegarem os pacotes oficiais.
 */

const GARMIN_TILE = require('@/assets/brand/watches/garmin-connect-tile.png');
const GARMIN_TAG = require('@/assets/brand/watches/garmin-tag-black.png');
const STRAVA_CONNECT = require('@/assets/brand/watches/strava-connect-orange.png');
const STRAVA_POWERED = require('@/assets/brand/watches/strava-powered-orange.png');

export const STRAVA_ORANGE = '#FC4C02';

type ProviderId = ProviderView['id'];

/** Nome como cada marca pede para ser exibido na conexão. */
export function providerDisplayName(id: ProviderId, label: string) {
  return id === 'garmin' ? 'Garmin Connect™' : label;
}

/** Ícone do app de cada marca. */
export function ProviderMark({ id, label, size = 44, muted }: { id: ProviderId; label: string; size?: number; muted?: boolean }) {
  if (id === 'garmin') {
    return <Image source={GARMIN_TILE} style={{ width: size, height: size }} accessibilityIgnoresInvertColors accessible={false} />;
  }
  const radius = Math.round(size * 0.26);
  if (id === 'strava') {
    return (
      <View style={[styles.mark, { width: size, height: size, borderRadius: radius, backgroundColor: STRAVA_ORANGE }]} accessible={false}>
        <Svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56}>
          <Path fill="#fff" d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </Svg>
      </View>
    );
  }
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: radius, backgroundColor: muted ? '#f0f2f5' : colors.primaryWash }]} accessible={false}>
      <Text style={[text.title, { fontSize: Math.round(size * 0.4), color: muted ? colors.textMuted : colors.primaryDeep }]}>{label.slice(0, 1)}</Text>
    </View>
  );
}

/** Botão oficial do Strava (237×48). Não muda cor, texto nem proporção. */
export function StravaConnectButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Connect with Strava"
      style={({ pressed }) => [{ alignSelf: 'flex-start', opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <Image source={STRAVA_CONNECT} style={{ width: 237, height: 48 }} resizeMode="contain" />
    </Pressable>
  );
}

/** Selo "Powered by Strava", obrigatório junto de dado que veio do Strava. */
export function PoweredByStrava({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} accessible accessibilityLabel="Powered by Strava">
      <Image source={STRAVA_POWERED} style={{ width: 128, height: 13 }} resizeMode="contain" />
    </View>
  );
}

/** Atribuição Garmin: etiqueta oficial + modelo do aparelho. */
export function GarminAttribution({ device, style }: { device?: string | null; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.attr, style]} accessible accessibilityLabel={`Garmin${device ? ` ${device}` : ''}`}>
      <Image source={GARMIN_TAG} style={{ width: 41, height: 14 }} resizeMode="contain" />
      {device ? <Text style={styles.attrText}>{device}</Text> : null}
    </View>
  );
}

/** Mostra a atribuição exigida pela marca de onde o dado veio. */
export function DataSourceAttribution({ provider, sources, style }: { provider: string; sources?: SourceView[]; style?: StyleProp<ViewStyle> }) {
  if (provider === 'garmin') {
    const device = sources?.find((s) => s.provider === 'garmin')?.device;
    return <GarminAttribution device={device} style={style} />;
  }
  if (provider === 'strava') return <PoweredByStrava style={style} />;
  return null;
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  attr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attrText: { ...text.captionStrong, color: colors.textSoft },
});
