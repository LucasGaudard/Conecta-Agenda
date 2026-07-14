"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";

import { useAuth } from "@/hooks/use-auth";
import { getOnboardingStatus } from "@/lib/onboarding";

const registerFormSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  businessName: z.string().optional(),
  whatsapp: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      businessName: "",
      whatsapp: "",
    },
  });

  async function onSubmit(data: RegisterFormData) {
    setError(null);

    try {
      const response = await registerAccount({
        name: data.name,
        email: data.email,
        password: data.password,
        businessName: data.businessName || undefined,
        whatsapp: data.whatsapp || undefined,
      });
      const onboarding = await getOnboardingStatus(response.token);
      router.push(onboarding.completed ? "/dashboard" : "/onboarding");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel criar sua conta.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Criar conta</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Comece com uma agenda online simples para seu negocio.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="name">
              Nome
            </label>
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              id="name"
              autoComplete="name"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

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
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="businessName">
              Nome do negocio
            </label>
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              id="businessName"
              {...register("businessName")}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="whatsapp">
              WhatsApp
            </label>
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              id="whatsapp"
              inputMode="tel"
              {...register("whatsapp")}
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar conta"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Ja tem conta?{" "}
          <Link className="font-medium text-slate-950 underline" href="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
