import { Text, TouchableOpacity, View } from 'react-native';
import { CAR_FUEL_TYPES, domainCopy, joinDateTimeValue, resolveDomain, resolveSubtype, splitDateTimeValue } from './registry';
import { DateField, DateTimeField, MultilineField, NumberField, SelectField, TextField, TimeField } from '../../components/FormFields';

const addDay = (iso) => {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

function BoolField({ label, value, onChange }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.84} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: value ? '#0754d7' : '#94a3b8', backgroundColor: value ? '#0754d7' : 'transparent' }} />
      <Text style={{ fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ListingFields({ category, values = {}, onChange }) {
  const domain = resolveDomain(category);
  const subtype = resolveSubtype(category);
  const set = (key, value) => onChange({ ...values, [key]: value });

  if (domain === 'accommodation') {
    const identity = values.hostIdentity || {};
    const setIdentity = (patch) => set('hostIdentity', { ...identity, ...patch });
    return (
      <View>
        <TimeField label="Check-in from" value={values.checkInFrom || values.checkInTime} onChange={(value) => onChange({ ...values, checkInFrom: value, checkInTime: value })} />
        <TimeField label="Check-in until" value={values.checkInUntil} onChange={(value) => set('checkInUntil', value)} />
        <TimeField label="Check-out until" value={values.checkOutUntil || values.checkOutTime} onChange={(value) => onChange({ ...values, checkOutUntil: value, checkOutTime: value })} />
        <SelectField label="Star rating" value={values.starRating || 'unrated'} options={['unrated', '1-star', '2-star', '3-star', '4-star', '5-star']} onChange={(value) => set('starRating', value)} searchable={false} />
        <SelectField label="Allow children" value={values.allowsChildren || 'yes'} options={['yes', 'no']} onChange={(value) => set('allowsChildren', value)} searchable={false} />
        <SelectField label="Allow pets" value={values.allowsPets || 'no'} options={['yes', 'upon_request', 'no']} onChange={(value) => set('allowsPets', value)} searchable={false} />
        <BoolField label="Children stay for free" value={Boolean(values.childrenStayFree)} onChange={(value) => set('childrenStayFree', value)} />
        <MultilineField label="Property amenities" value={Array.isArray(values.amenities) ? values.amenities.join(', ') : (values.amenities || '')} onChangeText={(value) => set('amenities', value)} />
        <SelectField label="First check-in" value={values.firstCheckInMode || 'asap'} options={[['asap', 'As soon as possible'], ['date', 'Specific date']]} onChange={(value) => set('firstCheckInMode', value)} searchable={false} />
        {values.firstCheckInMode === 'date' ? (
          <DateField label="First check-in date" value={values.firstCheckInDate} onChange={(value) => set('firstCheckInDate', value)} />
        ) : null}
        <SelectField label="Open calendar" value={String(values.availabilityHorizonDays || 365)} options={[['365', '365 days'], ['548', '18 months']]} onChange={(value) => set('availabilityHorizonDays', Number(value))} searchable={false} />
        <BoolField label="Allow 30+ night stays" value={Boolean(values.allowLongStays)} onChange={(value) => set('allowLongStays', value)} />
        <TextField label="Invoice / legal name" value={identity.legalName || ''} onChangeText={(value) => setIdentity({ legalName: value })} />
        <SelectField label="ID type" value={identity.idType || 'national_id'} options={[['national_id', 'National ID'], ['passport', 'Passport'], ['company_registration', 'Company registration']]} onChange={(value) => setIdentity({ idType: value })} searchable={false} />
        <TextField label="ID / registration number" value={identity.idNumber || ''} onChangeText={(value) => setIdentity({ idNumber: value })} />
      </View>
    );
  }
  if (domain === 'transport' && subtype === 'car-rental') {
    return (
      <View>
        <SelectField label="Vehicle class" value={values.vehicleClass} options={['Economy', 'Compact', 'SUV', 'Van', 'Luxury']} onChange={(value) => set('vehicleClass', value)} searchable={false} />
        <SelectField label="Transmission" value={values.transmission} options={['Automatic', 'Manual']} onChange={(value) => set('transmission', value)} searchable={false} />
        <SelectField label="Fuel type" value={values.fuelType || 'Petrol'} options={CAR_FUEL_TYPES} onChange={(value) => set('fuelType', value)} searchable={false} />
        <SelectField label="Fuel policy" value={values.fuelPolicy} options={['Full-to-full', 'Same-to-same', 'Prepaid']} onChange={(value) => set('fuelPolicy', value)} searchable={false} />
        <NumberField label="Minimum driver age" value={String(values.minimumDriverAge ?? '')} onChangeText={(value) => set('minimumDriverAge', value)} />
        <BoolField label="With driver" value={Boolean(values.withDriver)} onChange={(value) => set('withDriver', value)} />
        <BoolField label="Insurance included" value={Boolean(values.insuranceIncluded)} onChange={(value) => set('insuranceIncluded', value)} />
        <TimeField label="Pickup from" value={values.pickupTime || '08:00'} onChange={(value) => set('pickupTime', value)} />
        <TimeField label="Return by" value={values.returnTime || '18:00'} onChange={(value) => set('returnTime', value)} />
        <NumberField label="Minimum rental (days)" value={String(values.minRentalDays ?? 1)} onChangeText={(value) => set('minRentalDays', value)} />
        <NumberField label="Maximum rental (days)" value={String(values.maxRentalDays ?? 30)} onChangeText={(value) => set('maxRentalDays', value)} />
        <MultilineField label="Security deposit note" value={values.depositNote} onChangeText={(value) => set('depositNote', value)} />
      </View>
    );
  }
  if (domain === 'transport' && subtype === 'taxi') {
    return <TextField label="Vehicle type" value={values.vehicleType} onChangeText={(value) => set('vehicleType', value)} />;
  }
  if (domain === 'transport' && subtype === 'motorbike') {
    return (
      <View>
        <BoolField label="Helmet included" value={Boolean(values.helmetIncluded)} onChange={(value) => set('helmetIncluded', value)} />
        <NumberField label="Minimum rider age" value={String(values.minimumDriverAge ?? '')} onChangeText={(value) => set('minimumDriverAge', value)} />
      </View>
    );
  }
  if (domain === 'experiences') {
    return (
      <View>
        <TextField label="Duration" value={values.duration} onChangeText={(value) => set('duration', value)} />
        <SelectField label="Difficulty" value={values.difficulty} options={['Easy', 'Moderate', 'Challenging']} onChange={(value) => set('difficulty', value)} searchable={false} />
        <TextField label="Meeting point" value={values.meetingPoint} onChangeText={(value) => set('meetingPoint', value)} />
        <MultilineField label="What's included" value={values.included} onChangeText={(value) => set('included', value)} />
        <MultilineField label="What's excluded" value={values.excluded} onChangeText={(value) => set('excluded', value)} />
      </View>
    );
  }
  if (domain === 'dining') {
    return (
      <View>
        {subtype === 'bar' ? (
          <TextField label="Atmosphere" value={values.atmosphere} onChangeText={(value) => set('atmosphere', value)} />
        ) : (
          <TextField label="Cuisine" value={values.cuisine} onChangeText={(value) => set('cuisine', value)} />
        )}
        <NumberField label="Seating capacity" value={String(values.seatingCapacity ?? '')} onChangeText={(value) => set('seatingCapacity', value)} />
        <MultilineField label="Opening hours" value={values.openingHours} onChangeText={(value) => set('openingHours', value)} />
      </View>
    );
  }
  return (
    <View>
      <NumberField label="Max capacity" value={String(values.maxCapacity ?? '')} onChangeText={(value) => set('maxCapacity', value)} />
      <BoolField label="Catering available" value={Boolean(values.cateringAvailable)} onChange={(value) => set('cateringAvailable', value)} />
      <MultilineField label="Amenities" value={values.amenities} onChangeText={(value) => set('amenities', value)} />
    </View>
  );
}

export function InventoryFields({ category, values = {}, onChange }) {
  const domain = resolveDomain(category);
  const copy = domainCopy(category);
  const set = (key, value) => onChange({ ...values, [key]: value });
  if (domain === 'accommodation') {
    return (
      <View>
        <NumberField label="Max guests" value={String(values.maxGuests ?? '')} onChangeText={(value) => set('maxGuests', value)} />
        <TextField label="Bed type" value={values.bedType} onChangeText={(value) => set('bedType', value)} />
        <NumberField label="Number of beds" value={String(values.numberOfBeds ?? '')} onChangeText={(value) => set('numberOfBeds', value)} />
        <NumberField label="Bedrooms" value={String(values.bedrooms ?? '')} onChangeText={(value) => set('bedrooms', value)} />
        <NumberField label="Quantity" value={String(values.quantity ?? '')} onChangeText={(value) => set('quantity', value)} />
        <BoolField label="Private bathroom" value={values.bathroomPrivate !== false} onChange={(value) => set('bathroomPrivate', value)} />
      </View>
    );
  }
  if (domain === 'transport') {
    return (
      <View>
        <TextField label="Make" value={values.make} onChangeText={(value) => set('make', value)} />
        <TextField label="Model" value={values.model} onChangeText={(value) => set('model', value)} />
        <NumberField label="Seats" value={String(values.seats ?? '')} onChangeText={(value) => set('seats', value)} />
        <BoolField label="Air conditioning" value={Boolean(values.ac)} onChange={(value) => set('ac', value)} />
        <NumberField label={copy.capacityLabel} value={String(values.quantity ?? 1)} onChangeText={(value) => set('quantity', value)} />
      </View>
    );
  }
  if (domain === 'experiences') {
    return <SelectField label="Package type" value={values.packageType} options={['Adult', 'Child', 'Family']} onChange={(value) => set('packageType', value)} searchable={false} />;
  }
  if (domain === 'venues') {
    return <TextField label="Package name" value={values.packageName} onChangeText={(value) => set('packageName', value)} />;
  }
  return null;
}

export function BookingFields({ category, values = {}, onChange }) {
  const domain = resolveDomain(category);
  const subtype = resolveSubtype(category);
  const set = (key, value) => onChange({ ...values, [key]: value });

  if (domain === 'accommodation') {
    return (
      <View>
        <DateField label="Check-in" value={values.checkIn} onChange={(value) => set('checkIn', value)} />
        <DateField label="Check-out" value={values.checkOut} onChange={(value) => set('checkOut', value)} />
        <NumberField label="Guests" value={String(values.guests ?? '')} onChangeText={(value) => set('guests', value)} />
        <MultilineField label="Special requests" value={values.specialRequests} onChangeText={(value) => set('specialRequests', value)} />
      </View>
    );
  }
  if (domain === 'transport' && subtype === 'taxi') {
    return (
      <View>
        <TextField label="Pickup location" value={values.pickupLocation} onChangeText={(value) => set('pickupLocation', value)} />
        <TextField label="Drop-off location" value={values.dropoffLocation} onChangeText={(value) => set('dropoffLocation', value)} />
        <DateTimeField label="Pickup date/time" value={values.pickupDateTime} onChange={(value) => set('pickupDateTime', value)} />
      </View>
    );
  }
  if (domain === 'transport') {
    const listingDetails = category?.listingAttributes || {};
    const pickupHours = listingDetails.pickupTime || '08:00';
    const returnHours = listingDetails.returnTime || '18:00';
    const pickup = splitDateTimeValue(values.pickupDateTime);
    const ret = splitDateTimeValue(values.returnDateTime);
    return (
      <View>
        <TextField label="Pickup location" value={values.pickupLocation} onChangeText={(value) => set('pickupLocation', value)} />
        <TextField label="Return location" value={values.returnLocation} onChangeText={(value) => set('returnLocation', value)} />
        <DateField
          label="Pickup date"
          value={pickup.date}
          onChange={(value) => onChange({
            ...values,
            pickupDateTime: joinDateTimeValue(value, pickup.time || pickupHours),
            returnDateTime: ret.date && ret.date > value
              ? joinDateTimeValue(ret.date, ret.time || returnHours)
              : joinDateTimeValue(addDay(value), ret.time || returnHours),
          })}
        />
        <TimeField
          label="Pickup time"
          value={pickup.time || pickupHours}
          onChange={(value) => set('pickupDateTime', joinDateTimeValue(pickup.date, value))}
        />
        <DateField
          label="Return date"
          value={ret.date}
          onChange={(value) => set('returnDateTime', joinDateTimeValue(value, ret.time || returnHours))}
        />
        <TimeField
          label="Return time"
          value={ret.time || returnHours}
          onChange={(value) => set('returnDateTime', joinDateTimeValue(ret.date, value))}
        />
        {subtype === 'car-rental' ? (
          <>
            <NumberField label="Driver age" value={String(values.driverAge ?? '')} onChangeText={(value) => set('driverAge', value)} />
            <TextField label="Driver license number" value={values.driverLicenseNumber} onChangeText={(value) => set('driverLicenseNumber', value)} />
            <NumberField label="Number of drivers" value={String(values.numberOfDrivers ?? '')} onChangeText={(value) => set('numberOfDrivers', value)} />
          </>
        ) : null}
      </View>
    );
  }
  if (domain === 'experiences') {
    return (
      <View>
        <DateField label="Preferred date" value={values.preferredDate} onChange={(value) => set('preferredDate', value)} />
        <NumberField label="Participants" value={String(values.participants ?? '')} onChangeText={(value) => set('participants', value)} />
        <NumberField label="Adults" value={String(values.adults ?? '')} onChangeText={(value) => set('adults', value)} />
        <NumberField label="Children" value={String(values.children ?? '')} onChangeText={(value) => set('children', value)} />
        <TextField label="Preferred language" value={values.language} onChangeText={(value) => set('language', value)} />
        <BoolField label="Need pickup" value={Boolean(values.pickupRequired)} onChange={(value) => set('pickupRequired', value)} />
        <MultilineField label="Special requirements" value={values.specialRequirements} onChangeText={(value) => set('specialRequirements', value)} />
      </View>
    );
  }
  if (domain === 'dining') {
    return (
      <View>
        <DateTimeField label="Reservation date/time" value={values.reservationDateTime} onChange={(value) => set('reservationDateTime', value)} />
        <NumberField label="Party size" value={String(values.partySize ?? '')} onChangeText={(value) => set('partySize', value)} />
        <MultilineField label="Allergies" value={values.allergies} onChangeText={(value) => set('allergies', value)} />
      </View>
    );
  }
  return (
    <View>
      <DateField label="Event date" value={values.eventDate} onChange={(value) => set('eventDate', value)} />
      <TimeField label="Start time" value={values.startTime} onChange={(value) => set('startTime', value)} />
      <TimeField label="End time" value={values.endTime} onChange={(value) => set('endTime', value)} />
      <NumberField label="Attendees" value={String(values.attendees ?? '')} onChangeText={(value) => set('attendees', value)} />
      <TextField label="Setup style" value={values.setupStyle} onChangeText={(value) => set('setupStyle', value)} />
      <MultilineField label="AV needs" value={values.avNeeds} onChangeText={(value) => set('avNeeds', value)} />
    </View>
  );
}
