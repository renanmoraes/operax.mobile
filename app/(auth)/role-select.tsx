import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Display, Glow, IconTile, Muted, PressableScale, Rise, Screen } from '@/src/design-system/ui';
import { colors, radii, shadows, spacing, text } from '@/src/design-system/tokens';
import { useAuth } from '@/src/features/auth/AuthContext';

function RoleCard({
  title,
  subtitle,
  icon,
  primary,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: 'person' | 'headset';
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.card, primary ? styles.cardPrimary : styles.cardGlass]}
    >
      <IconTile icon={icon} size={52} tone={primary ? 'primary' : 'soft'} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Muted style={{ marginTop: 3, lineHeight: 18 }}>{subtitle}</Muted>
      </View>
      <View style={[styles.arrow, { backgroundColor: primary ? colors.primaryWash : '#fff' }]}>
        <Ionicons name="arrow-forward" size={18} color={colors.primary} />
      </View>
    </PressableScale>
  );
}

export default function RoleSelectScreen() {
  const { t } = useTranslation('auth');
  const insets = useSafeAreaInsets();
  const { selectRole } = useAuth();

  return (
    <Screen backdrop="mirror">
      <Glow size={360} style={{ right: -170, top: 110 }} />
      <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <Rise>
          <Image
            source={require('../../assets/brand/operax-logo-dark.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Operax"
          />
        </Rise>

        <View style={{ marginTop: 'auto' }}>
          <Rise index={1}>
            <Display style={styles.headline}>{t('roleSelect.headline')}</Display>
          </Rise>
          <Rise index={2}>
            <Muted style={styles.sub}>{t('roleSelect.how')}</Muted>
          </Rise>
          <View style={{ marginTop: 28, gap: 12 }}>
            <Rise index={3}>
              <RoleCard
                primary
                icon="person"
                title={t('roleSelect.clientTitle')}
                subtitle={t('roleSelect.clientSubtitle')}
                onPress={async () => {
                  await selectRole('client');
                  router.replace('/(auth)/client-login');
                }}
              />
            </Rise>
            <Rise index={4}>
              <RoleCard
                icon="headset"
                title={t('roleSelect.teamTitle')}
                subtitle={t('roleSelect.teamSubtitle')}
                onPress={async () => {
                  await selectRole('staff');
                  router.replace('/(auth)/login');
                }}
              />
            </Rise>
          </View>
          <Rise index={5}>
            <Muted style={styles.legal}>{t('roleSelect.legal')}</Muted>
          </Rise>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl },
  logo: { width: 134, height: 26 },
  headline: { fontSize: 30, lineHeight: 35, letterSpacing: -1 },
  sub: { marginTop: 14, fontSize: 15 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: radii.xl + 2,
  },
  cardPrimary: { backgroundColor: '#fff', ...shadows.hero },
  cardGlass: { backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  cardTitle: { ...text.section, color: colors.text },
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  legal: { marginTop: 22, textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
