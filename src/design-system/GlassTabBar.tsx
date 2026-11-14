import { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows, typography } from './tokens';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const GLASS_TAB_BAR_SPACE = 112;

/** Navegação inferior em pílula de vidro flutuante; o item ativo vira uma pílula azul com rótulo. */
export function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const visible = state.routes.filter((route) => {
    const style = descriptors[route.key].options.tabBarItemStyle as { display?: string } | undefined;
    return style?.display !== 'none';
  });

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View style={styles.bar}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.webGlass]} />
        ) : (
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        {visible.map((route) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index]?.key === route.key;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const badge = options.tabBarBadge;
          const color = focused ? '#fff' : colors.textMuted;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label}, ${badge} novas` : label}
              style={{ flexShrink: 0 }}
            >
              <View style={[styles.item, focused && styles.itemActive]}>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                {focused ? (
                  <Text style={styles.label} numberOfLines={1}>
                    {label}
                  </Text>
                ) : null}
                {badge != null && !focused ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  bar: {
    height: 68,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.nav,
  },
  webGlass: {
    backdropFilter: 'blur(18px)',
  },
  tint: { backgroundColor: colors.glass },
  item: {
    height: 52,
    minWidth: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  itemActive: {
    backgroundColor: colors.primary,
    paddingLeft: 15,
    paddingRight: 18,
    ...shadows.button,
  },
  label: {
    color: '#fff',
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13.5,
  },
  dot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
