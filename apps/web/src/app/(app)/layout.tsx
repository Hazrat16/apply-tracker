import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { UserMenu } from '@/features/auth/components/user-menu';
import { VerifyEmailBanner } from '@/features/auth/components/verify-email-banner';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <VerifyEmailBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
