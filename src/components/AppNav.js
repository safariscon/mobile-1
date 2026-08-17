import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { roleLabel, userInitials } from '../lib/navigation';
import { useAppDialog } from './AppDialog';

export function AppTopBar({ title, subtitle, user, onMenu, onProfile }) {
  const { colors } = useTheme();
  const initials = userInitials(user);
  const role = roleLabel(user);

  return (
    <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {onMenu ? (
        <TouchableOpacity style={[styles.menuButton, { backgroundColor: colors.primaryLight }]} onPress={onMenu} activeOpacity={0.84}>
          <Feather name="menu" size={18} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
          <Text style={styles.brandMarkText}>S</Text>
        </View>
      )}
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: colors.textStrong }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <TouchableOpacity style={styles.profileHit} onPress={onProfile} activeOpacity={0.86}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{user?.name || user?.email || 'Account'}</Text>
          <Text style={[styles.profileRole, { color: colors.primary }]}>{role}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function SegmentedTabs({ items = [], value, onChange }) {
  const { colors } = useTheme();
  if (!items.length) return null;
  return (
    <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
      {items.map((item) => {
        const active = value === item.key;
        return (
          <TouchableOpacity key={item.key} style={[styles.segmentItem, active && { backgroundColor: colors.primary }]} onPress={() => onChange(item.key)} activeOpacity={0.86}>
            <Text style={[styles.segmentText, { color: active ? '#FFFFFF' : colors.muted }]} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function MoreSheet({ visible, items, onClose, onSelect, onLogout }) {
  const { colors } = useTheme();
  const { dialogNode, askConfirm, closeDialog } = useAppDialog();
  const confirmLogout = () => {
    askConfirm({
      title: 'Log out?',
      message: 'You will need to sign in again to use this account.',
      confirmLabel: 'Logout',
      destructive: true,
      onConfirm: () => {
        closeDialog();
        onClose?.();
        onLogout?.();
      },
    });
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.moreBackdrop} onPress={onClose}>
          <Pressable style={[styles.moreSheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.moreHandle} />
            <View style={styles.moreHeader}>
              <Text style={[styles.moreTitle, { color: colors.textStrong }]}>More</Text>
              <TouchableOpacity style={[styles.closeButton, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.84}>
                <Feather name="x" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.moreGrid}>
              {items.map((item) => (
                <TouchableOpacity key={item.key} style={[styles.moreItem, { backgroundColor: colors.surfaceMuted }]} onPress={() => onSelect(item.key)} activeOpacity={0.84}>
                  <Feather name={item.icon} size={18} color={colors.primary} />
                  <Text style={[styles.moreItemText, { color: colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {onLogout ? (
              <TouchableOpacity style={styles.logoutLink} onPress={confirmLogout} activeOpacity={0.86}>
                <Feather name="log-out" size={16} color="#DC2626" />
                <Text style={styles.logoutLinkText}>Logout</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      {dialogNode}
    </>
  );
}

export function PageDrawer({ visible, title, items, activeKey, onClose, onSelect }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.drawerBackdrop} onPress={onClose}>
        <Pressable style={[styles.drawerPanel, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.drawerHeader}>
            <View>
              <Text style={[styles.drawerEyebrow, { color: colors.primary }]}>On this page</Text>
              <Text style={[styles.drawerTitle, { color: colors.textStrong }]}>{title}</Text>
            </View>
            <TouchableOpacity style={[styles.closeButton, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.drawerItems}>
            {items.map((item) => {
              const active = activeKey === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.drawerItem, { backgroundColor: active ? colors.primaryLight : colors.surfaceMuted }]}
                  onPress={() => onSelect(item.key)}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.drawerItemText, { color: active ? colors.primaryDark : colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuButton: { alignItems: 'center', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  brandMark: { alignItems: 'center', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  brandMarkText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  profileHit: { alignItems: 'center', flexDirection: 'row', gap: 8, maxWidth: 148 },
  avatar: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 11, fontWeight: '800' },
  profileRole: { fontSize: 10, fontWeight: '800' },
  segment: { borderRadius: 12, flexDirection: 'row', marginBottom: 12, padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 9, flex: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontSize: 11, fontWeight: '900' },
  moreBackdrop: { backgroundColor: 'rgba(2, 6, 23, 0.45)', flex: 1, justifyContent: 'flex-end' },
  moreSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  moreHandle: { alignSelf: 'center', backgroundColor: '#D0D5DD', borderRadius: 3, height: 5, marginBottom: 12, width: 46 },
  moreHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  moreTitle: { fontSize: 19, fontWeight: '900' },
  moreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moreItem: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 9, minHeight: 48, paddingHorizontal: 12, width: '48%' },
  moreItemText: { flex: 1, fontSize: 13, fontWeight: '800' },
  logoutLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginTop: 16, paddingVertical: 8 },
  logoutLinkText: { color: '#DC2626', fontSize: 14, fontWeight: '800' },
  closeButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  drawerBackdrop: { backgroundColor: 'rgba(2, 6, 23, 0.45)', flex: 1 },
  drawerPanel: { flex: 1, maxWidth: 320, padding: 18, paddingTop: 28, width: '82%' },
  drawerHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  drawerEyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  drawerTitle: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  drawerItems: { gap: 8 },
  drawerItem: { borderRadius: 12, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  drawerItemText: { fontSize: 14, fontWeight: '800' },
});
