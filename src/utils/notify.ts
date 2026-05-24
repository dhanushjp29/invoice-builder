/**
 * App-wide notification helpers.
 *
 * Wraps react-hot-toast so every notification:
 *   - Renders with the same default white-card styling (no per-toast color
 *     overrides — colors come from the icon, not the background).
 *   - Has consistent durations across the app.
 *   - Supports more variants than success/error: info, warning, loading, promise.
 *
 * Usage:
 *   import { notify } from '../utils/notify';
 *   notify.success('Invoice saved!');
 *   notify.error('Save failed.');
 *   notify.info('Auto-saved your changes.');
 *   notify.warning('This file is large.');
 *   const id = notify.loading('Sending email…');
 *   notify.dismiss(id);
 *   notify.promise(asyncOp, { loading: 'Saving…', success: 'Saved', error: 'Failed' });
 */

import { createElement } from 'react';
import toast from 'react-hot-toast';
import UploadToast from '../components/UploadToast';

const DEFAULT_DURATION = 2800;
const ERROR_DURATION = 4000; // give the user more time to read errors
const WARNING_DURATION = 3500;

export const notify = {
  success(message: string) {
    return toast.success(message, { duration: DEFAULT_DURATION });
  },

  error(message: string) {
    return toast.error(message, { duration: ERROR_DURATION });
  },

  /** Neutral informational toast — blue dot icon, no success/error styling. */
  info(message: string) {
    return toast(message, {
      duration: DEFAULT_DURATION,
      icon: 'ℹ️',
    });
  },

  /** Soft alert for non-blocking issues. */
  warning(message: string) {
    return toast(message, {
      duration: WARNING_DURATION,
      icon: '⚠️',
    });
  },

  /** Returns an id; pass it to `notify.dismiss(id)` when the work finishes. */
  loading(message: string) {
    return toast.loading(message);
  },

  /** Wrap an async operation; the toast flips loading → success/error. */
  promise<T>(
    p: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ) {
    return toast.promise(p, messages, {
      success: { duration: DEFAULT_DURATION },
      error: { duration: ERROR_DURATION },
    });
  },

  dismiss(id?: string) {
    toast.dismiss(id);
  },

  /**
   * Toast with a Tailwind progress bar that animates while `work` is running,
   * then flips to success / error when it settles. Designed for per-file
   * uploads — pass the file name and the upload promise.
   */
  upload(fileName: string, work: Promise<unknown>) {
    return toast.custom(
      (t) => createElement(UploadToast, { t, fileName, work }),
      { duration: Infinity },
    );
  },
};
