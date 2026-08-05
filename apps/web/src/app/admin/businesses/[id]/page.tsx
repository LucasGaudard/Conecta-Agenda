"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AdminBusinessDetails } from "@conecta-agenda/types";

import { Button } from "@conecta-agenda/ui";

import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/hooks/use-auth";
import { getAdminBusiness, updateAdminBusinessAccess } from "@/lib/admin";
import { getPublicAppUrl } from "@/lib/config";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";

export default function AdminBusinessDetailsPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const [business, setBusiness] = useState<AdminBusinessDetails | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [overrideUntil, setOverrideUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBusiness = useCallback(async () => {
    if (!token || !params.id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getAdminBusiness(token, params.id);
      setBusiness(response.business);
      setBlockReason(response.business.blockReason ?? "");
      setOverrideUntil(response.business.accessOverrideUntil?.slice(0, 10) ?? "");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar o profissional.",
      );
    } finally {
      setLoading(false);
    }
  }, [params.id, token]);

  useEffect(() => {
    void loadBusiness();
  }, [loadBusiness]);

  async function handleBlock() {
    if (!token || !business) {
      return;
    }

    if (!window.confirm("Deseja bloquear manualmente este negocio?")) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminBusinessAccess(token, business.id, {
        isManuallyBlocked: true,
        blockReason,
        accessOverrideUntil: overrideUntil || null,
      });
      setSuccess("Negocio bloqueado.");
      await loadBusiness();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel bloquear.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUnblock() {
    if (!token || !business) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminBusinessAccess(token, business.id, {
        isManuallyBlocked: false,
        accessOverrideUntil: overrideUntil || null,
      });
      setSuccess("Negocio desbloqueado.");
      await loadBusiness();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel desbloquear.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleOverride(nextValue: string | null) {
    if (!token || !business) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminBusinessAccess(token, business.id, {
        isManuallyBlocked: business.isManuallyBlocked,
        blockReason: business.isManuallyBlocked ? blockReason : null,
        accessOverrideUntil: nextValue,
      });
      setSuccess(nextValue ? "Cortesia atualizada." : "Cortesia removida.");
      await loadBusiness();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Detalhes do profissional">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Button asChild variant="outline">
          <Link href="/admin/businesses">Voltar</Link>
        </Button>

        {loading && <p className="text-sm text-slate-600">Carregando...</p>}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}

        {business && (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">{business.name}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {business.owner.name} - {business.owner.email}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Link publico: {getPublicAppUrl()}/{business.slug}
                  </p>
                </div>
                <div className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {business.access.status}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <Info title="Negocio">
                <Detail label="WhatsApp" value={business.whatsapp ?? "-"} />
                <Detail label="Cidade" value={business.city ?? "-"} />
                <Detail label="Criacao" value={formatDateBR(business.createdAt)} />
                <Detail label="Cor principal" value={business.primaryColor ?? "-"} />
              </Info>

              <Info title="Plano e assinatura">
                <Detail label="Plano" value={business.subscription?.plan.name ?? "-"} />
                <Detail
                  label="Preco"
                  value={
                    business.subscription
                      ? formatCurrencyBRL(business.subscription.plan.priceInCents)
                      : "-"
                  }
                />
                <Detail label="Status" value={business.subscription?.status ?? "-"} />
                <Detail
                  label="Periodo atual"
                  value={business.subscription?.currentPeriodEnd ?? "-"}
                />
              </Info>

              <Info title="Contagens">
                <Detail label="Servicos" value={String(business.counts.services)} />
                <Detail label="Clientes" value={String(business.counts.customers)} />
                <Detail label="Agendamentos" value={String(business.counts.appointments)} />
                <Detail label="Acesso" value={business.access.reason} />
              </Info>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Controle manual de acesso</h3>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <label>
                  <span className="text-sm font-medium text-slate-800">Motivo do bloqueio</span>
                  <textarea
                    className="field-input mt-2 min-h-24 py-2"
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-800">Cortesia ate</span>
                  <input
                    className="field-input mt-2"
                    type="date"
                    value={overrideUntil}
                    onChange={(event) => setOverrideUntil(event.target.value)}
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button type="button" disabled={saving} onClick={handleBlock}>
                  Bloquear
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={handleUnblock}>
                  Desbloquear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !overrideUntil}
                  onClick={() => handleOverride(overrideUntil)}
                >
                  Definir cortesia
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => handleOverride(null)}
                >
                  Remover cortesia
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Info({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-800">{value}</p>
    </div>
  );
}
