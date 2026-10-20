import Link from "next/link";

export const PRODUCT_NAME = "ReminderApp";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </span>
      {PRODUCT_NAME}
    </Link>
  );
}
