import { useRef } from 'react';

interface Props {
  label: string;
  value: string | null;
  onChange: (base64: string | null) => void;
  hint?: string;
}

export default function ImageUploadField({ label, value, onChange, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}

      {value ? (
        <div className="flex items-start gap-3">
          <div className="w-28 h-20 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
            <img src={value} alt={label} className="max-w-full max-h-full object-contain p-1" />
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition underline"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition underline"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-28 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer"
        >
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
          </svg>
          <span className="text-xs text-slate-400 font-medium">Upload</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
