import { AnimatePresence, motion } from 'framer-motion';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { apiBaseUrl, fetchDemoInbox, requestOtp, resendOtp, verifyOtp } from './api/otp-api';
import type { ApiErrorBody, ValidationIssue } from './types/api';
import type {
  DevOtpInboxData,
  DevOtpInboxDelivery,
  OtpRequestData,
  OtpResendData,
  OtpVerifyData,
} from './types/otp';

type PendingAction = 'request' | 'resend' | 'verify';

type Notice = {
  message: string;
  title: string;
  tone: 'error' | 'info' | 'success';
  validationIssues?: ValidationIssue[];
};

type OtpMetadata = OtpRequestData | OtpResendData;

const errorTitles: Record<string, string> = {
  NOT_FOUND: 'Not found',
  OTP_EXPIRED: 'OTP expired',
  OTP_INCORRECT: 'Incorrect code',
  OTP_MISSING: 'No OTP found',
  OTP_RATE_LIMITED: 'Request limit reached',
  OTP_RESEND_LIMITED: 'Resend limit reached',
  OTP_REUSED: 'OTP already used',
  OTP_SUPERSEDED: 'OTP superseded',
  VALIDATION_ERROR: 'Check the form',
};

function App() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [metadata, setMetadata] = useState<OtpMetadata | null>(null);
  const [verification, setVerification] = useState<OtpVerifyData | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [inbox, setInbox] = useState<DevOtpInboxData | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxUnavailable, setInboxUnavailable] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const validationIssues = notice?.tone === 'error' ? notice.validationIssues : undefined;
  const emailIssue = validationIssues?.find((issue) => issue.field === 'email')?.message;
  const codeIssue = validationIssues?.find((issue) => issue.field === 'code')?.message;
  const currentEmail = metadata?.email ?? verification?.email ?? email.trim();
  const resendCount = metadata && 'resendCount' in metadata ? metadata.resendCount : 0;
  const isBusy = pendingAction !== null;

  const flowState = useMemo(() => {
    if (verification) {
      return 'Verified';
    }

    if (metadata) {
      return 'OTP issued';
    }

    return 'Ready';
  }, [metadata, verification]);

  useEffect(() => {
    void refreshInbox();
  }, []);

  async function refreshInbox() {
    setInboxLoading(true);
    setInboxError(null);

    try {
      const result = await fetchDemoInbox();

      if (result.body.ok) {
        setInbox(result.body.data);
        setInboxUnavailable(false);
        return;
      }

      if (result.status === 404) {
        setInbox(null);
        setInboxUnavailable(true);
        return;
      }

      setInboxError(result.body.error.message);
    } catch {
      setInboxError('Demo inbox could not be reached.');
    } finally {
      setInboxLoading(false);
    }
  }

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction('request');
    setNotice(null);

    try {
      const result = await requestOtp({ email });

      if (!result.body.ok) {
        setNotice(createErrorNotice(result.body.error));
        return;
      }

      setMetadata(result.body.data);
      setVerification(null);
      setCode('');
      setEmail(result.body.data.email);
      setNotice({
        message: 'A new OTP has been issued. Use the demo inbox in local demo mode.',
        title: 'OTP requested',
        tone: 'success',
      });
      await refreshInbox();
    } catch {
      setNotice(createNetworkNotice());
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResendOtp() {
    setPendingAction('resend');
    setNotice(null);

    try {
      const result = await resendOtp({ email });

      if (!result.body.ok) {
        setNotice(createErrorNotice(result.body.error));
        return;
      }

      setMetadata(result.body.data);
      setVerification(null);
      setCode('');
      setEmail(result.body.data.email);
      setNotice({
        message: 'The previous active OTP has been replaced with a new one.',
        title: 'OTP resent',
        tone: 'success',
      });
      await refreshInbox();
    } catch {
      setNotice(createNetworkNotice());
    } finally {
      setPendingAction(null);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction('verify');
    setNotice(null);

    try {
      const result = await verifyOtp({ code, email });

      if (!result.body.ok) {
        setNotice(createErrorNotice(result.body.error));
        return;
      }

      setVerification(result.body.data);
      setNotice({
        message: 'The latest OTP has been verified and cannot be reused.',
        title: 'Verification complete',
        tone: 'success',
      });
    } catch {
      setNotice(createNetworkNotice());
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-panel text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-signal">Entrostat OTP</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink sm:text-3xl">
              Verification console
            </h1>
          </div>
          <dl className="grid gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm sm:min-w-72 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Flow</dt>
              <dd className="mt-1 font-medium text-ink">{flowState}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">API</dt>
              <dd className="mt-1 truncate font-medium text-ink" title={apiBaseUrl}>
                {apiBaseUrl}
              </dd>
            </div>
          </dl>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <motion.div
            className="rounded-lg border border-line bg-white p-4 shadow-shell sm:p-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
              <section aria-labelledby="request-heading">
                <div className="border-b border-line pb-4">
                  <p className="text-sm font-medium text-muted">Request</p>
                  <h2 id="request-heading" className="mt-1 text-xl font-semibold text-ink">
                    Issue an OTP
                  </h2>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleRequestOtp}>
                  <label className="block">
                    <span className="text-sm font-medium text-ink">Email address</span>
                    <input
                      className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-base text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20 disabled:bg-panel"
                      disabled={isBusy}
                      inputMode="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="person@example.com"
                      type="email"
                      value={email}
                    />
                    {emailIssue ? (
                      <span className="mt-2 block text-sm text-red-700">{emailIssue}</span>
                    ) : null}
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:bg-muted"
                      disabled={isBusy || email.trim().length === 0}
                      type="submit"
                    >
                      {pendingAction === 'request' ? 'Requesting' : 'Request OTP'}
                    </button>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-signal disabled:cursor-not-allowed disabled:bg-panel disabled:text-muted"
                      disabled={isBusy || email.trim().length === 0}
                      onClick={handleResendOtp}
                      type="button"
                    >
                      {pendingAction === 'resend' ? 'Resending' : 'Resend OTP'}
                    </button>
                  </div>
                </form>

                <StatusNotice notice={notice} />
              </section>

              <section aria-labelledby="verify-heading">
                <div className="border-b border-line pb-4">
                  <p className="text-sm font-medium text-muted">Verify</p>
                  <h2 id="verify-heading" className="mt-1 text-xl font-semibold text-ink">
                    Submit a code
                  </h2>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleVerifyOtp}>
                  <label className="block">
                    <span className="text-sm font-medium text-ink">OTP code</span>
                    <input
                      className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-base tracking-normal text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20 disabled:bg-panel"
                      disabled={isBusy}
                      inputMode="numeric"
                      maxLength={12}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="Enter code"
                      value={code}
                    />
                    {codeIssue ? (
                      <span className="mt-2 block text-sm text-red-700">{codeIssue}</span>
                    ) : null}
                  </label>

                  <button
                    className="inline-flex h-10 w-full items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-muted sm:w-auto"
                    disabled={isBusy || email.trim().length === 0 || code.trim().length === 0}
                    type="submit"
                  >
                    {pendingAction === 'verify' ? 'Verifying' : 'Verify OTP'}
                  </button>
                </form>

                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MetadataItem label="Email" value={currentEmail || 'Not set'} />
                  <MetadataItem
                    label="Expiry"
                    value={metadata ? formatDate(metadata.expiresAt) : 'Not issued'}
                  />
                  <MetadataItem label="Resends" value={String(resendCount)} />
                  <MetadataItem
                    label="Delivery"
                    value={
                      metadata
                        ? `${metadata.delivery.mode} / ${metadata.delivery.status}`
                        : 'Not sent'
                    }
                  />
                  <MetadataItem
                    label="Verified"
                    value={verification ? formatDate(verification.verifiedAt) : 'Not verified'}
                  />
                </dl>
              </section>
            </div>
          </motion.div>

          <aside className="rounded-lg border border-line bg-white p-4 shadow-shell sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-sm font-medium text-muted">Demo mode</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">OTP inbox</h2>
              </div>
              <button
                className="inline-flex h-9 items-center rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-signal disabled:cursor-not-allowed disabled:bg-panel disabled:text-muted"
                disabled={inboxLoading}
                onClick={() => void refreshInbox()}
                type="button"
              >
                {inboxLoading ? 'Loading' : 'Refresh'}
              </button>
            </div>

            <div className="mt-4">
              {inboxUnavailable ? (
                <p className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">
                  Demo inbox is hidden for this API mode.
                </p>
              ) : null}
              {inboxError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {inboxError}
                </p>
              ) : null}

              <AnimatePresence initial={false}>
                {inbox?.deliveries.length ? (
                  <motion.ol
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {inbox.deliveries.map((delivery) => (
                      <InboxDelivery
                        key={`${delivery.otpRecordId}-${delivery.deliveredAt}`}
                        delivery={delivery}
                      />
                    ))}
                  </motion.ol>
                ) : null}
              </AnimatePresence>

              {!inboxUnavailable && !inboxError && inbox?.deliveries.length === 0 ? (
                <p className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">
                  No demo deliveries yet.
                </p>
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusNotice({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null;
  }

  const styles =
    notice.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : notice.tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-line bg-panel text-ink';

  return (
    <motion.div
      className={`mt-5 rounded-md border px-3 py-3 text-sm ${styles}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <p className="font-semibold">{notice.title}</p>
      <p className="mt-1 leading-6">{notice.message}</p>
      {notice.validationIssues?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {notice.validationIssues.map((issue) => (
            <li key={`${issue.field}-${issue.message}`}>
              {issue.field}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </motion.div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2">
      <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function InboxDelivery({ delivery }: { delivery: DevOtpInboxDelivery }) {
  return (
    <li className="rounded-md border border-line bg-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="break-all text-sm font-semibold text-ink">{delivery.email}</p>
          <p className="mt-1 text-xs font-medium uppercase text-muted">{delivery.issueReason}</p>
        </div>
        <code className="rounded-md border border-line bg-white px-2 py-1 text-base font-semibold tracking-normal text-ink">
          {delivery.code}
        </code>
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-muted">
        <div className="flex justify-between gap-3">
          <dt>Delivered</dt>
          <dd className="text-right text-ink">{formatDate(delivery.deliveredAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Expires</dt>
          <dd className="text-right text-ink">{formatDate(delivery.expiresAt)}</dd>
        </div>
      </dl>
    </li>
  );
}

function createErrorNotice(
  error: ApiErrorBody<ValidationIssue[] | Record<string, unknown>>,
): Notice {
  const validationIssues = Array.isArray(error.details)
    ? error.details.filter(isValidationIssue)
    : undefined;

  return {
    message: error.message,
    title: errorTitles[error.code] ?? error.code,
    tone: 'error',
    ...(validationIssues?.length ? { validationIssues } : {}),
  };
}

function createNetworkNotice(): Notice {
  return {
    message: 'The API could not be reached. Check the API server and VITE_API_BASE_URL.',
    title: 'Connection failed',
    tone: 'error',
  };
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    'message' in value &&
    typeof value.field === 'string' &&
    typeof value.message === 'string'
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

export default App;
