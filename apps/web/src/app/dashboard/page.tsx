"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardResponse } from "@conecta-agenda/types";
import { QRCodeCanvas } from "qrcode.react";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Copy,
  Download,
  DollarSign,
  Share2,
  UsersRound,
  Wrench,
} from "lucide-react";

import { Button } from "@conecta-agenda/ui";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { getPublicAppUrl } from "@/lib/config";
import { getDashboard } from "@/lib/dashboard";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import { createReminderMessage, createWhatsappLink } from "@/lib/whatsapp";

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

function SummaryCard({ title, value, description, icon: Icon }: SummaryCardProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon aria-hidden="true" className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </section>
  );
}

export default function DashboardPage() {
  const { token, logout } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    setLoadingDashboard(true);
    setError(null);

    getDashboard(token)
      .then((response) => {
        setDashboard(response);
      })
      .catch((requestError) => {
        if (requestError instanceof Error) {
          setError(requestError.message);
        } else {
          setError("Nao foi possivel carregar o dashboard.");
        }

        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
        }
      })
      .finally(() => {
        setLoadingDashboard(false);
      });
  }, [logout, token]);

  const publicLink = useMemo(() => {
    if (!dashboard) {
      return "";
    }

    return `${getPublicAppUrl()}${dashboard.publicLinkPath}`;
  }, [dashboard]);

  async function handleCopyLink() {
    if (!publicLink) {
      return;
    }

    await navigator.clipboard.writeText(publicLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleShareLink() {
    if (!publicLink) return;
    if (navigator.share) {
      await navigator.share({ title: "Conecta Agenda", url: publicLink });
      return;
    }
    await handleCopyLink();
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
    <AppShell title="Dashboard">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {loadingDashboard && (
          <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Carregando dados do dashboard...</p>
          </section>
        )}

        {error && (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        )}

        {dashboard && (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Acoes rapidas</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild><Link href="/agenda">Novo agendamento</Link></Button>
                <Button asChild variant="outline"><Link href="/agenda">Ver agenda</Link></Button>
                <Button asChild variant="outline"><Link href="/services">Cadastrar servico</Link></Button>
                <Button type="button" variant="outline" onClick={handleCopyLink}><Copy aria-hidden="true" className="size-4" />Copiar link publico</Button>
              </div>
            </section>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                description="Compromissos registrados para hoje."
                icon={CalendarDays}
                title="Atendimentos hoje"
                value={String(dashboard.summary.totalAppointmentsToday)}
              />
              <SummaryCard
                description="Compromissos previstos para amanha."
                icon={CalendarPlus}
                title="Atendimentos amanha"
                value={String(dashboard.summary.totalAppointmentsTomorrow)}
              />
              <SummaryCard
                description="Clientes vinculados a este negocio."
                icon={UsersRound}
                title="Clientes"
                value={String(dashboard.summary.totalCustomers)}
              />
              <SummaryCard
                description="Servicos ativos disponiveis para agendamento."
                icon={Wrench}
                title="Servicos ativos"
                value={String(dashboard.summary.totalServices)}
              />
              <SummaryCard
                description="Receita prevista com atendimentos de hoje."
                icon={DollarSign}
                title="Previsto hoje"
                value={formatCurrencyBRL(dashboard.summary.estimatedTodayInCents)}
              />
              <SummaryCard
                description="Receita estimada para o mes atual."
                icon={DollarSign}
                title="Previsto no mes"
                value={formatCurrencyBRL(dashboard.summary.estimatedMonthInCents)}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">
                  Proximo atendimento
                </h2>
                {dashboard.nextAppointment ? (
                  <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-950">
                      {dashboard.nextAppointment.customerName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {dashboard.nextAppointment.serviceName}
                    </p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <span>{formatDateBR(dashboard.nextAppointment.date)}</span>
                      <span>
                        {dashboard.nextAppointment.startTime} -{" "}
                        {dashboard.nextAppointment.endTime}
                      </span>
                      <span>
                        {formatCurrencyBRL(dashboard.nextAppointment.priceInCents)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Nenhum proximo atendimento.
                  </p>
                )}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Seu link publico</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Compartilhe este endereco com seus clientes quando a pagina publica
                  estiver disponivel.
                </p>
                <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {publicLink}
                </div>
                <Button className="mt-4 w-full" type="button" onClick={handleCopyLink}>
                  <Copy aria-hidden="true" className="size-4" />
                  {copied ? "Link copiado" : "Copiar link"}
                </Button>
                <div className="mt-4 flex justify-center rounded-md border border-slate-200 bg-white p-4">
                  <QRCodeCanvas id="public-link-qr" value={publicLink} size={180} marginSize={2} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={handleShareLink}>
                    <Share2 aria-hidden="true" className="size-4" />Compartilhar
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDownloadQrCode}>
                    <Download aria-hidden="true" className="size-4" />Baixar QR Code
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Atendimentos de amanha</h2>
              {dashboard.tomorrowAppointments.length === 0 ? (
                <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">Nenhum atendimento previsto para amanha.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {dashboard.tomorrowAppointments.map((appointment) => (
                    <article key={appointment.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{appointment.startTime} · {appointment.customerName}</p>
                        <p className="mt-1 text-sm text-slate-600">{appointment.serviceName}</p>
                      </div>
                      {appointment.customerWhatsapp && (
                        <Button asChild variant="outline">
                          <a
                            href={createWhatsappLink(appointment.customerWhatsapp, createReminderMessage({
                              customerName: appointment.customerName,
                              serviceName: appointment.serviceName,
                              date: formatDateBR(appointment.date),
                              startTime: appointment.startTime,
                              businessName: dashboard.business.name,
                            }))}
                            rel="noreferrer"
                            target="_blank"
                          ><Bell aria-hidden="true" className="size-4" />Enviar lembrete</a>
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
