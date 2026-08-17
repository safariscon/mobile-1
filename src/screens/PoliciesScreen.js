import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '../context/AuthContext';
import { ACCEPT_BAR, POLICY_CONTENT, POLICY_TABS, SUPPORT_CONTACT } from '../lib/policyContent';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function PoliciesScreen({ initialTab = 'how-it-works', requireAccept = false, onClose }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { acceptTerms, loading, logout, user } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState('');
  const page = POLICY_CONTENT[tab] || POLICY_CONTENT['how-it-works'];
  const showAcceptBar = requireAccept && tab === 'terms';

  useEffect(() => {
    setTab(POLICY_CONTENT[initialTab] ? initialTab : 'how-it-works');
  }, [initialTab]);

  const submit = async () => {
    setError('');
    const result = await acceptTerms();
    if (!result.success) setError(result.error || 'Could not accept terms.');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>SafarisCon policies</Text>
          <Text style={styles.headerTitle}>{page.title}</Text>
        </View>
        {onClose ? (
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.84}>
            <Feather name="x" size={18} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {POLICY_TABS.map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity key={item.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(item.key)} activeOpacity={0.84}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{page.lead}</Text>

        {page.steps?.map((step, index) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{step.title}</Text>
              <Text style={styles.body}>{step.body}</Text>
            </View>
          </View>
        ))}

        {page.table ? (
          <View style={styles.section}>
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
            <Text style={styles.highlightText}>{page.highlight}</Text>
          </View>
        ) : null}

        {page.sections?.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.body}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {page.footer ? <Text style={styles.footerNote}>{page.footer}</Text> : null}

        {showAcceptBar ? (
          <View style={styles.acceptBar}>
            <Text style={styles.acceptTitle}>{ACCEPT_BAR.title}</Text>
            <Text style={styles.acceptBody}>{ACCEPT_BAR.body}</Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={[styles.acceptButton, loading && styles.disabled]} onPress={submit} disabled={loading} activeOpacity={0.86}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.acceptButtonText}>{ACCEPT_BAR.accept}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineButton} onPress={logout} activeOpacity={0.84}>
              <Text style={styles.declineText}>{ACCEPT_BAR.decline}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={styles.support} onPress={() => Linking.openURL(`mailto:${SUPPORT_CONTACT.email}`).catch(() => {})} activeOpacity={0.84}>
          <Text style={styles.supportText}>{SUPPORT_CONTACT.email} · {SUPPORT_CONTACT.phone}</Text>
        </TouchableOpacity>
        {user?.role === 'admin' && requireAccept ? <Text style={styles.footerNote}>Admins skip this acceptance gate.</Text> : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  screen: { backgroundColor: themeColors.background, flex: 1 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  eyebrow: { color: themeColors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  headerTitle: { color: themeColors.textStrong, fontSize: 22, fontWeight: '900', marginTop: 4 },
  closeButton: { alignItems: 'center', backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 8, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  tabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  tab: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  tabActive: { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
  tabText: { color: themeColors.text, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: themeColors.white },
  content: { paddingBottom: 36, paddingHorizontal: 16 },
  lead: { color: themeColors.text, fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: 16 },
  stepCard: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 10, padding: 12 },
  stepNumber: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 12, height: 24, justifyContent: 'center', marginTop: 2, width: 24 },
  stepNumberText: { color: themeColors.white, fontSize: 12, fontWeight: '900' },
  section: { marginTop: 16 },
  sectionTitle: { color: themeColors.textStrong, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  body: { color: themeColors.text, flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 8 },
  bullet: { backgroundColor: themeColors.primary, borderRadius: 3, height: 6, marginTop: 7, width: 6 },
  tableRow: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 12, borderWidth: 1, marginBottom: 8, padding: 12 },
  tableKey: { color: themeColors.primaryDark, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  highlight: { backgroundColor: themeColors.warningSurface, borderRadius: 14, marginTop: 8, padding: 14 },
  highlightText: { color: themeColors.warning, fontSize: 13, fontWeight: '800', lineHeight: 20 },
  footerNote: { color: themeColors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 16 },
  acceptBar: { backgroundColor: themeColors.warningSurface, borderRadius: 16, marginTop: 20, padding: 16 },
  acceptTitle: { color: themeColors.warning, fontSize: 18, fontWeight: '900' },
  acceptBody: { color: themeColors.text, fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 6 },
  error: { color: themeColors.danger, fontSize: 12, fontWeight: '900', marginTop: 10 },
  acceptButton: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 12, height: 48, justifyContent: 'center', marginTop: 14 },
  disabled: { opacity: 0.72 },
  acceptButtonText: { color: themeColors.white, fontSize: 14, fontWeight: '900' },
  declineButton: { alignItems: 'center', paddingVertical: 14 },
  declineText: { color: themeColors.danger, fontSize: 13, fontWeight: '900' },
  support: { alignItems: 'center', marginTop: 22, paddingVertical: 8 },
  supportText: { color: themeColors.primary, fontSize: 13, fontWeight: '800' },
});
