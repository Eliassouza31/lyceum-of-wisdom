// Temporary home page for Phase 2. The full marketing landing page is built in Phase 10.
const highlights = [
  {
    title: "Automatic reminders",
    description:
      "Email reminders go out on schedule, even when your computer is off.",
  },
  {
    title: "Fewer no-shows",
    description: "Clients get a friendly nudge before every appointment.",
  },
  {
    title: "Private by design",
    description: "Every business gets its own isolated, secure workspace.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 sm:px-6">
      <div className="w-full max-w-3xl text-center">
        <span className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Coming soon
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Appointment reminders that run themselves
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
          Schedule appointments, and we remind your clients automatically, so
          your calendar stays full.
        </p>
        <ul className="mt-12 grid gap-4 text-left sm:grid-cols-3">
          {highlights.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <h2 className="font-medium">{item.title}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
