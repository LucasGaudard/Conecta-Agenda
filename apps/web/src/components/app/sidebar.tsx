"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Brand } from "./brand";
import { appNavItems } from "./nav-items";
import { NavItem } from "./nav-item";

export function Sidebar({
  pathname,
  userName,
  businessName,
}: {
  pathname: string;
  userName: string;
  businessName: string;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white/90 px-4 py-6 lg:flex">
      <div className="px-2">
        <Brand subtitle="Painel do empreendedor" />
      </div>
      <nav
        aria-label="Menu do empreendedor"
        className="mt-9 flex-1 space-y-1 overflow-y-auto pb-4"
      >
        {appNavItems.map((item) => (
          <NavItem key={item.href} {...item} isActive={pathname === item.href} />
        ))}
      </nav>
      <Link
        href="/settings/billing"
        className="mb-5 rounded-2xl bg-violet-50 p-4 transition-colors hover:bg-violet-100"
      >
        <Sparkles aria-hidden="true" className="mb-3 size-5 text-violet-600" />
        <p className="text-sm font-semibold text-slate-950">Sua agenda, seu ritmo.</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Acompanhe seu plano e o acesso ao seu negócio.
        </p>
        <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-violet-700">
          Ver assinatura <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </span>
      </Link>
      <Link
        href="/profile"
        className="flex items-center gap-3 border-t border-slate-200 pt-4"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
          {userName.trim().charAt(0).toLocaleUpperCase("pt-BR")}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-950">{userName}</p>
          <p className="truncate text-[11px] text-slate-500">{businessName}</p>
        </div>
      </Link>
    </aside>
  );
}
