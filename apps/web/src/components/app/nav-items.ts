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
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Agenda",
    href: "/agenda",
    icon: CalendarDays,
  },
  {
    title: "Servicos",
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
    title: "Horarios",
    href: "/working-hours",
    icon: Clock3,
  },
  {
    title: "Perfil",
    href: "/profile",
    icon: UserRound,
  },
  {
    title: "Configuracoes",
    href: "/settings",
    icon: Settings,
  },
] as const;
