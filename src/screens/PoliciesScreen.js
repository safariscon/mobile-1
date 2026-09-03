import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  buildAcceptBar,
  buildPolicyContent,
  POLICY_TAB_KEYS,
  SUPPORT_CONTACT,
} from '../lib/policyContent';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function PoliciesScreen({ initialTab = 'how-it-works', requireAccept = false, onClose }) {
  const { t } = useTranslation();
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { acceptTerms, loading, logout, user } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState('');
  const policyContent = useMemo(() => buildPolicyContent(t), [t]);
  const acceptBar = useMemo(() => buildAcceptBar(t), [t]);
  const page = policyContent[tab] || policyContent['how-it-works'];
  const showAcceptBar = requireAccept && tab === 'terms';

  useEffect(() => {
    setTab(policyContent[initialTab] ? initialTab : 'how-it-works');
  }, [initialTab, policyContent]);

  const submit = async () => {
    setError('');
    const result = await acceptTerms();
    if (!result.success) setError(result.error || 'Could not accept terms.');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t('policy.welcomeEyebrow')}</Text>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {page.title}
          </Text>
          <Text style={styles.headerSubtitle}>{t('policy.readBeforeContinue')}</Text>
        </View>
        {onClose ? (
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.84}>
            <Feather name="x" size={18} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabGrid}>
        {POLICY_TAB_KEYS.map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tabCard, active && styles.tabCardActive]}
              onPress={() => setTab(item.key)}
              activeOpacity={0.86}
            >
              <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                <Feather name={item.icon} size={15} color={active ? colors.white : colors.primary} />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {t(item.shortKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, showAcceptBar && styles.contentWithAccept]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHero}>
          <Text style={styles.pageHeroTitle}>{page.title}</Text>
          <Text style={styles.lead}>{page.lead}</Text>
        </View>

        {page.steps?.map((step, index) => (
          <View key={`${step.title}-${index}`} style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.sectionTitle}>{step.title}</Text>
              <Text style={styles.body}>{step.body}</Text>
            </View>
          </View>
        ))}

        {page.table ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{page.table.title}</Text>
            {page.table.rows.map(([data, why]) => (
              <View key={data} style={styles.tableRow}>
                <Text style={styles.tableKey}>{data}</Text>
                <Text style={styles.body}>{why}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {page.highlight ? (
          <View style={styles.highlight}>
            <Feather name="alert-circle" size={16} color={colors.warning} />
            <Text style={styles.highlightText}>{page.highlight}</Text>
          </View>
        ) : null}

        {page.sections?.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, index) => (
              <View key={`${section.title}-${index}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.body}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {page.footer ? <Text style={styles.footerNote}>{page.footer}</Text> : null}

        <TouchableOpacity
          style={styles.support}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_CONTACT.email}`).catch(() => {})}
          activeOpacity={0.84}
        >
          <Feather name="mail" size={14} color={colors.primary} />
          <Text style={styles.supportText}>
            {SUPPORT_CONTACT.email} · {SUPPORT_CONTACT.phone}
          </Text>
        </TouchableOpacity>

        {user?.role === 'admin' && requireAccept ? (
          <Text style={styles.footerNote}>{t('policy.adminSkipNote')}</Text>
        ) : null}
      </ScrollView>

      {showAcceptBar ? (
        <View style={styles.acceptBar}>
          <Text style={styles.acceptTitle}>{acceptBar.title}</Text>
          <Text style={styles.acceptBody}>{acceptBar.body}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.acceptButton, loading && styles.disabled]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.86}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.acceptButtonText}>{acceptBar.accept}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineButton} onPress={logout} activeOpacity={0.84}>
            <Text style={styles.declineText}>{acceptBar.decline}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  screen: {
    backgroundColor: themeColors.background,
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  eyebrow: {
    color: themeColors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: themeColors.textStrong,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    marginTop: 6,
  },
  headerSubtitle: {
    color: themeColors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    marginTop: 2,
    width: 36,
  },
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  tabCard: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    width: '47.5%',
  },
  tabCardActive: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  tabIconWrap: {
    alignItems: 'center',
    backgroundColor: themeColors.primaryLight,
    borderRadius: 10,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabLabel: {
    color: themeColors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  tabLabelActive: {
    color: themeColors.white,
  },
  content: {
    paddingBottom: 28,
    paddingHorizontal: 18,
  },
  contentWithAccept: {
    paddingBottom: 12,
  },
  pageHero: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  pageHeroTitle: {
    color: themeColors.textStrong,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
    marginBottom: 8,
  },
  lead: {
    color: themeColors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  stepCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 12,
    height: 26,
    justifyContent: 'center',
    marginTop: 1,
    width: 26,
  },
  stepNumberText: {
    color: themeColors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 4,
    padding: 14,
  },
  sectionTitle: {
    color: themeColors.textStrong,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
    marginBottom: 10,
  },
  body: {
    color: themeColors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  bullet: {
    backgroundColor: themeColors.primary,
    borderRadius: 4,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  tableRow: {
    backgroundColor: themeColors.surfaceMuted,
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  tableKey: {
    color: themeColors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  highlight: {
    alignItems: 'flex-start',
    backgroundColor: themeColors.warningSurface,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    marginTop: 4,
    padding: 14,
  },
  highlightText: {
    color: themeColors.warning,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  footerNote: {
    color: themeColors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
  },
  acceptBar: {
    backgroundColor: themeColors.surfaceRaised,
    borderTopColor: themeColors.border,
    borderTopWidth: 1,
    paddingBottom: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  acceptTitle: {
    color: themeColors.textStrong,
    fontSize: 17,
    fontWeight: '900',
  },
  acceptBody: {
    color: themeColors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 6,
  },
  error: {
    color: themeColors.danger,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    marginTop: 14,
  },
  disabled: {
    opacity: 0.72,
  },
  acceptButtonText: {
    color: themeColors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  declineButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  declineText: {
    color: themeColors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  support: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
  },
  supportText: {
    color: themeColors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
