"use client";

import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BriefcaseBusiness, LogOut, Plus, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "@conecta-agenda/ui";
import { useAuth } from "@/hooks/use-auth";
import { Brand } from "@/components/app/brand";
import { NavItem } from "@/components/app/nav-item";
import { MobileNav } from "@/components/app/mobile-nav";

const adminNavItems = [
  { title: "Visão geral", href: "/admin", icon: BarChart3 },
  { title: "Profissionais", href: "/admin/businesses", icon: BriefcaseBusiness },
  { title: "Criar profissional", href: "/admin/businesses/new", icon: Plus },
] as const;

type AdminShellProps = { children: ReactNode; title: string };

export function AdminShell({ children, title }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, logout, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user?.role !== "SUPER_ADMIN") router.replace("/dashboard");
  }, [isAuthenticated, loading, router, user?.role]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || !isAuthenticated || user?.role !== "SUPER_ADMIN") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p role="status" className="text-sm text-slate-600">
          Carregando...
        </p>
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white/90 px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand subtitle="Administração global" />
        </div>
        <nav
          aria-label="Menu da administração global"
          className="mt-9 flex-1 space-y-1 overflow-y-auto"
        >
          {adminNavItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={
                pathname === item.href ||
                (item.href === "/admin/businesses" &&
                  pathname.startsWith("/admin/businesses/") &&
                  pathname !== "/admin/businesses/new")
              }
            />
          ))}
        </nav>
        <div className="rounded-2xl bg-violet-50 p-4">
          <ShieldCheck aria-hidden="true" className="mb-3 size-5 text-violet-600" />
          <p className="text-sm font-semibold">Controle da plataforma</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Gerencie profissionais, assinaturas, bloqueios e cortesias.
          </p>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
            {user.name.trim().charAt(0).toLocaleUpperCase("pt-BR")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{user.name}</p>
            <p className="text-[11px] text-slate-500">SUPER_ADMIN</p>
          </div>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/85 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <MobileNav
                pathname={pathname}
                items={adminNavItems}
                label="Menu da administração global"
                subtitle="Administração global"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
                <p className="mt-0.5 text-xs text-slate-500">Administração global</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 sm:inline-flex">
                SUPER_ADMIN
              </span>
              <Button
                aria-label="Sair"
                size="sm"
                type="button"
                variant="outline"
                onClick={handleLogout}
              >
                <LogOut aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
