"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthMeResponse } from "@conecta-agenda/types";
import { LogOut, UserRound } from "lucide-react";

import { Button } from "@conecta-agenda/ui";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { meRequest } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [account, setAccount] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    meRequest(token)
      .then(setAccount)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar as configuracoes.");
        if (requestError instanceof ApiError && requestError.status === 401) logout();
      })
      .finally(() => setLoading(false));
  }, [logout, token]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <AppShell title="Configuracoes">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {loading && <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">Carregando configuracoes...</p>}
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {account && (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><UserRound aria-hidden="true" className="size-5 text-slate-500" /><h2 className="text-lg font-semibold text-slate-950">Sua conta</h2></div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <Info label="Nome" value={account.user.name} />
                <Info label="E-mail" value={account.user.email} />
                <Info label="Negocio" value={account.business.name} />
                <Info label="Link publico" value={`/${account.business.slug}`} />
              </dl>
              <Button asChild className="mt-5" variant="outline"><Link href="/profile">Editar perfil do negocio</Link></Button>
            </section>
            <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Plano e assinatura</h2>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{account.subscription?.plan.name ?? "Starter"}</p>
              <p className="mt-1 text-sm text-slate-600">Status: {account.subscription?.status ?? "Nao informado"}</p>
              <p className="mt-3 text-sm text-slate-500">A cobranca e a troca de plano ainda nao fazem parte desta versao.</p>
            </section>
            <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Sessao</h2>
              <Button className="mt-4" type="button" variant="outline" onClick={handleLogout}><LogOut aria-hidden="true" className="size-4" />Sair da conta</Button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-4"><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value}</dd></div>;
}
