import { useMemo } from 'react';
import { Country, State, City } from 'country-state-city';
import type { LocationData } from '../types/invoice';
import Combobox from './Combobox';

interface Props {
  label: string;
  value: LocationData;
  onChange: (data: LocationData) => void;
}

const BLANK_LOCATION: LocationData = { country: '', state: '', city: '', pincode: '' };

function InputField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition placeholder-gray-400"
      />
    </div>
  );
}

export default function LocationSelector({ label, value, onChange }: Props) {
  const safe = value ?? BLANK_LOCATION;

  // Build option lists. We attach country/state hints via a "value" encoding for cross-search.
  // value scheme: "ISO" for country; "COUNTRY|STATE" for state; "COUNTRY|STATE|CITY" for city.
  const countryOptions = useMemo(
    () => Country.getAllCountries().map((c) => ({ value: c.isoCode, label: c.name })),
    []
  );

  const stateOptions = useMemo(() => {
    if (safe.country) {
      return State.getStatesOfCountry(safe.country).map((s) => ({
        value: `${safe.country}|${s.isoCode}`,
        label: s.name,
      }));
    }
    // global search across all states
    return State.getAllStates().map((s) => ({
      value: `${s.countryCode}|${s.isoCode}`,
      label: `${s.name} (${Country.getCountryByCode(s.countryCode)?.name ?? s.countryCode})`,
    }));
  }, [safe.country]);

  const cityOptions = useMemo(() => {
    if (safe.country && safe.state) {
      return City.getCitiesOfState(safe.country, safe.state).map((c) => ({
        value: `${safe.country}|${safe.state}|${c.name}`,
        label: c.name,
      }));
    }
    // global search across all cities
    return City.getAllCities().map((c) => ({
      value: `${c.countryCode}|${c.stateCode}|${c.name}`,
      label: `${c.name}, ${c.stateCode}, ${c.countryCode}`,
    }));
  }, [safe.country, safe.state]);

  // Display value for each combobox = the chosen option's value
  const countryValue = safe.country;
  const stateValue = safe.country && safe.state ? `${safe.country}|${safe.state}` : '';
  const cityValue = safe.country && safe.state && safe.city ? `${safe.country}|${safe.state}|${safe.city}` : '';

  function handleCountry(v: string) {
    if (!v) { onChange({ ...safe, country: '', state: '', city: '' }); return; }
    onChange({ ...safe, country: v, state: '', city: '' });
  }

  function handleState(v: string) {
    if (!v) { onChange({ ...safe, state: '', city: '' }); return; }
    const [country, state] = v.split('|');
    onChange({ ...safe, country, state, city: '' });
  }

  function handleCity(v: string) {
    if (!v) { onChange({ ...safe, city: '' }); return; }
    const [country, state, city] = v.split('|');
    onChange({ ...safe, country, state, city });
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Combobox
          label="Country"
          value={countryValue}
          options={countryOptions}
          onChange={handleCountry}
          placeholder="Search country…"
        />
        <Combobox
          label="State"
          value={stateValue}
          options={stateOptions}
          onChange={handleState}
          placeholder="Search state…"
        />
        <Combobox
          label="City"
          value={cityValue}
          options={cityOptions}
          onChange={handleCity}
          placeholder="Search city…"
        />
        <InputField
          label="Pincode"
          value={safe.pincode}
          onChange={(pincode) => onChange({ ...safe, pincode })}
          placeholder="Enter Pincode"
        />
      </div>
    </div>
  );
}
