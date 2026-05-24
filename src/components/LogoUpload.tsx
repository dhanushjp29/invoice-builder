import { useRef } from 'react';

interface Props {
  logo: string | null;
  onChange: (base64: string | null) => void;
}

export default function LogoUpload({ logo, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
        Upload Company Logo
      </label>

      {logo ? (
        <div className="flex items-start gap-3">
          <div className="w-28 h-28 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
            <img src={logo} alt="Company Logo" className="max-w-full max-h-full object-contain p-1" />
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
              onClick={handleRemove}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition underline"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-28 h-28 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition"
          title="Click to upload logo"
        >
          <div className="flex flex-col items-center text-blue-500">
            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-xs font-medium text-center leading-tight">Click to upload</span>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
