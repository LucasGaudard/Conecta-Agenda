"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  CreditCard,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { AdminOverviewResponse } from "@conecta-agenda/types";

import { AdminShell } from "@/components/admin/admin-shell";
import { OverviewCard } from "@/components/app/overview-card";
import { Button } from "@conecta-agenda/ui";
import { useAuth } from "@/hooks/use-auth";
import { getAdminOverview } from "@/lib/admin";

const overviewCards: Array<{
  key: keyof AdminOverviewResponse;
  label: string;
}> = [
  { key: "totalProfessionals", label: "Profissionais" },
  { key: "totalBusinesses", label: "Negocios" },
  { key: "activeSubscriptions", label: "Assinaturas ativas" },
  { key: "trialingSubscriptions", label: "Em teste" },
  { key: "pastDueSubscriptions", label: "Pagamento pendente" },
  { key: "manuallyBlockedBusinesses", label: "Bloqueados" },
  { key: "registrationsThisMonth", label: "Cadastros no mes" },
];

export default function AdminOverviewPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    getAdminOverview(token)
      .then(setOverview)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar a visao geral.",
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AdminShell title="Visao geral">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="hero-panel p-6 sm:p-8">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-violet-700">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Administração global
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-950">
              Sua plataforma, em perspectiva.
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Indicadores reais de profissionais, assinaturas e acesso ao Conecta Agenda.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/businesses">Gerenciar profissionais</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/businesses/new">Criar profissional</Link>
              </Button>
            </div>
          </div>
        </section>

        {loading && <p className="text-sm text-slate-600">Carregando indicadores...</p>}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {overview && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <OverviewCard
                key={card.key}
                title={card.label}
                value={String(overview[card.key])}
                icon={
                  card.key === "totalProfessionals"
                    ? UsersRound
                    : card.key === "totalBusinesses"
                      ? Building2
                      : card.key === "registrationsThisMonth"
                        ? CalendarPlus
                        : card.key === "manuallyBlockedBusinesses"
                          ? ShieldCheck
                          : CreditCard
                }
                tone={
                  card.key === "pastDueSubscriptions" ||
                  card.key === "manuallyBlockedBusinesses"
                    ? "amber"
                    : card.key === "activeSubscriptions"
                      ? "green"
                      : "violet"
                }
              />
            ))}
          </section>
        )}
      </div>
    </AdminShell>
  );
}
