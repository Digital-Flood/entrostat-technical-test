import { AnimatePresence, motion } from 'framer-motion';
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

type IconName = 'check' | 'clock' | 'inbox' | 'refresh' | 'send' | 'shield' | 'spark' | 'x';

const OTP_LENGTH = 6;

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const validationIssues = notice?.tone === 'error' ? notice.validationIssues : undefined;
  const emailIssue = validationIssues?.find((issue) => issue.field === 'email')?.message;
  const codeIssue = validationIssues?.find((issue) => issue.field === 'code')?.message;
  const currentEmail = metadata?.email ?? verification?.email ?? email.trim();
  const resendCount = metadata && 'resendCount' in metadata ? metadata.resendCount : 0;
  const isBusy = pendingAction !== null;
  const normalisedCode = normaliseOtp(code);

  const flowState = useMemo(() => {
    if (verification) {
      return 'Verified';
    }

    if (metadata) {
      return 'OTP issued';
    }

    return 'Ready';
  }, [metadata, verification]);

  const deliveryState = metadata
    ? `${metadata.delivery.mode} / ${metadata.delivery.status}`
    : inboxUnavailable
      ? 'Production'
      : 'Demo ready';

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
        message: 'A fresh code has been issued. Use the demo drawer in local mode.',
        title: 'OTP requested',
        tone: 'success',
      });
      await refreshInbox();
      otpInputRefs.current[0]?.focus();
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
        message: 'The previous active code has been replaced.',
        title: 'OTP resent',
        tone: 'success',
      });
      await refreshInbox();
      otpInputRefs.current[0]?.focus();
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
      const result = await verifyOtp({ code: normalisedCode, email });

      if (!result.body.ok) {
        setNotice(createErrorNotice(result.body.error));
        return;
      }

      setVerification(result.body.data);
      setNotice({
        message: 'The latest code has been verified and cannot be reused.',
        title: 'Verification complete',
        tone: 'success',
      });
    } catch {
      setNotice(createNetworkNotice());
    } finally {
      setPendingAction(null);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const digits = normaliseOtp(value);

    if (!digits) {
      setCode(replaceCodeAt(normalisedCode, index, ''));
      return;
    }

    const nextCode = applyDigitsAtIndex(normalisedCode, index, digits);
    setCode(nextCode);

    const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
    otpInputRefs.current[nextIndex]?.focus();
  }

  function handleOtpPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pastedCode = normaliseOtp(event.clipboardData.getData('text'));

    if (!pastedCode) {
      return;
    }

    event.preventDefault();
    const nextCode = applyDigitsAtIndex(normalisedCode, index, pastedCode);
    setCode(nextCode);

    const nextIndex = Math.min(index + pastedCode.length, OTP_LENGTH - 1);
    otpInputRefs.current[nextIndex]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }

    if (event.key === 'Backspace' && !normalisedCode[index] && index > 0) {
      event.preventDefault();
      setCode(replaceCodeAt(normalisedCode, index - 1, ''));
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-text-primary">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.2),transparent_32rem),radial-gradient(circle_at_80%_18%,rgba(56,189,248,0.11),transparent_28rem),linear-gradient(180deg,#0B1220_0%,#0F172A_52%,#080E1A_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-soft-blue/50 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 py-5 sm:px-6 lg:px-8">
        <header className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-lg font-medium uppercase tracking-wide text-text-secondary shadow-panel">
              <Icon name="shield" className="h-8 w-8 text-soft-blue" />
              <span className="text-white">OTP Guard</span>
            </div>
          </div>
        </header>

        <section className="relative py-3">
          <div className="mx-auto grid max-w-5xl content-start gap-6 xl:grid-cols-2">
            <motion.section
              aria-labelledby="request-heading"
              className="rounded-3xl bg-[linear-gradient(145deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92)_58%,rgba(17,24,39,0.96))] p-5 shadow-card backdrop-blur-xl sm:p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <PanelHeading eyebrow="Request" icon="send" title="Issue an OTP" />

              <form className="mt-6 space-y-5" onSubmit={handleRequestOtp}>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                    Email address
                  </span>
                  <input
                    autoComplete="email"
                    className="mt-2 h-12 w-full rounded-[11px] border border-input-border bg-input px-4 text-base text-text-primary shadow-input outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-text-muted focus:border-input-focus focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={isBusy}
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="person@example.com"
                    type="email"
                    value={email}
                  />
                  {emailIssue ? (
                    <span className="mt-2 block text-sm text-error">{emailIssue}</span>
                  ) : null}
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-blue px-4 text-sm font-semibold text-white shadow-action transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
                    disabled={isBusy || email.trim().length === 0}
                    type="submit"
                  >
                    <Icon name="send" className="h-4 w-4" />
                    {pendingAction === 'request' ? 'Requesting' : 'Request OTP'}
                  </button>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised/50 px-4 text-sm font-semibold text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={isBusy || email.trim().length === 0}
                    onClick={handleResendOtp}
                    type="button"
                  >
                    <Icon name="refresh" className="h-4 w-4" />
                    {pendingAction === 'resend' ? 'Resending' : 'Resend OTP'}
                  </button>
                </div>
              </form>

              <StatusNotice notice={notice} />
            </motion.section>

            <motion.section
              aria-labelledby="verify-heading"
              className="rounded-3xl bg-[linear-gradient(145deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92)_58%,rgba(17,24,39,0.96))] p-5 shadow-card backdrop-blur-xl sm:p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.04, ease: 'easeOut' }}
            >
              <PanelHeading eyebrow="Verify" icon="check" title="Submit a code" />

              <form className="mt-6 space-y-5" onSubmit={handleVerifyOtp}>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                    OTP code
                  </span>
                  <div
                    aria-label="OTP code"
                    className="mt-2 grid grid-cols-6 gap-2 sm:gap-3"
                    role="group"
                  >
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                      <input
                        aria-label={`OTP digit ${index + 1}`}
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        className="aspect-square min-h-12 w-full rounded-[11px] border border-input-border bg-input-strong text-center text-xl font-semibold text-text-primary shadow-input outline-none transition-[border-color,box-shadow,background-color] duration-150 caret-soft-blue placeholder:text-text-muted focus:border-input-focus focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-14"
                        disabled={isBusy}
                        inputMode="numeric"
                        key={index}
                        maxLength={1}
                        onChange={(event) => handleOtpInput(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        onPaste={(event) => handleOtpPaste(index, event)}
                        pattern="[0-9]*"
                        ref={(element) => {
                          otpInputRefs.current[index] = element;
                        }}
                        type="text"
                        value={normalisedCode[index] ?? ''}
                      />
                    ))}
                  </div>
                  {codeIssue ? (
                    <span className="mt-2 block text-sm text-error">{codeIssue}</span>
                  ) : null}
                </div>

                <button
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-blue px-4 text-sm font-semibold text-white shadow-action transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none sm:w-auto"
                  disabled={isBusy || email.trim().length === 0 || normalisedCode.length === 0}
                  type="submit"
                >
                  <Icon name="check" className="h-4 w-4" />
                  {pendingAction === 'verify' ? 'Verifying' : 'Verify OTP'}
                </button>
              </form>
            </motion.section>
          </div>
        </section>
      </div>

      <DemoDrawer
        apiBaseUrl={apiBaseUrl}
        deliveryState={deliveryState}
        flowState={flowState}
        inbox={inbox}
        inboxError={inboxError}
        inboxLoading={inboxLoading}
        inboxUnavailable={inboxUnavailable}
        isOpen={isDrawerOpen}
        metadata={{
          delivery: metadata ? deliveryState : 'Not sent',
          email: currentEmail || 'Not set',
          expiry: metadata ? formatDate(metadata.expiresAt) : 'Not issued',
          resends: String(resendCount),
          verified: verification ? formatDate(verification.verifiedAt) : 'Not verified',
        }}
        onClose={() => setIsDrawerOpen(false)}
        onOpen={() => setIsDrawerOpen(true)}
        onRefresh={() => void refreshInbox()}
      />
    </main>
  );
}

