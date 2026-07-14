"use client";

import { useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { getBusinessProfile, updateBusinessProfile } from "@/lib/business";
import { generateSlug } from "@/lib/slug";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const profileSchema = z.object({
  name: z.string().min(2, "Informe o nome do negocio."),
  slug: z
    .string()
    .min(3, "Informe um slug com pelo menos 3 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras, numeros e hifens."),
  description: z.string().optional(),
  whatsapp: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  instagram: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor hexadecimal."),
  timezone: z.string().min(1, "Informe o timezone."),
  currency: z.string().min(1, "Informe a moeda."),
  bookingIntervalMinutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]),
  allowCancellation: z.boolean(),
  allowReschedule: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { logout, refreshMe, token } = useAuth();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      whatsapp: "",
      city: "",
      address: "",
      instagram: "",
      logoUrl: "",
      primaryColor: "#111827",
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      bookingIntervalMinutes: 30,
      allowCancellation: true,
      allowReschedule: true,
    },
  });

  const name = watch("name");
  const slug = watch("slug");

  useEffect(() => {
    if (!token) {
      return;
    }

    setLoadingProfile(true);
    getBusinessProfile(token)
      .then((response) => {
        reset({
          name: response.business.name,
          slug: response.business.slug,
          description: response.business.description ?? "",
          whatsapp: response.business.whatsapp ?? "",
          city: response.business.city ?? "",
          address: response.business.address ?? "",
          instagram: response.business.instagram ?? "",
          logoUrl: response.business.logoUrl ?? "",
          primaryColor: response.business.primaryColor ?? "#111827",
          timezone: response.settings.timezone,
          currency: response.settings.currency,
          bookingIntervalMinutes: response.settings.bookingIntervalMinutes as
            15 | 30 | 45 | 60,
          allowCancellation: response.settings.allowCancellation,
          allowReschedule: response.settings.allowReschedule,
        });
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar o perfil.",
        );

        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
        }
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  }, [logout, reset, token]);

  useEffect(() => {
    if (!slugEdited) {
      setValue("slug", generateSlug(name), { shouldValidate: true });
    }
  }, [name, setValue, slugEdited]);

  async function onSubmit(data: ProfileFormData) {
    if (!token) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await updateBusinessProfile(token, {
        ...data,
        description: data.description || null,
        whatsapp: data.whatsapp || null,
        city: data.city || null,
        address: data.address || null,
        instagram: data.instagram || null,
        logoUrl: data.logoUrl || null,
      });
      await refreshMe();
      setSlugEdited(false);
      setSuccess("Perfil atualizado com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o perfil.",
      );
    }
  }

  return (
    <AppShell title="Perfil">
      <section className="mx-auto w-full max-w-5xl">
        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Perfil do negocio</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Atualize as informacoes principais que identificam sua agenda.
            </p>
          </div>

          {loadingProfile ? (
            <p className="mt-6 text-sm text-slate-600">Carregando perfil...</p>
          ) : (
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
                <input
                  className="field-input"
                  inputMode="tel"
                  {...register("whatsapp")}
                />
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

              <Field label="URL da logo/foto" error={errors.logoUrl?.message}>
                <input className="field-input" type="url" {...register("logoUrl")} />
              </Field>

              <Field label="Cor principal" error={errors.primaryColor?.message}>
                <input
                  className="field-input"
                  type="color"
                  {...register("primaryColor")}
                />
              </Field>

              <Field label="Timezone" error={errors.timezone?.message}>
                <input className="field-input" {...register("timezone")} />
              </Field>

              <Field label="Moeda" error={errors.currency?.message}>
                <input className="field-input" {...register("currency")} />
              </Field>

              <Field
                label="Intervalo padrao"
                error={errors.bookingIntervalMinutes?.message}
              >
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

              <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" {...register("allowCancellation")} />
                Permitir cancelamento
              </label>

              <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" {...register("allowReschedule")} />
                Permitir remarcacao
              </label>

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
                  {isSubmitting ? "Salvando..." : "Salvar perfil"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </AppShell>
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
