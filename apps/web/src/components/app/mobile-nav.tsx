"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@conecta-agenda/ui";

import { appNavItems } from "./nav-items";
import { NavItem } from "./nav-item";

type MobileNavProps = {
  pathname: string;
};

export function MobileNav({ pathname }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        size="sm"
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <X aria-hidden="true" className="size-4" />
        ) : (
          <Menu aria-hidden="true" className="size-4" />
        )}
      </Button>

      {open && (
        <div className="absolute left-4 right-4 top-16 z-20 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <nav className="space-y-1">
            {appNavItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                isActive={pathname === item.href}
                title={item.title}
                onClick={() => setOpen(false)}
              />
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
