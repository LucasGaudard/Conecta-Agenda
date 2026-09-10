"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@conecta-agenda/ui";
import { forgotPasswordRequest, resetPasswordRequest } from "@/lib/auth";
import { ApiError } from "@/lib/api";

const genericMessage =
  "Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.";

export function PasswordRecovery({ mode }: { mode: "forgot" | "reset" }) {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidToken = mode === "reset" && (invalid || !/^[a-f0-9]{64}$/.test(token));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    if (mode === "reset" && (password.length < 6 || password !== confirmPassword)) {
      setError("Informe uma senha com pelo menos 6 caracteres e confirmação idêntica.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "forgot")
        await forgotPasswordRequest({
          email: String(data.get("email") ?? "")
            .trim()
            .toLowerCase(),
        });
      else await resetPasswordRequest({ token, password, confirmPassword });
      form.reset();
      setSuccess(true);
      if (mode === "reset") window.history.replaceState(null, "", "/reset-password");
    } catch (err) {
      if (err instanceof ApiError && err.code === "RESET_TOKEN_INVALID_OR_EXPIRED")
        setInvalid(true);
      else
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível concluir. Tente novamente.",
        );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md space-y-6 rounded-md border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">
          {mode === "forgot" ? "Esqueci minha senha" : "Redefinir senha"}
        </h1>
        {success ? (
          <div role="status" className="space-y-4">
            <p>{mode === "forgot" ? genericMessage : "Senha alterada com sucesso."}</p>
            <Button asChild>
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        ) : invalidToken ? (
          <div role="alert" className="space-y-4">
            <p>Link inválido ou expirado. Solicite novas instruções.</p>
            <Link className="underline" href="/forgot-password">
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === "forgot" ? (
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  E-mail
                </label>
                <input
                  className="field-input mt-2"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="password" className="text-sm font-medium">
                    Nova senha
                  </label>
                  <input
                    className="field-input mt-2"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmar senha
                  </label>
                  <input
                    className="field-input mt-2"
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? "Enviando..."
                : mode === "forgot"
                  ? "Enviar instruções"
                  : "Redefinir senha"}
            </Button>
          </form>
        )}
        <Link className="block text-sm underline" href="/login">
          Voltar para entrar
        </Link>
      </section>
    </main>
  );
}
