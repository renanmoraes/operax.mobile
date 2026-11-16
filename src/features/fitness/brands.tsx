import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import type { BrandId } from './integrations';
import type { ImportedSessionView } from './types';

type SourceView = ImportedSessionView['sources'][number];

/**
 * Marcas dos relógios e apps, com os arquivos oficiais que o Operax já tem
 * (bancada/strava-marca e o pacote de marca da Garmin). Regras que valem aqui:
 *
 * - Garmin: na conexão, nome completo "Garmin Connect™" com o ícone oficial, sem alterar.
 *   Onde aparece dado do Garmin, atribuição "Garmin [modelo]" junto do título; sem modelo, só "Garmin".
 *   A etiqueta Garmin não vai em avatar, selo ou onde não há dado do Garmin.
 * - Strava: conecta com o botão padrão do app, como os outros (decisão do dono em 15/11/2026); dado vindo do Strava leva
 *   "Powered by Strava". Não sugerir que o app é feito ou patrocinado pelo Strava.
 * - Zepp: o pacote oficial só traz o selo "Works with Zepp | Zepp OS", que afirma compatibilidade.
 *   Ele aparece apenas quando a conexão com a Zepp estiver disponível; até lá, a inicial.
 *   Altura mínima digital de 66 px e área de respiro em volta (guia da Zepp, v1.0 de 13/07/2022).
 * - Polar, Coros e Amazfit: o nome da marca escrito na cor dela, sem imitar o logotipo, até chegarem
 *   os pacotes oficiais (aí troca pelo PNG, como a Garmin).
 * - Apple: a Apple não permite o logotipo da maçã em app de terceiros. Apple Watch vai com o desenho
 *   de relógio e o Saúde com um coração genérico.
 * - Samsung (Galaxy Watch): logotipo do Simple Icons (CC0), branco no azul da Samsung.
 * - Health Connect: ícone genérico até o pacote oficial do Google.
 */

const GARMIN_TILE = require('@/assets/brand/watches/garmin-connect-tile.png');
const GARMIN_TAG = require('@/assets/brand/watches/garmin-tag-black.png');
const STRAVA_POWERED = require('@/assets/brand/watches/strava-powered-orange.png');
const ZEPP_WORKS_WITH = require('@/assets/brand/watches/zepp-works-with-horizontal.png');

export const STRAVA_ORANGE = '#FC4C02';

/** Nome como cada marca pede para ser exibido na conexão. */
export function providerDisplayName(id: BrandId, label: string) {
  return id === 'garmin' ? 'Garmin Connect™' : label;
}

const SAMSUNG_PATH =
  'M19.8166 10.2808l.0459 2.6934h-.023l-.7793-2.6934h-1.2837v3.3925h.8481l-.0458-2.785h.023l.8366 2.785h1.2264v-3.3925zm-16.149 0l-.6418 3.427h.9284l.4699-3.1175h.0229l.4585 3.1174h.9169l-.6304-3.4269zm5.1805 0l-.424 2.6132h-.023l-.424-2.6132H6.5788l-.0688 3.427h.8596l.023-3.0832h.0114l.573 3.0831h.8711l.5731-3.083h.023l.0228 3.083h.8596l-.0802-3.4269zm-7.2664 2.4527c.0343.0802.0229.1949.0114.2522-.0229.1146-.1031.2292-.3324.2292-.2177 0-.3438-.126-.3438-.3095v-.3323H0v.2636c0 .7679.6074.9971 1.2493.9971.6189 0 1.1346-.2178 1.2149-.7794.0458-.298.0114-.4928 0-.5616-.1605-.722-1.467-.9283-1.5588-1.3295-.0114-.0688-.0114-.1375 0-.1834.023-.1146.1032-.2292.3095-.2292.2063 0 .321.126.321.3095v.2063h.8595v-.2407c0-.745-.6762-.8596-1.1576-.8596-.6074 0-1.1117.2063-1.2034.7564-.023.149-.0344.2866.0114.4585.1376.7106 1.364.9169 1.5358 1.3524m11.152 0c.0343.0803.0228.1834.0114.2522-.023.1146-.1032.2292-.3324.2292-.2178 0-.3438-.126-.3438-.3095v-.3323h-.917v.2636c0 .7564.596.9857 1.2379.9857.6189 0 1.1232-.2063 1.2034-.7794.0459-.298.0115-.4814 0-.5616-.1375-.7106-1.4327-.9284-1.5243-1.318-.0115-.0688-.0115-.1376 0-.1835.0229-.1146.1031-.2292.3094-.2292.1948 0 .321.126.321.3095v.2063h.848v-.2407c0-.745-.6647-.8596-1.146-.8596-.6075 0-1.1004.1948-1.192.7564-.023.149-.023.2866.0114.4585.1376.7106 1.341.9054 1.513 1.3524m2.8882.4585c.2407 0 .3094-.1605.3323-.2522.0115-.0343.0115-.0917.0115-.126v-2.533h.871v2.4642c0 .0688 0 .1948-.0114.2292-.0573.6419-.5616.8482-1.192.8482-.6303 0-1.1346-.2063-1.192-.8482 0-.0344-.0114-.1604-.0114-.2292v-2.4642h.871v2.533c0 .0458 0 .0916.0115.126 0 .0917.0688.2522.3095.2522m7.1518-.0344c.2522 0 .3324-.1605.3553-.2522.0115-.0343.0115-.0917.0115-.126v-.4929h-.3553v-.5043H24v.917c0 .0687 0 .1145-.0115.2292-.0573.6303-.596.8481-1.2034.8481-.6075 0-1.1461-.2178-1.2034-.8481-.0115-.1147-.0115-.1605-.0115-.2293v-1.444c0-.0574.0115-.172.0115-.2293.0802-.6419.596-.8482 1.2034-.8482s1.1347.2063 1.2034.8482c.0115.1031.0115.2292.0115.2292v.1146h-.8596v-.1948s0-.0803-.0115-.1261c-.0114-.0802-.0802-.2521-.3438-.2521-.2521 0-.321.1604-.3438.2521-.0115.0458-.0115.1032-.0115.1605v1.5702c0 .0458 0 .0916.0115.126 0 .0917.0917.2522.3323.2522';

