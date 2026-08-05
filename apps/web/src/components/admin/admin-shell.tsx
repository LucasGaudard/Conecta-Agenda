"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BriefcaseBusiness, LogOut, Plus, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { Button } from "@conecta-agenda/ui";
import { cn } from "@conecta-agenda/utils";

import { useAuth } from "@/hooks/use-auth";

const adminNavItems = [
  { title: "Visao geral", href: "/admin", icon: BarChart3 },
  { title: "Profissionais", href: "/admin/businesses", icon: BriefcaseBusiness },
  { title: "Criar profissional", href: "/admin/businesses/new", icon: Plus },
] as const;

type AdminShellProps = {
  children: ReactNode;
  title: string;
};

export function AdminShell({ children, title }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, logout, user } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, loading, router, user?.role]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (loading || !isAuthenticated || user?.role !== "SUPER_ADMIN") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden min-h-screen w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div className="px-2">
          <p className="text-sm font-semibold text-slate-950">Conecta Agenda</p>
          <p className="text-xs text-slate-500">Administracao</p>
        </div>

        <nav className="mt-8 space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )}
                href={item.href}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-950">{title}</h1>
              <p className="truncate text-xs text-slate-500">{user.name}</p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild size="sm" type="button" variant="outline">
                <Link href="/dashboard">
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Voltar ao sistema
                </Link>
              </Button>
              <Button size="sm" type="button" variant="outline" onClick={handleLogout}>
                <LogOut aria-hidden="true" className="size-4" />
                Sair
              </Button>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium",
                  pathname === item.href
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600",
                )}
                href={item.href}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </header>

        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
