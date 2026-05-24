import { motion } from 'framer-motion';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const flowStages = [
  {
    title: 'Request',
    description: 'Email capture and OTP issue response will be added next.',
  },
  {
    title: 'Resend',
    description: 'Resend controls will sit here once the flow is wired.',
  },
  {
    title: 'Verify',
    description: 'Code entry and verification result states are reserved.',
  },
];

const statusItems = [
  { label: 'API base', value: apiBaseUrl },
  { label: 'Delivery mode', value: 'Configured by the API' },
  { label: 'Frontend state', value: 'Shell only' },
];

function App() {
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
          <div className="flex w-full max-w-sm items-center justify-between rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm sm:w-auto sm:min-w-64">
            <span className="text-muted">Environment</span>
            <span className="font-medium text-ink">Local scaffold</span>
          </div>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <motion.div
            className="rounded-lg border border-line bg-white p-5 shadow-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="flex flex-col gap-2 border-b border-line pb-4">
              <p className="text-sm font-medium text-muted">Step 12 foundation</p>
              <h2 className="text-xl font-semibold text-ink">OTP flow workspace</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                This shell reserves the request, resend, and verify regions for the next
                implementation step without adding frontend OTP logic.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {flowStages.map((stage, index) => (
                <div
                  key={stage.title}
                  className="min-h-44 rounded-md border border-line bg-panel p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-signal ring-1 ring-line">
                    {index + 1}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{stage.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <aside className="rounded-lg border border-line bg-white p-5 shadow-shell">
            <div className="border-b border-line pb-4">
              <h2 className="text-lg font-semibold text-ink">Runtime context</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Static details for the scaffold. Live API state and demo inbox data are deferred to
                the OTP interface task.
              </p>
            </div>

            <dl className="mt-5 space-y-4">
              {statusItems.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-semibold uppercase text-muted">{item.label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default App;
