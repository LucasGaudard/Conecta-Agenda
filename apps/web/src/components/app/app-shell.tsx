"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { getOnboardingStatus } from "@/lib/onboarding";

import { Header } from "./header";
import { appNavItems } from "./nav-items";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  requireOnboardingComplete?: boolean;
};

function getPageTitle(pathname: string) {
  return appNavItems.find((item) => item.href === pathname)?.title ?? "Conecta Agenda";
}

export function AppShell({
  children,
  title,
  requireOnboardingComplete = true,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { business, isAuthenticated, loading, logout, token, user } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(requireOnboardingComplete);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!requireOnboardingComplete) {
      setCheckingOnboarding(false);
      return;
    }

    if (loading || !isAuthenticated || !token) {
      return;
    }

    setCheckingOnboarding(true);

    getOnboardingStatus(token)
      .then((status) => {
        if (!status.completed) {
          router.replace("/onboarding");
        }
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          router.replace("/login");
        }
      })
      .finally(() => {
        setCheckingOnboarding(false);
      });
  }, [isAuthenticated, loading, logout, requireOnboardingComplete, router, token]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || checkingOnboarding || !isAuthenticated || !user || !business) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar pathname={pathname} />
      <div className="min-w-0 flex-1">
        <Header
          businessName={business.name}
          pageTitle={title ?? getPageTitle(pathname)}
          pathname={pathname}
          userName={user.name}
          onLogout={handleLogout}
        />
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
