import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  TextField,
  MultilineField,
  NumberField,
  SelectField,
  DateField,
  TimeField,
  DateTimeField,
} from './FormFields';
import useThemedStyles from '../theme/useThemedStyles';

function schemaOptions(field = {}) {
  const options = Array.isArray(field.options) ? field.options : [];
  return options.map((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return [String(option), String(option)];
    }
    return [String(option.value ?? option.id ?? option.label), String(option.label ?? option.name ?? option.value)];
  });
}

function SchemaFieldControl({ field, value, onChange }) {
  const type = String(field.type || 'text').toLowerCase();
  const label = `${field.label || field.id}${field.required ? ' *' : ''}`;
  const options = schemaOptions(field);

  if (type === 'textarea') {
    return <MultilineField label={label} value={String(value ?? '')} onChangeText={onChange} placeholder={field.placeholder || ''} />;
  }
  if (type === 'number') {
    return <NumberField allowDecimal label={label} value={String(value ?? '')} onChangeText={onChange} placeholder={field.placeholder || ''} />;
  }
  if (type === 'date') {
    return <DateField label={label} value={String(value ?? '')} onChange={onChange} placeholder={field.placeholder || 'YYYY-MM-DD'} />;
  }
  if (type === 'time') {
    return <TimeField label={label} value={String(value ?? '')} onChange={onChange} placeholder={field.placeholder || 'HH:mm'} />;
  }
  if (type === 'datetime-local') {
    return <DateTimeField label={label} value={String(value ?? '')} onChange={onChange} placeholder={field.placeholder || ''} />;
  }
  if (type === 'select' || type === 'radio') {
    return (
      <SelectField
        label={label}
        value={String(value ?? '')}
        options={options}
        onChange={onChange}
        searchable={options.length > 8}
        placeholder={field.placeholder || field.label}
      />
    );
  }
  if (type === 'boolean' || type === 'checkbox') {
    const checked = value === true || value === 'true' || value === 'yes' || (Array.isArray(value) && value.length > 0);
    return (
      <TouchableOpacity
        onPress={() => onChange(!checked)}
        activeOpacity={0.84}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}
      >
        <View style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? '#0F766E' : '#CBD5E1',
          backgroundColor: checked ? '#0F766E' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        >
          {checked ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontWeight: '700', color: '#0F172A' }}>{label}</Text>
      </TouchableOpacity>
    );
  }
  if (type === 'file') {
    return (
      <TextField
        label={label}
        value={String(value ?? '')}
        onChangeText={onChange}
        placeholder={field.placeholder || 'https://… or file URL'}
        autoCapitalize="none"
      />
    );
  }

  const keyboardType = type === 'tel' ? 'phone-pad' : type === 'email' ? 'email-address' : type === 'url' ? 'url' : 'default';
  return (
    <TextField
      label={label}
      value={String(value ?? '')}
      onChangeText={onChange}
      placeholder={field.placeholder || ''}
      keyboardType={keyboardType}
      autoCapitalize={type === 'email' || type === 'url' ? 'none' : 'sentences'}
    />
  );
}

export function sortSchemaFields(fields = []) {
  return [...fields].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export function validateSchemaValues(fields = [], values = {}) {
  for (const field of sortSchemaFields(fields)) {
    if (!field.required) continue;
    const value = values[field.id];
    const empty = value === undefined || value === null || value === ''
      || (Array.isArray(value) && !value.length)
      || (typeof value === 'boolean' && value === false && field.type === 'checkbox');
    if (empty && field.type !== 'boolean') {
      return `${field.label || field.id} is required.`;
    }
  }
  return '';
}

export default function SchemaFields({ fields = [], values = {}, onChange, visibilityFilter }) {
  const { styles } = useThemedStyles(createStyles);
  const visible = sortSchemaFields(fields).filter((field) => {
    if (!visibilityFilter) return true;
    return (field.visibility || 'public') === visibilityFilter || visibilityFilter === 'all';
  });

  if (!visible.length) {
    return <Text style={styles.empty}>No fields configured for this category.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {visible.map((field) => (
        <SchemaFieldControl
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(next) => onChange(field.id, next)}
        />
      ))}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: {
    gap: 2,
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
});
