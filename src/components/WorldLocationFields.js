import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SelectField, TextField } from './FormFields';
import { fetchCountries, fetchCountryStates, fetchStateCities, locationToText } from '../lib/geo';

export default function WorldLocationFields({
  value = {},
  onChange,
  required = true,
  showArea = true,
  title = 'Location',
  help = 'Country and city are required. Region can be typed when a country has no states list.',
}) {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  const country = value.country || '';
  const countryCode = value.countryCode || '';
  const state = value.state || value.province || '';
  const city = value.city || value.district || '';

  useEffect(() => {
    let active = true;
    fetchCountries()
      .then((items) => { if (active) setCountries(items); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!country) {
      setStates([]);
      setCities([]);
      return undefined;
    }
    let active = true;
    setLoadingPlaces(true);
    fetchCountryStates(country)
      .then((items) => { if (active) setStates(items); })
      .finally(() => { if (active) setLoadingPlaces(false); });
    return () => { active = false; };
  }, [country]);

  useEffect(() => {
    if (!country || !state || !states.length) {
      setCities([]);
      return undefined;
    }
    let active = true;
    fetchStateCities(country, state)
      .then((items) => { if (active) setCities(items); });
    return () => { active = false; };
  }, [country, state, states.length]);

  const update = (patch) => {
    const next = {
      country,
      countryCode,
      state,
      province: state,
      city,
      district: city,
      sector: value.sector || '',
      ...value,
      ...patch,
    };
    if (patch.country !== undefined) {
      const match = countries.find((item) => item.name === patch.country);
      next.countryCode = match?.code || '';
      next.state = '';
      next.province = '';
      next.city = '';
      next.district = '';
    }
    if (patch.state !== undefined) {
      next.province = patch.state;
      next.city = patch.city ?? '';
      next.district = patch.city ?? '';
    }
    if (patch.city !== undefined) {
      next.district = patch.city;
    }
    onChange?.({ ...next, label: locationToText(next) });
  };

  const countryOptions = useMemo(
    () => [['', 'Select country'], ...countries.map((item) => [item.name, `${item.name} (${item.code})`])],
    [countries]
  );
  const stateOptions = useMemo(
    () => [['', states.length ? 'Select region' : 'Type region'], ...states.map((item) => [item, item])],
    [states]
  );
  const cityOptions = useMemo(
    () => [['', cities.length ? 'Select city' : 'Type city'], ...cities.map((item) => [item, item])],
    [cities]
  );

  const mark = required ? ' *' : '';

  return (
    <View>
      {title ? <Text style={{ fontSize: 14, fontWeight: '900', marginBottom: 6 }}>{title}</Text> : null}
      {help ? <Text style={{ fontSize: 12, fontWeight: '700', marginBottom: 8, opacity: 0.7 }}>{help}</Text> : null}
      {loading ? <ActivityIndicator /> : (
        <SelectField label={`Country${mark}`} value={country} options={countryOptions} onChange={(next) => update({ country: next })} placeholder="Select country" />
      )}
      {loadingPlaces ? <ActivityIndicator /> : null}
      {states.length ? (
        <SelectField label={`Region / state${mark}`} value={state} options={stateOptions} onChange={(next) => update({ state: next })} placeholder="Select region" />
      ) : (
        <TextField label={`Region / state${mark}`} value={state} onChangeText={(text) => update({ state: text })} placeholder="Region or state" />
      )}
      {cities.length ? (
        <SelectField label={`City${mark}`} value={city} options={cityOptions} onChange={(next) => update({ city: next })} placeholder="Select city" />
      ) : (
        <TextField label={`City${mark}`} value={city} onChangeText={(text) => update({ city: text })} placeholder="City" />
      )}
      {showArea ? (
        <TextField label="Area / neighborhood (optional)" value={value.sector || ''} onChangeText={(text) => update({ sector: text })} placeholder="Optional area" />
      ) : null}
    </View>
  );
}
