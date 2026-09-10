"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";

import { useAuth } from "@/hooks/use-auth";
import { meRequest } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/onboarding";

const loginFormSchema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "Informe sua senha."),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormData) {
    setError(null);

    try {
      const response = await login(data);
      if (response.user.role === "SUPER_ADMIN") {
        router.push("/admin");
        return;
      }

      const session = await meRequest(response.token);
      if (!session.access?.canAccess) {
        router.push("/billing-required");
        return;
      }
      const onboarding = await getOnboardingStatus(response.token);
      router.push(onboarding.completed ? "/dashboard" : "/onboarding");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel entrar.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Entrar</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Acesse sua conta para gerenciar sua agenda.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="email">
              E-mail
            </label>
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="password">
              Senha
            </label>
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Ainda nao tem conta?{" "}
          <Link className="font-medium text-slate-950 underline" href="/register">
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}