/** Nome da marca escrito na cor dela (Polar, Coros, Amazfit), até o pacote oficial chegar. */
const WORD_TILES: Partial<Record<BrandId, { bg: string; fg: string; word: string; scale: number; spacing: number }>> = {
  polar: { bg: '#D1001C', fg: '#fff', word: 'polar', scale: 0.3, spacing: -0.4 },
  coros: { bg: '#0b0b0b', fg: '#fff', word: 'COROS', scale: 0.2, spacing: 1.2 },
  zepp: { bg: '#111418', fg: '#fff', word: 'amazfit', scale: 0.2, spacing: -0.2 },
};

/** Ícones do sistema para quem não permite logotipo (Apple) ou ainda não mandou o pacote. */
const ICON_TILES: Partial<Record<BrandId, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; border?: boolean }>> = {
  apple: { bg: '#0b0b0b', fg: '#fff', icon: 'watch-outline' },
  applehealth: { bg: '#fff', fg: '#FF2D55', icon: 'heart', border: true },
  healthconnect: { bg: '#fff', fg: '#1A73E8', icon: 'pulse', border: true },
};

/** Ícone do app de cada marca. */
export function ProviderMark({ id, label, size = 44, muted, ring }: { id: BrandId; label: string; size?: number; muted?: boolean; ring?: boolean }) {
  const radius = Math.round(size * 0.26);
  const frame = [{ width: size, height: size, borderRadius: radius }, ring && styles.ring, muted && { opacity: 0.55 }];
  if (id === 'garmin') {
    return <Image source={GARMIN_TILE} style={[frame, { overflow: 'hidden' }]} accessibilityIgnoresInvertColors accessible={false} />;
  }
  const word = WORD_TILES[id];
  if (word) {
    return (
      <View style={[styles.mark, frame, { backgroundColor: word.bg }]} accessible={false}>
        <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: Math.round(size * word.scale), letterSpacing: word.spacing, color: word.fg }} numberOfLines={1}>
          {word.word}
        </Text>
      </View>
    );
  }
  const ic = ICON_TILES[id];
  if (ic) {
    return (
      <View style={[styles.mark, frame, { backgroundColor: ic.bg }, ic.border && styles.tileBorder]} accessible={false}>
        <Ionicons name={ic.icon} size={Math.round(size * 0.52)} color={ic.fg} />
      </View>
    );
  }
  if (id === 'galaxy') {
    const w = size * 0.8;
    return (
      <View style={[styles.mark, frame, { backgroundColor: '#1428A0' }]} accessible={false}>
        <Svg viewBox="0 9.9 24 4.2" width={w} height={(w * 4.2) / 24}>
          <Path fill="#fff" d={SAMSUNG_PATH} />
        </Svg>
      </View>
    );
  }
  if (id === 'strava') {
    return (
      <View style={[styles.mark, frame, { backgroundColor: STRAVA_ORANGE }]} accessible={false}>
        <Svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56}>
          <Path fill="#fff" d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </Svg>
      </View>
    );
  }
  return (
    <View style={[styles.mark, frame, { backgroundColor: muted ? '#f0f2f5' : colors.primaryWash }]} accessible={false}>
      <Text style={[text.title, { fontSize: Math.round(size * 0.4), color: muted ? colors.textMuted : colors.primaryDeep }]}>{label.slice(0, 1)}</Text>
    </View>
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

/** Selo oficial "Works with Zepp | Zepp OS" (só com a integração Zepp disponível). */
export function WorksWithZepp({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingVertical: 8, alignSelf: 'flex-start' }, style]} accessible accessibilityLabel="Works with Zepp">
      <Image source={ZEPP_WORKS_WITH} style={{ width: 128, height: 66 }} resizeMode="contain" />
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
  mark: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, overflow: 'hidden' },
  ring: { borderWidth: 2, borderColor: '#fff' },
  tileBorder: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  attr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attrText: { ...text.captionStrong, color: colors.textSoft },
});
