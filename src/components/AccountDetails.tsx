import type { AccountDetails as AccountDetailsType } from '../types/invoice';

interface Props {
  value: AccountDetailsType | undefined;
  errors?: Set<string>;
  onChange: (next: AccountDetailsType) => void;
}

function InputField({ label, value, onChange, placeholder = '', required = false, error = false, uppercase = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; error?: boolean; uppercase?: boolean;
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
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        className={`px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition placeholder-gray-400${uppercase ? ' uppercase' : ''}`}
      />
    </div>
  );
}

const EMPTY: AccountDetailsType = {
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
};

export default function AccountDetails({ value, errors, onChange }: Props) {
  const v = value ?? EMPTY;
  const hasErr = (key: string) => !!errors?.has(key);
  const patch = (field: keyof AccountDetailsType, val: string) => onChange({ ...v, [field]: val });

  return (
    <div data-tour="account-details" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-5 ring-1 ring-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-blue-500 rounded-full" />
        <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">Account Details</h2>
        <span className="text-[10px] font-semibold text-slate-400 ml-1">(payment instructions)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField
          label="Account Holder Name"
          value={v.accountHolderName}
          onChange={(val) => patch('accountHolderName', val)}
          placeholder="As per bank records"
          required
          error={hasErr('accountHolderName')}
        />
        <InputField
          label="Bank Name"
          value={v.bankName}
          onChange={(val) => patch('bankName', val)}
          placeholder="e.g. HDFC Bank"
          required
          error={hasErr('bankName')}
        />
        <InputField
          label="Account Number"
          value={v.accountNumber}
          onChange={(val) => patch('accountNumber', val)}
          placeholder="1234567890123"
          required
          error={hasErr('accountNumber')}
        />
        <InputField
          label="IFSC Code"
          value={v.ifscCode}
          onChange={(val) => patch('ifscCode', val)}
          placeholder="HDFC0001234"
          required
          error={hasErr('ifscCode')}
          uppercase
        />
        <div className="sm:col-span-2">
          <InputField
            label="Branch Name"
            value={v.branchName ?? ''}
            onChange={(val) => patch('branchName', val)}
            placeholder="Optional — e.g. Anna Nagar Branch"
          />
        </div>
      </div>
    </div>
  );
}
