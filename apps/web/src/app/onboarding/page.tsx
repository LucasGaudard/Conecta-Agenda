"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";

import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { completeOnboarding, getOnboardingStatus } from "@/lib/onboarding";
import { generateSlug } from "@/lib/slug";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const onboardingSchema = z.object({
  name: z.string().min(2, "Informe o nome do negocio."),
  slug: z
    .string()
    .min(3, "Informe um slug com pelo menos 3 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras, numeros e hifens."),
  whatsapp: z.string().min(8, "Informe o WhatsApp."),
  city: z.string().min(2, "Informe a cidade."),
  address: z.string().optional(),
  description: z.string().optional(),
  instagram: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor hexadecimal."),
  bookingIntervalMinutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { business, isAuthenticated, loading, logout, refreshMe, token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: business?.name ?? "",
      slug: business?.slug ?? "",
      whatsapp: "",
      city: "",
      address: "",
      description: "",
      instagram: "",
      primaryColor: "#111827",
      bookingIntervalMinutes: 30,
    },
  });

  const name = watch("name");
  const slug = watch("slug");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    getOnboardingStatus(token)
      .then((status) => {
        if (status.completed) {
          router.replace("/dashboard");
        }
      })
      .catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
          router.replace("/login");
        }
      });
  }, [logout, router, token]);

  useEffect(() => {
    if (!slugEdited) {
      setValue("slug", generateSlug(name), { shouldValidate: true });
    }
  }, [name, setValue, slugEdited]);

  async function onSubmit(data: OnboardingFormData) {
    if (!token) {
      return;
    }

    setError(null);

    try {
      await completeOnboarding(token, {
        ...data,
        address: data.address || null,
        description: data.description || null,
        instagram: data.instagram || null,
        timezone: "America/Sao_Paulo",
      });
      await refreshMe();
      router.push("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel concluir o onboarding.",
      );
    }
  }

  if (loading || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto w-full max-w-3xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-sm font-medium text-slate-500">Onboarding inicial</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Em poucos minutos sua agenda estara pronta.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Complete os dados principais do seu negocio para liberar o painel.
          </p>
        </div>

        <form
          className="mt-8 grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit(onSubmit)}
        >
          <Field label="Nome do negocio" error={errors.name?.message}>
            <input className="field-input" {...register("name")} />
          </Field>

          <Field label="Slug/link publico" error={errors.slug?.message}>
            <input
              className="field-input"
              {...register("slug", {
                onChange: (event) => {
                  setSlugEdited(true);
                  event.target.value = generateSlug(event.target.value);
                },
              })}
            />
          </Field>

          <div className="sm:col-span-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {APP_URL}/{slug || "seu-slug"}
          </div>

          <Field label="WhatsApp" error={errors.whatsapp?.message}>
            <input className="field-input" inputMode="tel" {...register("whatsapp")} />
          </Field>

          <Field label="Cidade" error={errors.city?.message}>
            <input className="field-input" {...register("city")} />
          </Field>

          <Field label="Endereco" error={errors.address?.message}>
            <input className="field-input" {...register("address")} />
          </Field>

          <Field label="Instagram" error={errors.instagram?.message}>
            <input className="field-input" {...register("instagram")} />
          </Field>

          <Field label="Cor principal" error={errors.primaryColor?.message}>
            <input className="field-input" type="color" {...register("primaryColor")} />
          </Field>

          <Field label="Intervalo padrao" error={errors.bookingIntervalMinutes?.message}>
            <select
              className="field-input"
              {...register("bookingIntervalMinutes", { valueAsNumber: true })}
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos</option>
            </select>
          </Field>

          <Field
            className="sm:col-span-2"
            label="Descricao"
            error={errors.description?.message}
          >
            <textarea
              className="field-input min-h-24 py-2"
              {...register("description")}
            />
          </Field>

          {error && (
            <p className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Concluir onboarding"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({
  children,
  className,
  error,
  label,
}: {
  children: ReactNode;
  className?: string;
  error?: string;
  label: string;
}) {
  return (
    <label className={className}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </label>
  );
}
