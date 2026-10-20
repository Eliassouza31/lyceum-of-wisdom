"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; available: boolean };

// Items become available as each phase ships.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", available: true },
  { href: "/calendar", label: "Calendar", available: false },
  { href: "/clients", label: "Clients", available: false },
  { href: "/reminders", label: "Reminders", available: false },
  { href: "/notifications", label: "Notification history", available: false },
  { href: "/billing", label: "Plans & billing", available: false },
  { href: "/settings", label: "Settings", available: false },
];

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
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
