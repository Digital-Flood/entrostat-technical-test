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

import {
  apiBaseUrl,
  fetchDemoInbox,
  fetchOtpSettings,
  requestOtp,
  resendOtp,
  updateOtpSettings,
  verifyOtp,
} from './api/otp-api';
import type { ApiErrorBody, ValidationIssue } from './types/api';
import type {
  DevOtpInboxData,
  DevOtpInboxDelivery,
  OtpRequestData,
  OtpResendData,
  OtpSettingsData,
  OtpVerifyData,
} from './types/otp';

type PendingAction = 'request' | 'resend' | 'verify';
type ViewPhase = 'request' | 'success' | 'verify';

type Notice = {
  message: string;
  title: string;
  tone: 'error' | 'info' | 'success';
  validationIssues?: ValidationIssue[];
};

type OtpMetadata = OtpRequestData | OtpResendData;
type OtpSettingsDraft = Record<
  'expirySeconds' | 'maxRequestsPerHour' | 'maxResends' | 'resendWindowMinutes',
  string
>;

type IconName =
  | 'arrowLeft'
  | 'check'
  | 'clock'
  | 'gear'
  | 'inbox'
  | 'refresh'
  | 'send'
  | 'shield'
  | 'spark'
  | 'x';

const OTP_LENGTH = 6;
const DEFAULT_OTP_SETTINGS: OtpSettingsData = {
  codeLength: OTP_LENGTH,
  expirySeconds: 30,
  maxRequestsPerHour: 3,
  maxResends: 3,
  resendWindowMinutes: 5,
};

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
  const [verifyEmail, setVerifyEmail] = useState('');
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<OtpSettingsData>(DEFAULT_OTP_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<OtpSettingsDraft>(
    createSettingsDraft(DEFAULT_OTP_SETTINGS),
  );
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [viewPhase, setViewPhase] = useState<ViewPhase>('request');
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const validationIssues = notice?.tone === 'error' ? notice.validationIssues : undefined;
  const emailIssue = validationIssues?.find((issue) => issue.field === 'email')?.message;
  const codeIssue = validationIssues?.find((issue) => issue.field === 'code')?.message;
  const currentEmail = verification?.email ?? metadata?.email ?? email.trim();
  const resendCount = metadata && 'resendCount' in metadata ? metadata.resendCount : 0;
  const isBusy = pendingAction !== null;
  const isVerifyPhase = viewPhase === 'verify';
  const isSuccessPhase = viewPhase === 'success';
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
    void refreshSettings();
  }, []);

  useEffect(() => {
    if (isVerifyPhase && !verification && pendingAction === null) {
      otpInputRefs.current[0]?.focus();
    }
  }, [isVerifyPhase, pendingAction, verification]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsDraft(createSettingsDraft(settings));
        setSettingsError(null);
        setIsSettingsOpen(false);
      }
    }

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSettingsOpen, settings]);

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

  async function refreshSettings() {
    setSettingsLoading(true);
    setSettingsError(null);

    try {
      const result = await fetchOtpSettings();

      if (!result.body.ok) {
        setSettingsError(result.body.error.message);
        return;
      }

      setSettings(result.body.data);
      setSettingsDraft(createSettingsDraft(result.body.data));
    } catch {
      setSettingsError('OTP settings could not be reached.');
    } finally {
      setSettingsLoading(false);
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
      setVerifyEmail(result.body.data.email);
      setViewPhase('verify');
      setNotice({
        message: 'A fresh code has been issued. Use the demo drawer in local mode.',
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
      setVerifyEmail(result.body.data.email);
      setViewPhase('verify');
      setNotice({
        message: 'The original active code has been resent with a fresh expiry.',
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
      const result = await verifyOtp({ code: normalisedCode, email: verifyEmail });

      if (!result.body.ok) {
        setNotice(createErrorNotice(result.body.error));
        return;
      }

      setVerification(result.body.data);
      setCode('');
      setViewPhase('success');
    } catch {
      setNotice(createNetworkNotice());
    } finally {
      setPendingAction(null);
    }
  }

  function returnToStart() {
    setEmail('');
    setVerifyEmail('');
    setCode('');
    setMetadata(null);
    setVerification(null);
    setNotice(null);
    setViewPhase('request');
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

  function openSettings() {
    setSettingsDraft(createSettingsDraft(settings));
    setSettingsError(null);
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsDraft(createSettingsDraft(settings));
    setSettingsError(null);
    setIsSettingsOpen(false);
  }

  function updateSettingsDraft(field: keyof OtpSettingsDraft, value: string) {
    setSettingsDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);

    const parsedSettings = parseSettingsDraft(settingsDraft);

    if (!parsedSettings) {
      setSettingsError('Enter positive whole numbers for every OTP rule.');
      setSettingsSaving(false);
      return;
    }

    try {
      const result = await updateOtpSettings(parsedSettings);

      if (!result.body.ok) {
        setSettingsError(result.body.error.message);
        return;
      }

      setSettings(result.body.data);
      setSettingsDraft(createSettingsDraft(result.body.data));
      setIsSettingsOpen(false);
      setNotice({
        message: 'New OTP rule settings will be used by the next request or resend.',
        title: 'Settings saved',
        tone: 'success',
      });
    } catch {
      setSettingsError('OTP settings could not be saved.');
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-text-primary">
      <div className="app-ambient-background pointer-events-none fixed inset-0" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-soft-blue/50 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 py-5 sm:px-6 lg:px-8">
        <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-lg font-medium uppercase tracking-wide text-text-secondary shadow-panel">
              <Icon name="shield" className="h-8 w-8 text-soft-blue" />
              <span className="text-white">OTP Guard</span>
            </div>
          </div>
          <button
            aria-haspopup="dialog"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised/60 px-4 text-sm font-semibold text-text-primary shadow-panel transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={settingsLoading}
            onClick={openSettings}
            type="button"
          >
            <Icon name="gear" className="h-4 w-4 text-soft-blue" />
            {settingsLoading ? 'Loading' : 'Settings'}
          </button>
        </header>

        <section className="relative py-3">
          <div className="mx-auto max-w-xl space-y-4">
            <AnimatePresence mode="wait" initial={false}>
              {viewPhase === 'request' ? (
                <motion.section
                  aria-labelledby="request-heading"
                  className="rounded-3xl bg-[linear-gradient(145deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92)_58%,rgba(17,24,39,0.96))] p-5 shadow-card backdrop-blur-xl sm:p-6"
                  key="request"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
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

                    <p className="text-sm text-text-secondary">
                      Already have an OTP?{' '}
                      <button
                        className="font-semibold text-soft-blue underline decoration-soft-blue/40 underline-offset-4 transition hover:text-info-blue hover:decoration-info-blue disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={isBusy}
                        onClick={() => {
                          setVerifyEmail('');
                          setViewPhase('verify');
                        }}
                        type="button"
                      >
                        Verify now
                      </button>
                    </p>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-blue px-4 text-sm font-semibold text-white shadow-action transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none sm:w-auto"
                        disabled={isBusy || email.trim().length === 0}
                        type="submit"
                      >
                        <Icon name="send" className="h-4 w-4" />
                        {pendingAction === 'request' ? 'Requesting' : 'Request OTP'}
                      </button>
                      <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised/50 px-4 text-sm font-semibold text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                        disabled={isBusy || email.trim().length === 0}
                        onClick={handleResendOtp}
                        type="button"
                      >
                        <Icon name="refresh" className="h-4 w-4" />
                        {pendingAction === 'resend' ? 'Resending' : 'Resend OTP'}
                      </button>
                    </div>
                  </form>
                </motion.section>
              ) : isSuccessPhase && verification ? (
                <motion.section
                  aria-labelledby="verified-heading"
                  className="rounded-3xl bg-[linear-gradient(145deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92)_58%,rgba(17,24,39,0.96))] p-5 shadow-card backdrop-blur-xl sm:p-6"
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <PanelHeading eyebrow="Verified" icon="shield" title="Verification successful" />

                  <div className="mt-6 rounded-2xl border border-success/30 bg-success/10 px-4 py-4 shadow-panel">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-success/30 bg-success/15 text-success">
                        <Icon name="check" className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-100">
                          The latest OTP for {verification.email} was verified and cannot be reused.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                          Verified at {formatDate(verification.verifiedAt)}.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised/50 px-4 text-sm font-semibold text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98]"
                    onClick={returnToStart}
                    type="button"
                  >
                    <Icon name="arrowLeft" className="h-4 w-4" />
                    Return to start
                  </button>
                </motion.section>
              ) : (
                <motion.section
                  aria-labelledby="verify-heading"
                  className="rounded-3xl bg-[linear-gradient(145deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92)_58%,rgba(17,24,39,0.96))] p-5 shadow-card backdrop-blur-xl sm:p-6"
                  key="verify"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <PanelHeading eyebrow="Verify" icon="check" title="Submit a code" />
                    <button
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised/50 px-3 text-sm font-semibold text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={isBusy}
                      onClick={() => setViewPhase('request')}
                      type="button"
                    >
                      <Icon name="arrowLeft" className="h-4 w-4" />
                      Back
                    </button>
                  </div>

                  <form className="mt-6 space-y-5" onSubmit={handleVerifyOtp}>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                        Email address
                      </span>
                      <input
                        autoComplete="email"
                        className="mt-2 h-12 w-full rounded-[11px] border border-input-border bg-input px-4 text-base text-text-primary shadow-input outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-text-muted focus:border-input-focus focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={isBusy}
                        inputMode="email"
                        onChange={(event) => setVerifyEmail(event.target.value)}
                        placeholder="person@example.com"
                        type="email"
                        value={verifyEmail}
                      />
                      {emailIssue ? (
                        <span className="mt-2 block text-sm text-error">{emailIssue}</span>
                      ) : null}
                    </label>

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
                      disabled={
                        isBusy || verifyEmail.trim().length === 0 || normalisedCode.length === 0
                      }
                      type="submit"
                    >
                      <Icon name="check" className="h-4 w-4" />
                      {pendingAction === 'verify' ? 'Verifying' : 'Verify OTP'}
                    </button>
                  </form>
                </motion.section>
              )}
            </AnimatePresence>

            <StatusNotice notice={notice} />
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

      <SettingsModal
        draft={settingsDraft}
        error={settingsError}
        isOpen={isSettingsOpen}
        isSaving={settingsSaving}
        onCancel={closeSettings}
        onChange={updateSettingsDraft}
        onSubmit={handleSaveSettings}
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
              className="fixed right-0 top-0 z-50 flex h-screen w-full flex-col border-l border-border-subtle bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,14,26,0.98))] shadow-drawer backdrop-blur-xl sm:w-[40rem] sm:max-w-[calc(100vw-2rem)] lg:w-[44rem]"
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

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-24 pt-5 sm:px-6 sm:pb-12 sm:pt-6">
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

function SettingsModal({
  draft,
  error,
  isOpen,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  draft: OtpSettingsDraft;
  error: string | null;
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof OtpSettingsDraft, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <>
          <motion.button
            aria-label="Close settings backdrop"
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            type="button"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            <motion.section
              aria-labelledby="settings-heading"
              aria-modal="true"
              className="w-full max-w-lg rounded-3xl border border-border-subtle bg-[linear-gradient(145deg,rgba(30,41,59,0.98),rgba(15,23,42,0.98)_58%,rgba(17,24,39,0.98))] p-5 shadow-drawer backdrop-blur-xl sm:p-6"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              role="dialog"
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-4">
                <PanelHeading eyebrow="Settings" icon="gear" title="OTP rules" />
                <button
                  aria-label="Close settings"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-raised/60 text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98]"
                  onClick={onCancel}
                  type="button"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>

              <form className="mt-6 space-y-5" onSubmit={onSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingsNumberInput
                    id="maxRequestsPerHour"
                    label="Maximum requests per hour"
                    onChange={(value) => onChange('maxRequestsPerHour', value)}
                    value={draft.maxRequestsPerHour}
                  />
                  <SettingsNumberInput
                    id="expirySeconds"
                    label="OTP expiry seconds"
                    onChange={(value) => onChange('expirySeconds', value)}
                    value={draft.expirySeconds}
                  />
                  <SettingsNumberInput
                    id="resendWindowMinutes"
                    label="Resend window minutes"
                    onChange={(value) => onChange('resendWindowMinutes', value)}
                    value={draft.resendWindowMinutes}
                  />
                  <SettingsNumberInput
                    id="maxResends"
                    label="Maximum resend count"
                    onChange={(value) => onChange('maxResends', value)}
                    value={draft.maxResends}
                  />
                </div>

                {error ? <DrawerState tone="error" message={error} /> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-raised/50 px-4 text-sm font-semibold text-text-primary transition hover:border-border-active hover:bg-surface-raised active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={isSaving}
                    onClick={onCancel}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-blue px-4 text-sm font-semibold text-white shadow-action transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
                    disabled={isSaving}
                    type="submit"
                  >
                    <Icon name="check" className="h-4 w-4" />
                    {isSaving ? 'Saving' : 'Save settings'}
                  </button>
                </div>
              </form>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function SettingsNumberInput({
  id,
  label,
  onChange,
  value,
}: {
  id: keyof OtpSettingsDraft;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      <input
        className="mt-2 h-12 w-full rounded-[11px] border border-input-border bg-input px-4 text-base text-text-primary shadow-input outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-text-muted focus:border-input-focus focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-55"
        id={id}
        inputMode="numeric"
        min={1}
        onChange={(event) => onChange(event.target.value)}
        required
        step={1}
        type="number"
        value={value}
      />
    </label>
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
      className={`rounded-2xl border px-4 py-3 text-sm shadow-panel ${styles}`}
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
    arrowLeft: (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
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

function createSettingsDraft(settings: OtpSettingsData): OtpSettingsDraft {
  return {
    expirySeconds: String(settings.expirySeconds),
    maxRequestsPerHour: String(settings.maxRequestsPerHour),
    maxResends: String(settings.maxResends),
    resendWindowMinutes: String(settings.resendWindowMinutes),
  };
}

function parseSettingsDraft(
  settings: OtpSettingsDraft,
): Omit<OtpSettingsData, 'codeLength'> | null {
  const parsedSettings = {
    expirySeconds: Number(settings.expirySeconds),
    maxRequestsPerHour: Number(settings.maxRequestsPerHour),
    maxResends: Number(settings.maxResends),
    resendWindowMinutes: Number(settings.resendWindowMinutes),
  };

  if (Object.values(parsedSettings).every((value) => Number.isInteger(value) && value > 0)) {
    return parsedSettings;
  }

  return null;
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
