import { useEffect, useState } from 'react';
import toast, { type Toast } from 'react-hot-toast';

interface Props {
  t: Toast;
  fileName: string;
  /** Reports the completion of the underlying work. Resolves on success, rejects on failure. */
  work: Promise<unknown>;
}

/**
 * Toast body with a Tailwind progress bar that animates while `work` is pending,
 * then flips to a success (or error) state once it settles.
 *
 * The bar uses an indeterminate-style ease to reach ~90% while waiting, then
 * snaps to 100% on resolve so the user always sees the bar fill before the
 * toast dismisses.
 */
export default function UploadToast({ t, fileName, work }: Props) {
  const [progress, setProgress] = useState(8);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    const tick = setInterval(() => {
      if (cancelled) return;
      setProgress((p) => (p >= 90 ? p : p + Math.max(1, (90 - p) * 0.08)));
    }, 120);

    work
      .then(() => {
        if (cancelled) return;
        setProgress(100);
        setState('success');
        setTimeout(() => toast.dismiss(t.id), 1400);
      })
      .catch(() => {
        if (cancelled) return;
        setState('error');
        setTimeout(() => toast.dismiss(t.id), 2200);
      });

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [t.id, work]);

  const barColor =
    state === 'success' ? 'bg-emerald-500'
    : state === 'error' ? 'bg-red-500'
    : 'bg-blue-500';

  const label =
    state === 'success' ? 'Upload complete'
    : state === 'error' ? 'Upload failed'
    : 'Uploading…';

  return (
    <div
      className={`${t.visible ? 'animate-enter' : 'animate-leave'} w-80 bg-white rounded-xl border border-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.08)] px-4 py-3`}
    >
      <div className="flex items-center gap-2 mb-2">
        {state === 'success' ? (
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : state === 'error' ? (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        <span className="text-[13px] font-semibold text-slate-800">{label}</span>
        <span className="ml-auto text-[11px] font-medium text-slate-400 tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      <p className="text-[12px] text-slate-500 truncate mb-2" title={fileName}>{fileName}</p>

      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-[width] duration-200 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
