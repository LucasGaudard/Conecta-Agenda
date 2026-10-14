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
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-violet-600 text-white shadow-md shadow-violet-200/60"
          : "text-slate-600 hover:bg-violet-50 hover:text-violet-700",
      )}
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{title}</span>
    </Link>
  );
}
