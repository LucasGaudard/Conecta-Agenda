"use client";

import { useEffect, useState } from "react";
import type { AdminOverviewResponse } from "@conecta-agenda/types";

import { AdminShell } from "@/components/admin/admin-shell";
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
        <section>
          <h2 className="text-2xl font-semibold text-slate-950">Visao geral</h2>
          <p className="mt-2 text-sm text-slate-600">
            Indicadores operacionais do SaaS.
          </p>
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
              <article
                key={card.key}
                className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {overview[card.key]}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </AdminShell>
  );
}
