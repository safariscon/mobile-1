import { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useThemedStyles from '../theme/useThemedStyles';

const pad = (value) => String(value).padStart(2, '0');

export function formatDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTimeValue(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTimeValue(date) {
  return `${formatDateValue(date)}T${formatTimeValue(date)}`;
}

function normalizeOptions(options = []) {
  return options.map((option) => {
    if (Array.isArray(option)) {
      return { value: option[0], label: option[1] };
    }

    return {
      value: option.value ?? option.id ?? option.name ?? option.label,
      label: option.label ?? option.name ?? String(option.value ?? ''),
      description: option.description ?? option.meta ?? option.priceText ?? '',
    };
  });
}

export function TextField({ label, error, style, inputStyle, ...inputProps }) {
  const { colors, styles } = useThemedStyles(createStyles);
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.muted}
        style={[styles.input, inputStyle]}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function MultilineField({ inputStyle, ...props }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <TextField
      {...props}
      multiline
      inputStyle={[styles.textArea, inputStyle]}
      textAlignVertical="top"
    />
  );
}

export function NumberField({ allowDecimal = false, allowNegative = false, onChangeText, ...props }) {
  const handleChangeText = (nextValue) => {
    const invalidCharacters = allowDecimal ? /[^0-9.-]/g : /[^0-9-]/g;
    const cleaned = String(nextValue || '').replace(invalidCharacters, '');
    const signed = allowNegative
      ? cleaned.replace(/(?!^)-/g, '')
      : cleaned.replace(/-/g, '');
    const normalized = allowDecimal ? signed.replace(/(\..*)\./g, '$1') : signed;
    onChangeText?.(normalized);
  };

  return (
    <TextField
      {...props}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      onChangeText={handleChangeText}
    />
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option',
  searchable = true,
  error,
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const selectedOption = normalizedOptions.find((option) => String(option.value) === String(value));
  const query = search.trim().toLowerCase();
  const filteredOptions = normalizedOptions.filter((option) => (
    `${option.label} ${option.description}`.toLowerCase().includes(query)
  ));

  const open = () => {
    Keyboard.dismiss();
    setSearch('');
    setVisible(true);
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.pressableField, selectedOption && styles.pressableFieldSelected]}
        onPress={open}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selectedOption?.label || placeholder}`}
      >
        <View style={[styles.fieldLeadIcon, selectedOption && styles.fieldLeadIconSelected]}>
          <Feather name={selectedOption ? 'check' : 'list'} size={15} color={selectedOption ? colors.white : colors.primary} />
        </View>
        <Text style={[styles.pressableText, !selectedOption && styles.placeholder]} numberOfLines={1}>
          {selectedOption?.label || placeholder}
        </Text>
        <View style={styles.chevronCircle}><Feather name="chevron-down" size={17} color={colors.primary} /></View>
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: Math.max(16, insets.bottom + 8) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{label}</Text>
                <Text style={styles.modalSubtitle}>{filteredOptions.length} {filteredOptions.length === 1 ? 'choice' : 'choices'}</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={() => setVisible(false)} activeOpacity={0.84}>
                <Feather name="x" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {searchable && normalizedOptions.length > 5 ? (
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
              </View>
            ) : null}

            <FlatList
              data={filteredOptions}
              keyExtractor={(option) => String(option.value)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>No options found.</Text>}
              renderItem={({ item }) => {
                const selected = String(item.value) === String(value);
                return (
                  <TouchableOpacity
                    style={[styles.optionRow, selected && styles.optionRowActive]}
                    onPress={() => {
                      onChange?.(item.value);
                      setVisible(false);
                    }}
                    activeOpacity={0.84}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{item.label}</Text>
                      {!!item.description && <Text style={styles.optionDescription}>{item.description}</Text>}
                    </View>
                    <Feather name="chevron-right" size={17} color={selected ? colors.primary : colors.muted} />
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function dateFromValue(value, mode) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value);

  const text = String(value || '').trim();
  const now = new Date();
  if (!text) return now;

  if (mode === 'time') {
    const match = text.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      now.setHours(Number(match[1]), Number(match[2]), 0, 0);
      return now;
    }
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      0,
      0
    );
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

function clampDate(date, minimumDate, maximumDate) {
  const timestamp = date.getTime();
  if (minimumDate instanceof Date && timestamp < minimumDate.getTime()) return new Date(minimumDate);
  if (maximumDate instanceof Date && timestamp > maximumDate.getTime()) return new Date(maximumDate);
  return date;
}

function DateInput({
  label,
  value,
  onChange,
  placeholder,
  mode,
  error,
  minimumDate,
  maximumDate,
  style,
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const selectedDate = clampDate(dateFromValue(value, mode), minimumDate, maximumDate);
  const icon = mode === 'time' ? 'clock' : 'calendar';

  const commit = (date) => {
    if (mode === 'time') onChange?.(formatTimeValue(date));
    else if (mode === 'datetime') onChange?.(formatDateTimeValue(date));
    else onChange?.(formatDateValue(date));
  };

  const openAndroidTime = (date) => {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'time',
      is24Hour: true,
      onChange: (event, selectedTime) => {
        if (event.type !== 'set' || !selectedTime) return;
        const combined = new Date(date);
        combined.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        commit(combined);
      },
    });
  };

  const openPicker = () => {
    Keyboard.dismiss();

    if (Platform.OS === 'android') {
      if (mode === 'datetime') {
        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: 'date',
          minimumDate,
          maximumDate,
          onChange: (event, chosenDate) => {
            if (event.type !== 'set' || !chosenDate) return;
            const combined = new Date(selectedDate);
            combined.setFullYear(chosenDate.getFullYear(), chosenDate.getMonth(), chosenDate.getDate());
            openAndroidTime(combined);
          },
        });
        return;
      }

      DateTimePickerAndroid.open({
        value: selectedDate,
        mode,
        is24Hour: mode === 'time',
        minimumDate: mode === 'date' ? minimumDate : undefined,
        maximumDate: mode === 'date' ? maximumDate : undefined,
        onChange: (event, chosenDate) => {
          if (event.type === 'set' && chosenDate) commit(chosenDate);
        },
      });
      return;
    }

    setShowIOSPicker(true);
  };

  if (Platform.OS === 'web') {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        error={error}
        style={style}
        inputStyle={styles.dateInput}
      />
    );
  }

  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.pressableField}
        onPress={openPicker}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value || placeholder}`}
      >
        <Text style={[styles.pressableText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Feather name={icon} size={18} color={colors.primary} />
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {Platform.OS === 'ios' && showIOSPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode={mode}
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, chosenDate) => {
            setShowIOSPicker(false);
            if (event.type === 'set' && chosenDate) commit(chosenDate);
          }}
        />
      ) : null}
    </View>
  );
}

export function DateField(props) {
  return <DateInput {...props} mode="date" />;
}

export function TimeField(props) {
  return <DateInput {...props} mode="time" />;
}

export function DateTimeField(props) {
  return <DateInput {...props} mode="datetime" />;
}

const createStyles = (colors) => StyleSheet.create({
  fieldWrap: {
    flex: 1,
    marginTop: 13,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInput: {
    minHeight: 46,
  },
  textArea: {
    minHeight: 96,
  },
  pressableField: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 10,
  },
  pressableFieldSelected: {
    backgroundColor: colors.input,
    borderColor: colors.primary,
  },
  fieldLeadIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  fieldLeadIconSelected: {
    backgroundColor: colors.primary,
  },
  chevronCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  pressableText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  placeholder: {
    color: colors.muted,
  },
  error: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(16, 24, 40, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '78%',
    padding: 16,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 3,
    height: 5,
    marginBottom: 13,
    width: 48,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    minHeight: 42,
  },
  optionRow: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRowActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#94A3B8',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: { backgroundColor: colors.primary, borderRadius: 5, height: 10, width: 10 },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  optionLabelSelected: { color: colors.primaryDark },
  optionDescription: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 20,
    textAlign: 'center',
  },
});
