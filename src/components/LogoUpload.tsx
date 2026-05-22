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

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
        Upload Company Logo
      </label>

      <div
        onClick={() => inputRef.current?.click()}
        className="relative w-28 h-28 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition overflow-hidden group"
        title={logo ? 'Click to change logo' : 'Click to upload logo'}
      >
        {logo ? (
          <>
            <img src={logo} alt="Company Logo" className="w-full h-full object-contain p-1" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              title="Remove logo"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-700 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center text-blue-500">
            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-xs font-medium text-center leading-tight">Click to upload</span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
