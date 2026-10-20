import type { ReactNode } from "react";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { AppNav } from "@/components/layout/app-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { requireBusinessContext } from "@/features/business/queries";

async function AccountMenu() {
  const { business, fullName, email } = await requireBusinessContext();
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {business.name}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {fullName || email}
        </p>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary" className="px-3 py-2">
          Sign out
        </Button>
      </form>
    </div>
  );
}

async function AuthorizedContent({ children }: { children: ReactNode }) {
  // Redirects to /login or /onboarding before any page content renders.
  await requireBusinessContext();
  return children;
}

function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading">
      <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white px-4 py-5 lg:block dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 px-2">
          <Logo href="/dashboard" />
        </div>
        <AppNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <MobileNav />
            <div className="lg:hidden">
              <Logo href="/dashboard" />
            </div>
          </div>
          <Suspense
            fallback={
              <div className="h-9 w-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            }
          >
            <AccountMenu />
          </Suspense>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Suspense fallback={<ContentSkeleton />}>
            <AuthorizedContent>{children}</AuthorizedContent>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
