"use client";

import { useEffect, useState } from "react";
import type { FinanceSummaryResponse } from "@conecta-agenda/types";
import { CalendarDays, CheckCircle2, DollarSign, UserX, XCircle } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { getFinanceSummary } from "@/lib/finance";
import { formatCurrencyBRL } from "@/lib/format";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinancePage() {
  const { token, logout } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<FinanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    getFinanceSummary(token, month)
      .then(setSummary)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar o financeiro.");
        if (requestError instanceof ApiError && requestError.status === 401) logout();
      })
      .finally(() => setLoading(false));
  }, [logout, month, token]);

  const cards = summary
    ? [
        ["Previsto hoje", formatCurrencyBRL(summary.today.expectedInCents), DollarSign],
        ["Realizado hoje", formatCurrencyBRL(summary.today.completedInCents), CheckCircle2],
        ["Atendimentos hoje", String(summary.today.appointmentsCount), CalendarDays],
        ["Previsto no mes", formatCurrencyBRL(summary.month.expectedInCents), DollarSign],
        ["Realizado no mes", formatCurrencyBRL(summary.month.completedInCents), CheckCircle2],
        ["Atendimentos no mes", String(summary.month.appointmentsCount), CalendarDays],
        ["Concluidos", String(summary.month.completedCount), CheckCircle2],
        ["Cancelados", String(summary.month.canceledCount), XCircle],
        ["Faltas", String(summary.month.noShowCount), UserX],
      ] as const
    : [];

  return (
    <AppShell title="Financeiro">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Resumo financeiro</h2>
            <p className="mt-1 text-sm text-slate-600">Valores previstos e realizados com base nos atendimentos.</p>
          </div>
          <label className="w-full sm:w-52">
            <span className="text-sm font-medium text-slate-800">Mes de referencia</span>
            <input className="field-input mt-2" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </section>
        {loading && <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">Carregando resumo financeiro...</p>}
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!loading && summary && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(([title, value, Icon]) => (
              <article key={title} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-600">{title}</p>
                  <Icon aria-hidden="true" className="size-5 text-slate-500" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
              </article>
            ))}
          </section>
        )}
        {!loading && summary?.month.appointmentsCount === 0 && (
          <p className="rounded-md border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">Nenhum atendimento registrado no mes selecionado.</p>
        )}
      </div>
    </AppShell>
  );
}
