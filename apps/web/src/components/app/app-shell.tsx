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
  const { access, business, isAuthenticated, loading, logout, token, user } = useAuth();
  const billingPage =
    pathname === "/billing-required" || pathname === "/settings/billing";
  const blocked = user?.role === "PROFESSIONAL" && !access?.canAccess;
  const [checkingOnboarding, setCheckingOnboarding] = useState(requireOnboardingComplete);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }

    if (!loading && isAuthenticated && blocked && !billingPage)
      router.replace("/billing-required");
    if (!loading && access?.canAccess && pathname === "/billing-required")
      router.replace("/dashboard");
    if (!loading && user?.role === "SUPER_ADMIN") {
      router.replace("/admin");
    }
  }, [
    access?.canAccess,
    billingPage,
    blocked,
    isAuthenticated,
    loading,
    pathname,
    router,
    user?.role,
  ]);

  useEffect(() => {
    if (!requireOnboardingComplete || billingPage || blocked) {
      setCheckingOnboarding(false);
      return;
    }

    if (user?.role === "SUPER_ADMIN") {
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
  }, [
    billingPage,
    blocked,
    isAuthenticated,
    loading,
    logout,
    requireOnboardingComplete,
    router,
    token,
    user?.role,
  ]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (
    loading ||
    checkingOnboarding ||
    !isAuthenticated ||
    !user ||
    (!business && !billingPage) ||
    (blocked && !billingPage) ||
    user.role === "SUPER_ADMIN"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="workspace min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-xl focus:bg-white focus:p-3"
      >
        Ir para o conteúdo
      </a>
      {!blocked && (
        <Sidebar
          pathname={pathname}
          userName={user.name}
          businessName={business?.name ?? "Minha conta"}
        />
      )}
      <div className={`min-w-0 ${blocked ? "" : "lg:pl-64"}`}>
        <Header
          accessBlocked={blocked}
          businessName={business?.name ?? "Minha conta"}
          pageTitle={title ?? getPageTitle(pathname)}
          pathname={pathname}
          userName={user.name}
          onLogout={handleLogout}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {access?.requiresPaymentAttention && access.canAccess && (
            <div
              role="status"
              className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900"
            >
              Sua assinatura precisa de atenção.{" "}
              {access.gracePeriodEndsAt &&
                `Regularize até ${new Date(access.gracePeriodEndsAt).toLocaleString("pt-BR")}.`}{" "}
              <a className="underline" href="/settings/billing">
                Ver assinatura
              </a>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
