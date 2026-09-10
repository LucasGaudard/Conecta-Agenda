"use client";

import { LogOut } from "lucide-react";

import { Button } from "@conecta-agenda/ui";

import { MobileNav } from "./mobile-nav";

type HeaderProps = {
  businessName: string;
  pageTitle: string;
  pathname: string;
  userName: string;
  onLogout: () => void;
  accessBlocked?: boolean;
};

export function Header({
  businessName,
  pageTitle,
  pathname,
  userName,
  onLogout,
  accessBlocked = false,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {!accessBlocked && <MobileNav pathname={pathname} />}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-950">{pageTitle}</h1>
            <p className="truncate text-xs text-slate-500">{businessName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-950">{userName}</p>
            <p className="text-xs text-slate-500">{accessBlocked ? "Acesso bloqueado" : "Minha conta"}</p>
          </div>
          <Button
            aria-label="Sair"
            size="sm"
            type="button"
            variant="outline"
            onClick={onLogout}
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
