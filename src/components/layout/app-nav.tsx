"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; available: boolean };

// Items become available as each phase ships.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", available: true },
  { href: "/calendar", label: "Calendar", available: true },
  { href: "/appointments", label: "Appointments", available: true },
  { href: "/clients", label: "Clients", available: true },
  { href: "/reminders", label: "Reminders", available: true },
  {
    href: "/notifications",
    label: "Notification history",
    available: true,
  },
  { href: "/billing", label: "Plans & billing", available: true },
  { href: "/settings", label: "Settings", available: false },
];

type NavProps = { onNavigate?: () => void };

export function AppNav({ onNavigate }: NavProps) {
  // The pathname is only known at request time on dynamic routes such as
  // /clients/[id]; until then the menu renders without a highlighted item.
  return (
    <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} />}>
      <CurrentNavList onNavigate={onNavigate} />
    </Suspense>
  );
}

function CurrentNavList({ onNavigate }: NavProps) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({
  pathname,
  onNavigate,
}: NavProps & { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname !== null &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`));
        if (!item.available) {
          return (
            <span
              key={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-400 dark:text-zinc-600"
              aria-disabled="true"
            >
              {item.label}
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
