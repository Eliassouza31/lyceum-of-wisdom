import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

// Simple public home page. The full marketing landing page is built in Phase 10.
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
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className={buttonClasses("ghost", "whitespace-nowrap")}
          >
            Log in
          </Link>
          {/* On phones the hero buttons below already offer sign-up. */}
          <div className="hidden sm:block">
            <Link href="/signup" className={buttonClasses("primary")}>
              Start free trial
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 sm:px-6">
        <div className="w-full max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Appointment reminders that run themselves
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
            Schedule appointments, and we remind your clients automatically, so
            your calendar stays full.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={buttonClasses("primary", "w-full sm:w-auto")}
            >
              Create your free account
            </Link>
            <Link
              href="/login"
              className={buttonClasses("secondary", "w-full sm:w-auto")}
            >
              I already have an account
            </Link>
          </div>
          <ul className="mt-14 grid gap-4 text-left sm:grid-cols-3">
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
    </>
  );
}
