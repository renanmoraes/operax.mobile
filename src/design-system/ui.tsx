import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from './tokens';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        (pressed || disabled) && { opacity: 0.72 },
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          (variant === 'secondary' || variant === 'ghost') && { color: colors.text },
          variant === 'danger' && { color: '#fff' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 88, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'warn' | 'danger' | 'success';
}) {
  const bg =
    tone === 'primary'
      ? colors.primarySoft
      : tone === 'warn'
        ? '#fff7ed'
        : tone === 'danger'
          ? '#fef2f2'
          : tone === 'success'
            ? '#f0fdf4'
            : colors.pageBg;
  const fg =
    tone === 'primary'
      ? colors.primary
      : tone === 'warn'
        ? colors.warn
        : tone === 'danger'
          ? colors.danger
          : tone === 'success'
            ? colors.success
            : colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Muted style={{ textAlign: 'center' }}>{subtitle}</Muted> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ScreenHeader({
  title,
  onMenuPress,
  menuBadge = 0,
  right,
}: {
  title: string;
  onMenuPress?: () => void;
  menuBadge?: number;
  right?: ReactNode;
}) {
  const badgeLabel = menuBadge > 9 ? '9+' : String(menuBadge);
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onMenuPress ? (
          <Pressable
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel={
              menuBadge > 0 ? `Abrir fila, ${menuBadge} na fila` : 'Abrir fila'
            }
            hitSlop={8}
            style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="menu" size={26} color={colors.text} />
            {menuBadge > 0 ? (
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <View style={styles.menuSpacer} />
        )}
        <Title style={styles.headerTitle}>{title}</Title>
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  urgencyLabel,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  urgencyLabel?: string;
  rightAction?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, pressed && onPress && { backgroundColor: colors.rowPress }]}
    >
      <View style={styles.listRowMain}>
        <View style={styles.listRowTop}>
          <Body style={styles.listRowTitle} numberOfLines={1}>
            {title}
          </Body>
          {trailing}
        </View>
        {subtitle ? (
          <Muted numberOfLines={1} style={styles.listRowSub}>
            {subtitle}
          </Muted>
        ) : null}
        {(meta || urgencyLabel) && (
          <View style={styles.listRowMeta}>
            {meta ? <Muted numberOfLines={1}>{meta}</Muted> : null}
            {urgencyLabel ? <OwnershipHint label={urgencyLabel} /> : null}
          </View>
        )}
      </View>
      {rightAction}
    </Pressable>
  );
}

export function OwnershipHint({ label }: { label: string }) {
  return <Text style={styles.ownership}>{label}</Text>;
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.title,
    color: colors.text,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    color: colors.text,
  },
  muted: {
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  label: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  btn: {
    minHeight: 48,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.body,
    color: '#fff',
  },
  input: {
    height: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerRight: { marginLeft: spacing.sm },
  headerTitle: { fontSize: 20, flexShrink: 1 },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSpacer: { width: 8 },
  menuBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: typography.fontFamilySemiBold,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 72,
  },
  listRowMain: { flex: 1, gap: 3 },
  listRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  listRowTitle: { fontFamily: typography.fontFamilySemiBold, flex: 1 },
  listRowSub: { marginTop: 1 },
  listRowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ownership: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11,
    color: colors.warn,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.pageBg,
    borderRadius: radii.control,
    padding: 3,
  },
  segment: {
    flex: 1,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.chromeNavy },
  segmentText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  segmentTextActive: { color: '#fff' },
});
