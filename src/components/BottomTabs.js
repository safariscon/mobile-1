import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';

export default function BottomTabs({ activeTab, onChangeTab, tabs = [] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        const isCenter = tab.key === 'services' || tab.key === 'seller_catalog' || tab.key === 'admin_stats';
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            activeOpacity={0.8}
            onPress={() => onChangeTab(tab.key)}
          >
            {isCenter ? (
              <View
                style={[
                  styles.centerAction,
                  {
                    backgroundColor: active ? colors.primaryDark : colors.primary,
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <Feather name={tab.icon} size={23} color="#FFFFFF" />
              </View>
            ) : (
              <>
                <Feather name={tab.icon} size={22} color={active ? colors.primary : colors.muted} />
                <Text style={[styles.label, { color: active ? colors.primary : colors.muted }]}>{tab.label}</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 82,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerAction: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    width: 48,
    elevation: 7,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 5,
  },
});
