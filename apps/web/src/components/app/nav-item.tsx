"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@conecta-agenda/utils";

type NavItemProps = {
  title: string;
  href: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick?: () => void;
};

export function NavItem({ title, href, icon: Icon, isActive, onClick }: NavItemProps) {
  return (
    <Link
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-950 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      )}
      href={href}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{title}</span>
    </Link>
  );
}
