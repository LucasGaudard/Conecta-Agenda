"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminBusinessListItem, BusinessAccessStatus } from "@conecta-agenda/types";
import { Search } from "lucide-react";

import { Button } from "@conecta-agenda/ui";
import { cn } from "@conecta-agenda/utils";

import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/hooks/use-auth";
import { getAdminBusinesses } from "@/lib/admin";

const accessOptions: Array<{
  label: string;
  value: "" | "ACCESS_ALLOWED" | BusinessAccessStatus;
}> = [
  { label: "Todos", value: "" },
  { label: "Acesso liberado", value: "ACCESS_ALLOWED" },
  { label: "Ativo", value: "ACTIVE" },
  { label: "Teste", value: "TRIAL" },
  { label: "Cortesia", value: "OVERRIDE_ACTIVE" },
  { label: "Atencao", value: "PAYMENT_ATTENTION" },
  { label: "Bloqueado", value: "MANUALLY_BLOCKED" },
  { label: "Expirado", value: "EXPIRED" },
];

const subscriptionOptions = [
  { label: "Todas assinaturas", value: "" },
  { label: "Ativa", value: "ACTIVE" },
  { label: "Teste", value: "TRIALING" },
  { label: "Pendente", value: "PAST_DUE" },
  { label: "Cancelada", value: "CANCELED" },
  { label: "Expirada", value: "EXPIRED" },
];

export default function AdminBusinessesPage() {
  const { token } = useAuth();
  const [businesses, setBusinesses] = useState<AdminBusinessListItem[]>([]);
  const [search, setSearch] = useState("");
  const [accessStatus, setAccessStatus] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBusinesses = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getAdminBusinesses(token, {
        search: search || undefined,
        accessStatus: accessStatus || undefined,
        subscriptionStatus: subscriptionStatus || undefined,
        pageSize: 50,
      });
      setBusinesses(response.businesses);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar profissionais.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessStatus, search, subscriptionStatus, token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBusinesses();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadBusinesses]);

  return (
    <AdminShell title="Profissionais">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Profissionais</h2>
            <p className="mt-2 text-sm text-slate-600">
              Consulte contas cadastradas e acompanhe acesso.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/businesses/new">Criar profissional</Link>
          </Button>
        </section>

        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              className="field-input pl-9"
              placeholder="Buscar por negocio, proprietario, e-mail, slug ou WhatsApp"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            className="field-input"
            value={accessStatus}
            onChange={(event) => setAccessStatus(event.target.value)}
          >
            {accessOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="field-input"
            value={subscriptionStatus}
            onChange={(event) => setSubscriptionStatus(event.target.value)}
          >
            {subscriptionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.8fr_0.9fr_0.9fr_0.7fr] gap-4 border-b border-slate-200 px-5 py-3 text-xs font-medium uppercase text-slate-500 xl:grid">
            <span>Negocio</span>
            <span>Proprietario</span>
            <span>E-mail</span>
            <span>Plano</span>
            <span>Assinatura</span>
            <span>Acesso</span>
            <span>Acoes</span>
          </div>

          {loading && <p className="p-6 text-sm text-slate-600">Carregando...</p>}

          {!loading && businesses.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-600">
              Nenhum profissional encontrado.
            </p>
          )}

          {!loading &&
            businesses.map((business) => (
              <article
                key={business.id}
                className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 xl:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.9fr_0.9fr_0.7fr] xl:items-center"
              >
                <Cell label="Negocio">
                  <span className="font-medium text-slate-950">{business.name}</span>
                  <span className="block text-xs text-slate-500">/{business.slug}</span>
                </Cell>
                <Cell label="Proprietario">{business.owner.name}</Cell>
                <Cell label="E-mail">{business.owner.email}</Cell>
                <Cell label="Plano">{business.subscription?.plan.name ?? "-"}</Cell>
                <Cell label="Assinatura"><span className={business.subscription?.status === "PAST_DUE" ? "font-semibold text-red-700" : undefined}>{business.subscription?.status ?? "-"}</span></Cell>
                <Cell label="Acesso">
                  <AccessBadge status={business.access.status} />
                  <p>{business.access.canAccess ? "Liberado" : "Sem acesso"}</p>
                  <p
                    className={
                      business.access.requiresPaymentAttention
                        ? "text-red-700"
                        : "text-slate-500"
                    }
                  >
                    Atenção financeira:{" "}
                    {business.access.requiresPaymentAttention ? "Sim" : "Não"}
                  </p>
                  {business.access.gracePeriodEndsAt && (
                    <p>
                      Tolerância:{" "}
                      {new Date(business.access.gracePeriodEndsAt).toLocaleString(
                        "pt-BR",
                      )}
                    </p>
                  )}
                </Cell>
                <div className="flex xl:justify-end">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/businesses/${business.id}`}>Ver detalhes</Link>
                  </Button>
                </div>
              </article>
            ))}
        </section>
      </div>
    </AdminShell>
  );
}

function Cell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="text-sm text-slate-700">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-500 xl:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

function AccessBadge({ status }: { status: BusinessAccessStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        status === "ACTIVE" && "bg-emerald-50 text-emerald-700",
        status === "TRIAL" && "bg-amber-50 text-amber-700",
        status === "OVERRIDE_ACTIVE" && "bg-sky-50 text-sky-700",
        status === "PAYMENT_ATTENTION" && "bg-red-50 text-red-700",
        status === "EXPIRED" && "bg-red-50 text-red-700",
        status === "MANUALLY_BLOCKED" && "bg-slate-900 text-white",
      )}
    >
      {status}
    </span>
  );
}