function DemoDrawer({
  apiBaseUrl,
  deliveryState,
  flowState,
  inbox,
  inboxError,
  inboxLoading,
  inboxUnavailable,
  isOpen,
  metadata,
  onClose,
  onOpen,
  onRefresh,
}: {
  apiBaseUrl: string;
  deliveryState: string;
  flowState: string;
  inbox: DevOtpInboxData | null;
  inboxError: string | null;
  inboxLoading: boolean;
  inboxUnavailable: boolean;
  isOpen: boolean;
  metadata: {
    delivery: string;
    email: string;
    expiry: string;
    resends: string;
    verified: string;
  };
  onClose: () => void;
  onOpen: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      {!isOpen ? (
        <button
          aria-controls="demo-drawer"
          aria-expanded={false}
          className="fixed right-4 top-4 z-40 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised/90 px-4 text-sm font-semibold text-text-primary shadow-panel backdrop-blur-xl transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98] sm:right-6 sm:top-6"
          onClick={onOpen}
          type="button"
        >
          <Icon name="inbox" className="h-4 w-4 text-soft-blue" />
          Demo inbox
        </button>
      ) : null}

      <AnimatePresence initial={false}>
        {isOpen ? (
          <>
            <motion.button
              aria-label="Close demo drawer backdrop"
              className="fixed inset-0 z-40 bg-background/20 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              type="button"
            />
            <motion.aside
              aria-labelledby="inbox-heading"
              animate={{ x: 0 }}
              className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border-subtle bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,14,26,0.98))] shadow-drawer backdrop-blur-xl"
              exit={{ x: '100%' }}
              id="demo-drawer"
              initial={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-5 sm:p-6">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-soft-blue">
                    <Icon name="inbox" className="h-4 w-4" />
                    Demo drawer
                  </div>
                  <h2 id="inbox-heading" className="mt-2 text-xl font-medium text-text-primary">
                    OTP inbox
                  </h2>
                </div>
                <button
                  aria-label="Close demo drawer"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-raised/60 text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98]"
                  onClick={onClose}
                  type="button"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
                <dl className="grid gap-3">
                  <HeaderMetric label="Flow" value={flowState} />
                  <HeaderMetric label="Delivery" value={deliveryState} />
                  <HeaderMetric label="API" title={apiBaseUrl} value={apiBaseUrl} />
                </dl>

                <section aria-labelledby="session-heading" className="space-y-3 pt-2">
                  <h3
                    id="session-heading"
                    className="text-xs font-medium uppercase tracking-wide text-text-muted"
                  >
                    Session details
                  </h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <MetadataItem label="Email" value={metadata.email} />
                    <MetadataItem label="Expiry" value={metadata.expiry} />
                    <MetadataItem label="Resends" value={metadata.resends} />
                    <MetadataItem label="Delivery" value={metadata.delivery} />
                    <MetadataItem label="Verified" value={metadata.verified} />
                  </dl>
                </section>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Demo deliveries
                  </p>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised/50 px-3 text-sm font-semibold text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={inboxLoading}
                    onClick={onRefresh}
                    type="button"
                  >
                    <Icon name="refresh" className="h-4 w-4" />
                    {inboxLoading ? 'Loading' : 'Refresh'}
                  </button>
                </div>

                {inboxUnavailable ? (
                  <DrawerState tone="info" message="Demo inbox is hidden for this API mode." />
                ) : null}
                {inboxError ? <DrawerState tone="error" message={inboxError} /> : null}

                <AnimatePresence initial={false}>
                  {inbox?.deliveries.length ? (
                    <motion.ol
                      animate={{ opacity: 1 }}
                      className="space-y-3"
                      exit={{ opacity: 0 }}
                      initial={{ opacity: 0 }}
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
                  <DrawerState tone="info" message="No demo deliveries yet." />
                ) : null}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function HeaderMetric({ label, title, value }: { label: string; title?: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-glass px-4 py-3 shadow-panel backdrop-blur-xl">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-text-primary" title={title ?? value}>
        {value}
      </dd>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  icon,
  title,
}: {
  eyebrow: string;
  icon: IconName;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-surface-raised text-soft-blue shadow-panel">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{eyebrow}</p>
        <h2 id={`${eyebrow.toLowerCase()}-heading`} className="text-xl font-medium">
          {title}
        </h2>
      </div>
    </div>
  );
}

function StatusNotice({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null;
  }

  const styles =
    notice.tone === 'success'
      ? 'border-success/30 bg-success/10 text-emerald-100'
      : notice.tone === 'error'
        ? 'border-error/35 bg-error/10 text-red-100'
        : 'border-border-subtle bg-surface-raised/60 text-text-primary';

  return (
    <motion.div
      className={`mt-6 rounded-2xl border px-4 py-3 text-sm shadow-panel ${styles}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <p className="font-semibold">{notice.title}</p>
      <p className="mt-1 leading-6 text-text-secondary">{notice.message}</p>
      {notice.validationIssues?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-text-secondary">
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
    <div className="rounded-2xl border border-border-subtle bg-surface-raised/50 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}

function DrawerState({ message, tone }: { message: string; tone: 'error' | 'info' }) {
  const styles =
    tone === 'error'
      ? 'border-error/35 bg-error/10 text-red-100'
      : 'border-border-subtle bg-surface-raised/50 text-text-secondary';

  return <p className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${styles}`}>{message}</p>;
}

function InboxDelivery({ delivery }: { delivery: DevOtpInboxDelivery }) {
  return (
    <li className="rounded-2xl border border-border-subtle bg-surface-raised/50 p-4 transition hover:border-border-active/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all text-sm font-semibold text-text-primary">{delivery.email}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
            <Icon
              name={delivery.issueReason === 'RESEND' ? 'refresh' : 'spark'}
              className="h-3.5 w-3.5"
            />
            {delivery.issueReason.toLowerCase()}
          </p>
        </div>
        <code className="rounded-xl border border-border-active/50 bg-input px-3 py-2 text-base font-semibold tracking-[0.18em] text-text-primary shadow-focus">
          {delivery.code}
        </code>
      </div>
      <dl className="mt-4 grid gap-2 text-xs text-text-muted">
        <div className="flex justify-between gap-3">
          <dt className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="h-3.5 w-3.5" />
            Delivered
          </dt>
          <dd className="text-right text-text-secondary">{formatDate(delivery.deliveredAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Expires</dt>
          <dd className="text-right text-text-secondary">{formatDate(delivery.expiresAt)}</dd>
        </div>
      </dl>
    </li>
  );
}

function Icon({ className = 'h-5 w-5', name }: { className?: string; name: IconName }) {
  const paths: Record<IconName, ReactElement> = {
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    inbox: (
      <>
        <path d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
        <path d="m7 10 5 5 5-5" />
        <path d="M12 15V3" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 1-14.7 7" />
        <path d="M3 12a9 9 0 0 1 14.7-7" />
        <path d="M17 1v4h-4" />
        <path d="M7 23v-4h4" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3v5" />
        <path d="M12 16v5" />
        <path d="M3 12h5" />
        <path d="M16 12h5" />
        <path d="m5.6 5.6 3.5 3.5" />
        <path d="m14.9 14.9 3.5 3.5" />
        <path d="m18.4 5.6-3.5 3.5" />
        <path d="m9.1 14.9-3.5 3.5" />
      </>
    ),
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
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

function normaliseOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

function replaceCodeAt(code: string, index: number, digit: string): string {
  const nextCode = code.split('');
  nextCode[index] = digit;

  return normaliseOtp(nextCode.join(''));
}

function applyDigitsAtIndex(code: string, index: number, digits: string): string {
  const nextCode = code.padEnd(OTP_LENGTH, ' ').split('');

  for (let offset = 0; offset < digits.length && index + offset < OTP_LENGTH; offset += 1) {
    nextCode[index + offset] = digits[offset] ?? '';
  }

  return normaliseOtp(nextCode.join(''));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

export default App;
