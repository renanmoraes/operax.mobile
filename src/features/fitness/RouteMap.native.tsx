import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@/src/design-system/tokens';
import { RouteSketch, type RouteMapProps } from './RouteSketch';

export type { RouteMapProps } from './RouteSketch';

type MapsModule = typeof import('react-native-maps');

/**
 * Mapa de verdade só onde ele carrega: no iPhone (Apple Maps) sempre; no Android, com a chave do Google Maps
 * configurada no app. Sem isso o caminho vai desenhado.
 */
function loadMaps(): MapsModule | null {
  // Android: só com a chave do app (GOOGLE_MAPS_ANDROID_API_KEY no build; ver app.config.js). Sem ela o Google entrega um quadro bege vazio,
  // inclusive em Expo Go montado fora da Expo. O desenho do caminho é melhor que um mapa em branco.
  const ok = Platform.OS === 'ios' || Constants.expoConfig?.extra?.androidMaps === true;
  if (!ok) return null;
  try {
    // Carregado só aqui: se o módulo nativo faltar, o caminho vai desenhado em vez de o app quebrar.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-maps') as MapsModule;
  } catch {
    return null;
  }
}
export const Maps = loadMaps();

export function RouteMap(props: RouteMapProps) {
  if (!Maps) return <RouteSketch {...props} />;
  return <NativeRouteMap {...props} maps={Maps} />;
}

function NativeRouteMap({ route, here, follow, style, inset, maps }: RouteMapProps & { maps: MapsModule }) {
  const { default: MapView, Polyline, Marker } = maps;
  const ref = useRef<InstanceType<typeof MapView>>(null);
  const coords = useMemo(() => route.map(([latitude, longitude]) => ({ latitude, longitude })), [route]);
  const start = coords[0];
  const end = coords.length > 1 ? coords[coords.length - 1] : null;

  // Gravando, a câmera acompanha a pessoa; no resumo, enquadra o percurso inteiro.
  useEffect(() => {
    if (follow && here) ref.current?.animateCamera({ center: { latitude: here.lat, longitude: here.lng }, zoom: 16 }, { duration: 600 });
  }, [follow, here]);

  const initial = here
    ? { latitude: here.lat, longitude: here.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }
    : start
      ? { latitude: start.latitude, longitude: start.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : { latitude: -15.79, longitude: -47.88, latitudeDelta: 30, longitudeDelta: 30 };

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initial}
        mapPadding={{ top: inset?.top ?? 0, bottom: inset?.bottom ?? 0, left: 0, right: 0 }}
        showsUserLocation={!!follow}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={!!follow}
        onMapReady={() => {
          if (!follow && coords.length > 1) ref.current?.fitToCoordinates(coords, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false });
        }}
      >
        {coords.length > 1 ? <Polyline coordinates={coords} strokeColor="#ffffff" strokeWidth={9} lineCap="round" lineJoin="round" /> : null}
        {coords.length > 1 ? <Polyline coordinates={coords} strokeColor={colors.primary} strokeWidth={5} lineCap="round" lineJoin="round" /> : null}
        {start ? (
          <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.dot, { borderColor: colors.success, backgroundColor: '#fff' }]} />
          </Marker>
        ) : null}
        {end && !follow ? (
          <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.dot, { borderColor: '#fff', backgroundColor: colors.chromeNavy }]} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#eef3fb', overflow: 'hidden' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
});
