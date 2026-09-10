"use client";

import { useCallback, useEffect, useState } from "react";
import type { BillingStatusResponse } from "@conecta-agenda/types";
import { Button } from "@conecta-agenda/ui";
import { AppShell } from "./app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import {
  getBillingStatus,
  createBillingCheckout,
  cancelBillingSubscription,
} from "@/lib/billing";
import { formatCurrencyBRL } from "@/lib/format";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "Não informado";

export function BillingPage() {
  const { token, user, logout, refreshMe } = useAuth();
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  async function perform(action: "checkout" | "cancel") {
    if (!token || processing) return;
    setProcessing(true);
    setError(null);
    try {
      if (action === "checkout") {
        const response = await createBillingCheckout(token);
        const url = new URL(response.checkoutUrl);
        if (url.protocol !== "https:" || url.username || url.password)
          throw new Error("Endereço de pagamento inválido.");
        window.location.assign(url.href);
      } else {
        await cancelBillingSubscription(token);
        setConfirmCancel(false);
        await reload();
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "BILLING_PROVIDER_NOT_CONFIGURED"
          ? "Pagamento online ainda não configurado. Fale com o suporte."
          : err instanceof Error
            ? err.message
            : "Não foi possível concluir a operação.",
      );
    } finally {
      setProcessing(false);
    }
  }
  const reload = useCallback(async () => {
    if (!token || user?.role !== "PROFESSIONAL") return;
    setLoading(true);
    setError(null);
    try {
      const response = await getBillingStatus(token);
      setBilling(response);
      await refreshMe();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível consultar a assinatura.",
      );
    } finally {
      setLoading(false);
    }
  }, [refreshMe, token, user?.role]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  const support = whatsapp
    ? `https://wa.me/${whatsapp}`
    : email
      ? `mailto:${email}`
      : null;
  const title =
    billing?.status === "MANUALLY_BLOCKED"
      ? "Acesso temporariamente bloqueado"
      : billing?.status === "EXPIRED"
        ? "Assinatura expirada"
        : billing?.requiresPaymentAttention
          ? "Sua assinatura precisa de atenção"
          : "Minha assinatura";

  return (
    <AppShell title="Assinatura" requireOnboardingComplete={false}>
      <section className="mx-auto max-w-2xl space-y-5 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {loading && <p role="status">Consultando assinatura...</p>}
        {billing && (
          <>
            <p>
              {billing.isManuallyBlocked
                ? "Entre em contato com o suporte para verificar a situação da sua conta."
                : !billing.canAccess
                  ? "Regularize sua assinatura para continuar utilizando o Conecta Agenda."
                  : billing.requiresPaymentAttention
                    ? "Identificamos uma pendência na sua assinatura. Regularize para evitar a interrupção do acesso."
                    : billing.reason}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>Plano</dt>
              <dd>{billing.plan?.name ?? "Sem plano"}</dd>
              <dt>Valor</dt>
              <dd>
                {billing.priceInCents === null
                  ? "Não informado"
                  : formatCurrencyBRL(billing.priceInCents)}
              </dd>
              <dt>Status da assinatura</dt>
              <dd>{billing.subscriptionStatus ?? "Sem assinatura"}</dd>
              <dt>Próxima cobrança</dt>
              <dd>{date(billing.nextPaymentAt)}</dd>
              <dt>Início do período</dt>
              <dd>{date(billing.currentPeriodStart)}</dd>
              <dt>Fim do período</dt>
              <dd>{date(billing.currentPeriodEnd)}</dd>
              <dt>Fim do teste</dt>
              <dd>{date(billing.trialEndsAt)}</dd>
              <dt>Fim da tolerância</dt>
              <dd>{date(billing.gracePeriodEndsAt)}</dd>
              <dt>Cortesia até</dt>
              <dd>{date(billing.accessOverrideUntil)}</dd>
              <dt>Situação do acesso</dt>
              <dd>
                {billing.status} — {billing.canAccess ? "Liberado" : "Bloqueado"}
              </dd>
            </dl>
          </>
        )}
        <p className="text-sm text-slate-600">
          {billing?.providerConfigured
            ? "Pagamento online ainda indisponível. Fale com o suporte."
            : "Pagamento online ainda não configurado."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!billing?.checkoutAvailable || processing}
            onClick={() => void perform("checkout")}
          >
            Regularizar assinatura
          </Button>
          <Button asChild variant="outline">
            <a href="/settings/billing">Gerenciar assinatura</a>
          </Button>
          <Button
            variant="outline"
            disabled={!billing?.cancellationAvailable || processing}
            onClick={() => setConfirmCancel(true)}
          >
            Cancelar assinatura
          </Button>
          {confirmCancel && (
            <div role="alert" className="w-full space-y-2">
              <p>Confirmar cancelamento? O acesso seguirá o período pago disponível.</p>
              <Button disabled={processing} onClick={() => void perform("cancel")}>
                Confirmar cancelamento
              </Button>
              <Button variant="outline" onClick={() => setConfirmCancel(false)}>
                Voltar
              </Button>
            </div>
          )}
          {support ? (
            <Button asChild variant="outline">
              <a href={support} target="_blank" rel="noreferrer">
                Falar com o suporte
              </a>
            </Button>
          ) : (
            <p className="text-sm text-slate-600">
              Contato de suporte ainda não configurado.
            </p>
          )}
          <Button variant="outline" disabled={loading} onClick={() => void reload()}>
            Atualizar situação
          </Button>
          <Button variant="outline" onClick={logout}>
            Sair
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
