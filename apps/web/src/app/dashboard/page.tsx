"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardResponse } from "@conecta-agenda/types";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock3,
  Copy,
  Download,
  DollarSign,
  Link2,
  Settings,
  Share2,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Button } from "@conecta-agenda/ui";
import { AppShell } from "@/components/app/app-shell";
import { OverviewCard } from "@/components/app/overview-card";
import { MiniCalendar } from "@/components/app/mini-calendar";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { getPublicAppUrl } from "@/lib/config";
import { getDashboard } from "@/lib/dashboard";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import { createReminderMessage, createWhatsappLink } from "@/lib/whatsapp";

const quickActions = [
  {
    title: "Novo agendamento",
    description: "Organize um atendimento",
    href: "/agenda",
    icon: CalendarPlus,
  },
  {
    title: "Seus clientes",
    description: "Cuide de cada contato",
    href: "/customers",
    icon: UsersRound,
  },
  {
    title: "Ver financeiro",
    description: "Acompanhe os atendimentos",
    href: "/finance",
    icon: DollarSign,
  },
  {
    title: "Configurar horários",
    description: "Defina sua disponibilidade",
    href: "/working-hours",
    icon: Settings,
  },
] as const;
const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

export default function DashboardPage() {
  const { token, logout, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoadingDashboard(true);
    setError(null);
    getDashboard(token)
      .then(setDashboard)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível carregar o dashboard.",
        );
        if (requestError instanceof ApiError && requestError.status === 401) logout();
      })
      .finally(() => setLoadingDashboard(false));
  }, [logout, token]);

  const publicLink = useMemo(
    () => (dashboard ? `${getPublicAppUrl()}${dashboard.publicLinkPath}` : ""),
    [dashboard],
  );
  const upcoming = useMemo(() => {
    if (!dashboard) return [];
    const unique = new Map(
      dashboard.tomorrowAppointments.map((appointment) => [appointment.id, appointment]),
    );
    if (dashboard.nextAppointment && !unique.has(dashboard.nextAppointment.id))
      unique.set(dashboard.nextAppointment.id, dashboard.nextAppointment);
    return [...unique.values()].sort((a, b) =>
      `${a.date.slice(0, 10)} ${a.startTime}`.localeCompare(
        `${b.date.slice(0, 10)} ${b.startTime}`,
      ),
    );
  }, [dashboard]);

  async function handleCopyLink() {
    if (!publicLink) return;
    setLinkError(null);
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setLinkError(
        "Não foi possível copiar. Selecione o endereço abaixo para compartilhá-lo.",
      );
    }
  }
  async function handleShareLink() {
    if (!publicLink) return;
    setLinkError(null);
    if (!navigator.share) {
      await handleCopyLink();
      return;
    }
    try {
      await navigator.share({ title: "Conecta Agenda", url: publicLink });
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === "AbortError"))
        setLinkError("Não foi possível compartilhar o link. Tente copiar o endereço.");
    }
  }
  function handleDownloadQrCode() {
    const canvas = document.getElementById("public-link-qr") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `conecta-agenda-${dashboard?.business.slug ?? "link"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <AppShell title="Visão geral">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-slate-950">
            Olá, {user?.name.trim().split(/\s+/)[0] ?? "bem-vindo"}!{" "}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Aqui está um resumo da sua agenda. Vamos organizar seu dia?
          </p>
        </section>
        {loadingDashboard && (
          <section role="status" aria-live="polite" className="surface p-6">
            <div
              aria-hidden="true"
              className="mb-4 h-3 w-40 animate-pulse rounded-full bg-violet-100"
            />
            <p className="text-sm text-slate-600">
              Carregando sua agenda e seus indicadores...
            </p>
          </section>
        )}
        {error && (
          <section
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </section>
        )}
        {!loadingDashboard && !error && dashboard && (
          <>
            <section className="hero-panel flex items-center justify-between gap-6 p-6 sm:p-8">
              <div className="relative z-10 max-w-lg">
                <span className="rounded-full bg-violet-200/60 px-3 py-1 text-[11px] font-semibold text-violet-800">
                  Sua rotina mais leve
                </span>
                <h2 className="mt-4 text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
                  Mais tempo para cuidar
                  <br className="hidden sm:block" />{" "}
                  <span className="text-violet-700">do seu negócio.</span>
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Organize seus atendimentos e conecte seus clientes à sua agenda.
                </p>
                <Button asChild className="mt-5">
                  <Link href="/agenda">
                    Criar novo agendamento{" "}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              </div>
              <div aria-hidden="true" className="hidden shrink-0 pr-10 lg:block">
                <div className="calendar-art">
                  <span className="ring left-8" />
                  <span className="ring left-20" />
                  <span className="ring right-8" />
                  <div className="grid grid-cols-4 gap-3 px-5 pt-14">
                    {Array.from({ length: 12 }, (_, i) => (
                      <span key={i} className="tile" />
                    ))}
                  </div>
                  <span className="absolute bottom-5 left-[5.3rem] flex size-7 items-center justify-center rounded-full bg-violet-600 text-white">
                    <Check className="size-5" />
                  </span>
                  <span className="absolute -right-8 -bottom-4 flex size-20 items-center justify-center rounded-full border-[5px] border-violet-500 bg-violet-50 text-violet-600 shadow-lg">
                    <Clock3 className="size-12" strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </section>
            <section
              aria-label="Indicadores do negócio"
              className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
            >
              <OverviewCard
                title="Agendamentos hoje"
                value={String(dashboard.summary.totalAppointmentsToday)}
                description="Atendimentos registrados para hoje"
                icon={CalendarDays}
              />
              <OverviewCard
                title="Clientes cadastrados"
                value={String(dashboard.summary.totalCustomers)}
                description="Contatos vinculados ao seu negócio"
                icon={UsersRound}
                tone="blue"
              />
              <OverviewCard
                title="Receita prevista no mês"
                value={formatCurrencyBRL(dashboard.summary.estimatedMonthInCents)}
                description="Estimativa com base nos atendimentos"
                icon={DollarSign}
                tone="green"
              />
              <OverviewCard
                title="Serviços ativos"
                value={String(dashboard.summary.totalServices)}
                description="Disponíveis para agendamento"
                icon={Wrench}
                tone="amber"
              />
            </section>
            <section
              aria-label="Ações rápidas"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {quickActions.map(({ title, description, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 p-4 transition-colors hover:bg-violet-100"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-violet-600">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-950">{title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                      {description}
                    </p>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-violet-400 group-hover:text-violet-700"
                  />
                </Link>
              ))}
            </section>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="space-y-6">
                <section className="surface overflow-hidden p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <CalendarDays
                        aria-hidden="true"
                        className="size-5 text-violet-600"
                      />
                      Próximos agendamentos
                    </h2>
                    <Link
                      href="/agenda"
                      className="text-xs font-semibold text-violet-700"
                    >
                      Ver agenda →
                    </Link>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Seu próximo atendimento e os compromissos de amanhã.
                  </p>
                  {upcoming.length === 0 ? (
                    <div className="empty-state mt-5 rounded-2xl bg-slate-50 text-center">
                      <CalendarPlus
                        aria-hidden="true"
                        className="mx-auto size-8 text-violet-400"
                      />
                      <p className="mt-4 text-sm font-semibold">
                        Sua agenda tem espaço para novos encontros.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Nenhum próximo atendimento ou compromisso para amanhã.
                      </p>
                      <Button asChild className="mt-5" size="sm" variant="outline">
                        <Link href="/agenda">Abrir minha agenda</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-5 divide-y divide-slate-100">
                      {upcoming.map((appointment) => (
                        <article
                          key={appointment.id}
                          className="flex flex-col gap-4 py-4 first:pt-0 sm:flex-row sm:items-center"
                        >
                          <span
                            aria-hidden="true"
                            className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 sm:flex"
                          >
                            {appointment.customerName
                              .trim()
                              .charAt(0)
                              .toLocaleUpperCase("pt-BR")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-950">
                              {appointment.customerName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {appointment.serviceName}
                            </p>
                          </div>
                          <div className="text-xs">
                            <p className="flex items-center gap-1.5 font-semibold">
                              <Clock3
                                aria-hidden="true"
                                className="size-3.5 text-violet-600"
                              />
                              {appointment.startTime} – {appointment.endTime}
                            </p>
                            <p className="mt-1 text-slate-500">
                              {formatDateBR(`${appointment.date.slice(0, 10)}T12:00:00`)}
                            </p>
                          </div>
                          <span
                            className={`self-start rounded-full px-2.5 py-1 text-[11px] font-semibold sm:self-auto ${appointment.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}
                          >
                            {statusLabels[appointment.status] ?? appointment.status}
                          </span>
                          {appointment.customerWhatsapp && (
                            <Button asChild variant="outline" size="sm">
                              <a
                                aria-label={`Enviar lembrete para ${appointment.customerName}`}
                                href={createWhatsappLink(
                                  appointment.customerWhatsapp,
                                  createReminderMessage({
                                    customerName: appointment.customerName,
                                    serviceName: appointment.serviceName,
                                    date: formatDateBR(
                                      `${appointment.date.slice(0, 10)}T12:00:00`,
                                    ),
                                    startTime: appointment.startTime,
                                    businessName: dashboard.business.name,
                                  }),
                                )}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <Bell aria-hidden="true" className="size-4" />
                                <span className="sm:sr-only">Lembrete</span>
                              </a>
                            </Button>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <section
                  aria-label="Mais indicadores"
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <OverviewCard
                    title="Agendamentos amanhã"
                    value={String(dashboard.summary.totalAppointmentsTomorrow)}
                    description="Compromissos do próximo dia"
                    icon={CalendarPlus}
                    tone="blue"
                  />
                  <OverviewCard
                    title="Receita prevista hoje"
                    value={formatCurrencyBRL(dashboard.summary.estimatedTodayInCents)}
                    description="Estimativa, não confirmação de pagamento"
                    icon={DollarSign}
                    tone="green"
                  />
                </section>
                <section className="surface p-5 sm:p-6">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Link2 aria-hidden="true" className="size-5 text-violet-600" />
                    Sua agenda a um link de distância
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Compartilhe com seus clientes. Os horários disponíveis seguem as
                    configurações do seu negócio.
                  </p>
                  <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <QRCodeCanvas
                        id="public-link-qr"
                        value={publicLink}
                        size={120}
                        marginSize={2}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="select-all break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                        {publicLink}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={handleCopyLink}>
                          <Copy aria-hidden="true" className="size-4" />
                          {copied ? "Link copiado" : "Copiar link"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleShareLink}
                        >
                          <Share2 aria-hidden="true" className="size-4" />
                          Compartilhar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleDownloadQrCode}
                        >
                          <Download aria-hidden="true" className="size-4" />
                          Baixar QR Code
                        </Button>
                      </div>
                      <p
                        role="status"
                        aria-live="polite"
                        className="mt-2 text-xs text-violet-700"
                      >
                        {copied ? "Link copiado para a área de transferência." : ""}
                      </p>
                      {linkError && (
                        <p role="alert" className="mt-2 text-xs text-red-700">
                          {linkError}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
              <div className="space-y-4">
                <MiniCalendar
                  appointmentDates={upcoming.map((appointment) => appointment.date)}
                />
                <section className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
                  <Wrench aria-hidden="true" className="size-6 text-violet-600" />
                  <h2 className="mt-3 text-sm font-semibold">
                    Uma agenda com a sua cara
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Mantenha seus serviços e o perfil do negócio atualizados para
                    facilitar o agendamento.
                  </p>
                  <Link
                    href="/services"
                    className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-violet-700"
                  >
                    Gerenciar serviços{" "}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
