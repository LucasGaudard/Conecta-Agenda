import {
  CalendarDays,
  Clock3,
  DollarSign,
  LayoutDashboard,
  Settings,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";

export const appNavItems = [
  {
    title: "Visão geral",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Agenda",
    href: "/agenda",
    icon: CalendarDays,
  },
  {
    title: "Serviços",
    href: "/services",
    icon: Wrench,
  },
  {
    title: "Clientes",
    href: "/customers",
    icon: UsersRound,
  },
  {
    title: "Financeiro",
    href: "/finance",
    icon: DollarSign,
  },
  {
    title: "Horários e bloqueios",
    href: "/working-hours",
    icon: Clock3,
  },
  {
    title: "Perfil",
    href: "/profile",
    icon: UserRound,
  },
  {
    title: "Configurações",
    href: "/settings",
    icon: Settings,
  },
  { title: "Assinatura", href: "/settings/billing", icon: DollarSign },
] as const;
