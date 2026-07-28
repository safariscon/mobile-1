import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function Header() {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} activeOpacity={0.75}>
        <Feather name="menu" size={27} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.logoWrap}>
        <View style={styles.logoMark}>
          <Text style={styles.logoInitial}>S</Text>
        </View>
        <Text style={styles.logoText}>safariscon</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.75}>
          <Feather name="bell" size={24} color={colors.text} />
          <View style={styles.dot} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.75}>
          <Feather name="user" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: colors.surface,
  },
  iconButton: {
    height: 38,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    marginLeft: 10,
  },
  logoMark: {
    height: 36,
    width: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  logoInitial: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  logoText: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: '800',
    marginLeft: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    position: 'absolute',
    right: 7,
    top: 6,
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
