"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";

import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/hooks/use-auth";
import { createAdminBusiness } from "@/lib/admin";

const createBusinessSchema = z.object({
  ownerName: z.string().min(2, "Informe o nome do proprietario."),
  ownerEmail: z.string().email("Informe um e-mail valido."),
  temporaryPassword: z.string().min(6, "Informe uma senha temporaria."),
  businessName: z.string().min(2, "Informe o nome do negocio."),
  whatsapp: z.string().optional(),
  city: z.string().optional(),
  planSlug: z.string().min(1, "Informe o plano."),
  accessOverrideUntil: z.string().optional(),
});

type CreateBusinessFormData = z.infer<typeof createBusinessSchema>;

export default function NewAdminBusinessPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBusinessFormData>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: {
      ownerName: "",
      ownerEmail: "",
      temporaryPassword: "",
      businessName: "",
      whatsapp: "",
      city: "",
      planSlug: "starter",
      accessOverrideUntil: "",
    },
  });

  async function onSubmit(data: CreateBusinessFormData) {
    if (!token) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await createAdminBusiness(token, {
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        temporaryPassword: data.temporaryPassword,
        businessName: data.businessName,
        whatsapp: data.whatsapp ?? "",
        city: data.city ?? "",
        planSlug: data.planSlug,
        accessOverrideUntil: data.accessOverrideUntil || null,
      });
      reset();
      setSuccess("Profissional criado com senha temporaria.");
      router.push(`/admin/businesses/${response.business.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel criar o profissional.",
      );
    }
  }

  return (
    <AdminShell title="Criar profissional">
      <section className="mx-auto w-full max-w-4xl rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Criar profissional</h2>
          <p className="mt-2 text-sm text-slate-600">
            Cadastre uma conta profissional manualmente.
          </p>
        </div>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Nome do proprietario" error={errors.ownerName?.message}>
            <input className="field-input" {...register("ownerName")} />
          </Field>

          <Field label="E-mail" error={errors.ownerEmail?.message}>
            <input className="field-input" type="email" {...register("ownerEmail")} />
          </Field>

          <Field label="Senha temporaria" error={errors.temporaryPassword?.message}>
            <input
              className="field-input"
              type="password"
              autoComplete="new-password"
              {...register("temporaryPassword")}
            />
          </Field>

          <Field label="Nome do negocio" error={errors.businessName?.message}>
            <input className="field-input" {...register("businessName")} />
          </Field>

          <Field label="WhatsApp" error={errors.whatsapp?.message}>
            <input className="field-input" inputMode="tel" {...register("whatsapp")} />
          </Field>

          <Field label="Cidade" error={errors.city?.message}>
            <input className="field-input" {...register("city")} />
          </Field>

          <Field label="Plano" error={errors.planSlug?.message}>
            <select className="field-input" {...register("planSlug")}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </Field>

          <Field label="Cortesia ate" error={errors.accessOverrideUntil?.message}>
            <input className="field-input" type="date" {...register("accessOverrideUntil")} />
          </Field>

          {error && (
            <p className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="sm:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar profissional"}
            </Button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </label>
  );
}
