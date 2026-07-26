import { useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, ListRow, Muted } from '@/src/design-system/ui';
import { colors, radii, spacing, typography, zIndex } from '@/src/design-system/tokens';
import type { Conversation } from '@/src/mocks/data';
import { useQueueDrawer } from './QueueDrawerContext';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 360);

const channelLabel = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
} as const;

type Props = {
  items: Conversation[];
  claimingId?: string | null;
  onClaim: (id: string) => void;
};

export function QueueDrawer({ items, claimingId, onClaim }: Props) {
  const { visible, close } = useQueueDrawer();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * -DRAWER_WIDTH }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable
          style={styles.overlay}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Fechar fila"
        />
        <Animated.View
          style={[
            styles.panel,
            panelStyle,
            { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Fila</Text>
              <Muted>
                {items.length === 0
                  ? 'Ninguém aguardando'
                  : `${items.length} aguardando · Assuma para atender`}
              </Muted>
            </View>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Fechar fila"
              hitSlop={10}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Muted style={{ textAlign: 'center' }}>Ninguém na fila agora</Muted>
                <Button label="Fechar" variant="secondary" onPress={close} />
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.item}>
                <ListRow
                  title={item.contactName}
                  subtitle={item.lastMessage}
                  meta={`${item.queue} · ${channelLabel[item.channel] ?? item.channel}`}
                  trailing={<Muted>{item.updatedAt}</Muted>}
                  onPress={() => onClaim(item.id)}
                />
                <View style={styles.claimWrap}>
                  <Button
                    label={claimingId === item.id ? 'Assumindo…' : 'Assumir'}
                    disabled={claimingId === item.id}
                    onPress={() => onClaim(item.id)}
                  />
                </View>
              </View>
            )}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    zIndex: zIndex.drawer,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  panel: {
    width: DRAWER_WIDTH,
    maxWidth: '86%',
    height: '100%',
    backgroundColor: colors.cardBg,
    borderTopRightRadius: radii.sheet,
    borderBottomRightRadius: radii.sheet,
    zIndex: zIndex.drawer + 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  claimWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.cardBg,
  },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
  },
});
