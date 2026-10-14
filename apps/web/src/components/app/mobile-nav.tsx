"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X, type LucideIcon } from "lucide-react";
import { Button } from "@conecta-agenda/ui";
import { Brand } from "./brand";
import { appNavItems } from "./nav-items";
import { NavItem } from "./nav-item";

type NavigationItem = { title: string; href: string; icon: LucideIcon };

export function MobileNav({
  pathname,
  items = appNavItems,
  label = "Menu do empreendedor",
  subtitle = "Painel do empreendedor",
}: {
  pathname: string;
  items?: readonly NavigationItem[];
  label?: string;
  subtitle?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = originalOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <Button
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        size="sm"
        type="button"
        variant="outline"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <Menu aria-hidden="true" className="size-5" />
      </Button>
      <dialog
        ref={dialog}
        aria-label={label}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== dialog.current) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            dialog.current.close();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-80 max-w-[88vw] border-0 bg-white p-5 text-slate-950 shadow-xl backdrop:bg-slate-950/35 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <Brand subtitle={subtitle} />
          <Button
            autoFocus
            aria-label="Fechar menu"
            type="button"
            size="sm"
            variant="outline"
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <nav aria-label={label} className="mt-8 space-y-1">
          {items.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={
                pathname === item.href ||
                (item.href === "/admin/businesses" &&
                  pathname.startsWith("/admin/businesses/") &&
                  pathname !== "/admin/businesses/new")
              }
              onClick={() => dialog.current?.close()}
            />
          ))}
        </nav>
      </dialog>
    </div>
  );
}
