"use client";

import { CalendarCheck } from "lucide-react";

import { appNavItems } from "./nav-items";
import { NavItem } from "./nav-item";

type SidebarProps = {
  pathname: string;
};

export function Sidebar({ pathname }: SidebarProps) {
  return (
    <aside className="hidden min-h-screen w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white">
          <CalendarCheck aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-950">Conecta Agenda</p>
          <p className="text-xs text-slate-500">Painel profissional</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {appNavItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            isActive={pathname === item.href}
            title={item.title}
          />
        ))}
      </nav>
    </aside>
  );
}
