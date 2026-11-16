import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Muted } from '@/src/design-system/ui';
import { initialsOf } from '@/src/features/inbox/ConversationCard';
import { colors, radii, shadows, spacing, text, typography, zIndex } from '@/src/design-system/tokens';
import type { Conversation } from '@/src/mocks/data';
import { useQueueDrawer } from './QueueDrawerContext';
import { useCan } from '@/src/features/auth/useCan';
import { channelName } from '@/src/features/attendance/channels';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 360);

type Props = {
  items: Conversation[];
  claimingId?: string | null;
  onClaim: (id: string) => void;
};

export function QueueDrawer({ items, claimingId, onClaim }: Props) {
  const { t } = useTranslation(['inbox', 'common']);
  const canClaim = useCan()('claim');
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
          accessibilityLabel={t('queue.close')}
        />
        <Animated.View
          style={[
            styles.panel,
            panelStyle,
            { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('queue.title')}</Text>
              <Muted style={{ marginTop: 2 }}>
                {items.length === 0
                  ? t('queue.none')
                  : t('queue.waiting', { count: items.length })}
              </Muted>
            </View>
            <IconButton icon="close" accessibilityLabel={t('queue.close')} onPress={close} />
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <EmptyState icon="checkmark-done-outline" title={t('queue.emptyTitle')} subtitle={t('queue.emptySub')} />
                <Button label={t('common:actions.close')} variant="soft" onPress={close} />
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.item}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar initials={initialsOf(item.contactName)} size={42} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.name} numberOfLines={1}>{item.contactName}</Text>
                      <Muted style={{ fontSize: 12 }}>{item.updatedAt}</Muted>
                    </View>
                    <Muted numberOfLines={1} style={{ marginTop: 2 }}>{item.lastMessage}</Muted>
                  </View>
                </View>
                <View style={styles.itemFoot}>
                  <Badge label={`${item.queue} · ${channelName(item.channel)}`} />
                  {canClaim ? (
                    <Button
                      label={t('queue.claim')}
                      compact
                      loading={claimingId === item.id}
                      disabled={claimingId === item.id}
                      onPress={() => onClaim(item.id)}
                    />
                  ) : null}
                </View>
              </Card>
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
    backgroundColor: colors.pageBg,
    borderTopRightRadius: radii.sheet,
    borderBottomRightRadius: radii.sheet,
    zIndex: zIndex.drawer + 1,
    ...shadows.hero,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  title: { ...text.display, color: colors.text },
  list: { paddingHorizontal: 16, gap: 10, paddingBottom: spacing.md },
  item: { padding: 14, gap: 12 },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
  },
});
