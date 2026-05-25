import { useEffect, useMemo, useState } from 'react';
import type { LocationData } from '../types/invoice';
import Combobox from './Combobox';

// `country-state-city` ships ~3-5 MB of bundled geographic data. We import it
// lazily so it's not part of the main bundle — the dropdowns fall back to an
// empty option list for the brief moment between mount and chunk-load.
type CSCModule = typeof import('country-state-city');
let cscModulePromise: Promise<CSCModule> | null = null;
function loadCSC(): Promise<CSCModule> {
  if (!cscModulePromise) cscModulePromise = import('country-state-city');
  return cscModulePromise;
}

interface Props {
  label: string;
  value: LocationData;
  onChange: (data: LocationData) => void;
  /** Mark Country/State/City as required */
  requiredLocation?: boolean;
  /** Mark Pincode as required (defaults to true when requiredLocation is true, for backward compat) */
  requiredPincode?: boolean;
  /** Per-field error highlights */
  countryError?: boolean;
  stateError?: boolean;
  cityError?: boolean;
  pincodeError?: boolean;
}

const BLANK_LOCATION: LocationData = { country: '', state: '', city: '', pincode: '' };

function InputField({ label, value, onChange, placeholder, required = false, error = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  required?: boolean; error?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-semibold uppercase tracking-wide ${error ? 'text-red-500' : 'text-blue-600'}`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
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

export default function LocationSelector({
  label, value, onChange,
  requiredLocation = false,
  requiredPincode,
  countryError = false, stateError = false, cityError = false, pincodeError = false,
}: Props) {
  const safe = value ?? BLANK_LOCATION;
  const pincodeRequired = requiredPincode ?? requiredLocation;

  const [csc, setCsc] = useState<CSCModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCSC().then((mod) => { if (!cancelled) setCsc(mod); });
    return () => { cancelled = true; };
  }, []);

  // Build option lists. We attach country/state hints via a "value" encoding for cross-search.
  // value scheme: "ISO" for country; "COUNTRY|STATE" for state; "COUNTRY|STATE|CITY" for city.
  const countryOptions = useMemo(
    () => csc ? csc.Country.getAllCountries().map((c) => ({ value: c.isoCode, label: c.name })) : [],
    [csc]
  );

  const stateOptions = useMemo(() => {
    if (!csc) return [];
    if (safe.country) {
      return csc.State.getStatesOfCountry(safe.country).map((s) => ({
        value: `${safe.country}|${s.isoCode}`,
        label: s.name,
      }));
    }
    // global search across all states
    return csc.State.getAllStates().map((s) => ({
      value: `${s.countryCode}|${s.isoCode}`,
      label: `${s.name} (${csc.Country.getCountryByCode(s.countryCode)?.name ?? s.countryCode})`,
    }));
  }, [csc, safe.country]);

  const cityOptions = useMemo(() => {
    if (!csc) return [];
    if (safe.country && safe.state) {
      return csc.City.getCitiesOfState(safe.country, safe.state).map((c) => ({
        value: `${safe.country}|${safe.state}|${c.name}`,
        label: c.name,
      }));
    }
    // global search across all cities
    return csc.City.getAllCities().map((c) => ({
      value: `${c.countryCode}|${c.stateCode}|${c.name}`,
      label: `${c.name}, ${c.stateCode}, ${c.countryCode}`,
    }));
  }, [csc, safe.country, safe.state]);

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
          required={requiredLocation}
          error={countryError}
        />
        <Combobox
          label="State"
          value={stateValue}
          options={stateOptions}
          onChange={handleState}
          placeholder="Search state…"
          required={requiredLocation}
          error={stateError}
        />
        <Combobox
          label="City"
          value={cityValue}
          options={cityOptions}
          onChange={handleCity}
          placeholder="Search city…"
          required={requiredLocation}
          error={cityError}
        />
        <InputField
          label="Pincode"
          value={safe.pincode}
          onChange={(pincode) => onChange({ ...safe, pincode })}
          placeholder="Enter Pincode"
          required={pincodeRequired}
          error={pincodeError}
        />
      </div>
    </div>
  );
}
