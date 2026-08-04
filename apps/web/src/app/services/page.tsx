"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ServiceDTO, ServicesStatusFilter } from "@conecta-agenda/types";
import { CheckCircle2, Pencil, Plus, Power, Search, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";
import { cn } from "@conecta-agenda/utils";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { centsToReaisInput, formatCurrencyBRL, reaisToCents } from "@/lib/format";
import {
  createService,
  deleteService,
  getServices,
  updateService,
  updateServiceStatus,
} from "@/lib/services";

const serviceFormSchema = z.object({
  name: z.string().min(2, "Informe o nome do servico."),
  description: z.string().optional(),
  price: z.string().refine((value) => reaisToCents(value) >= 0, "Informe um preco valido."),
  durationMinutes: z
    .number()
    .int()
    .min(5, "Duracao minima de 5 minutos.")
    .max(480, "Duracao maxima de 480 minutos."),
  isActive: z.boolean(),
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

const statusFilters: Array<{ label: string; value: ServicesStatusFilter }> = [
  { label: "Todos", value: "all" },
  { label: "Ativos", value: "active" },
  { label: "Inativos", value: "inactive" },
];

export default function ServicesPage() {
  const { logout, token } = useAuth();
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [status, setStatus] = useState<ServicesStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<ServiceDTO | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: getEmptyForm(),
  });

  const loadServices = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoadingServices(true);
    setError(null);

    try {
      const response = await getServices(token, {
        status,
        search: search || undefined,
      });
      setServices(response.services);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar os servicos.",
      );

      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
      }
    } finally {
      setLoadingServices(false);
    }
  }, [logout, search, status, token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadServices();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadServices]);

  const emptyState = useMemo(
    () => !loadingServices && services.length === 0,
    [loadingServices, services.length],
  );

  function openCreateForm() {
    setEditingService(null);
    reset(getEmptyForm());
    setShowForm(true);
    setSuccess(null);
    setError(null);
  }

  function openEditForm(service: ServiceDTO) {
    setEditingService(service);
    reset({
      name: service.name,
      description: service.description ?? "",
      price: centsToReaisInput(service.priceInCents),
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
    });
    setShowForm(true);
    setSuccess(null);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingService(null);
    reset(getEmptyForm());
  }

  async function onSubmit(data: ServiceFormData) {
    if (!token) {
      return;
    }

    setError(null);
    setSuccess(null);

    const payload = {
      name: data.name,
      description: data.description ?? "",
      priceInCents: reaisToCents(data.price),
      durationMinutes: data.durationMinutes,
      isActive: data.isActive,
    };

    try {
      if (editingService) {
        await updateService(token, editingService.id, payload);
        setSuccess("Servico atualizado com sucesso.");
      } else {
        await createService(token, payload);
        setSuccess("Servico criado com sucesso.");
      }

      closeForm();
      await loadServices();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o servico.",
      );
    }
  }

  async function handleToggleStatus(service: ServiceDTO) {
    if (!token) {
      return;
    }

    if (service.isActive) {
      const confirmed = window.confirm("Deseja inativar este servico?");

      if (!confirmed) {
        return;
      }
    }

    setSavingStatusId(service.id);
    setError(null);
    setSuccess(null);

    try {
      await updateServiceStatus(token, service.id, !service.isActive);
      setSuccess(service.isActive ? "Servico inativado." : "Servico reativado.");
      await loadServices();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel atualizar o status.",
      );
    } finally {
      setSavingStatusId(null);
    }
  }

  async function handleSoftDelete(service: ServiceDTO) {
    if (!token) {
      return;
    }

    const confirmed = window.confirm("Deseja inativar este servico?");

    if (!confirmed) {
      return;
    }

    setSavingStatusId(service.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteService(token, service.id);
      setSuccess("Servico inativado com sucesso.");
      await loadServices();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel inativar o servico.",
      );
    } finally {
      setSavingStatusId(null);
    }
  }

  return (
    <AppShell title="Servicos">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Servicos</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Cadastre os servicos que seus clientes poderao agendar.
            </p>
          </div>
          <Button type="button" onClick={openCreateForm}>
            <Plus aria-hidden="true" className="size-4" />
            Novo servico
          </Button>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  className={cn(
                    "h-9 rounded-md border px-3 text-sm font-medium transition-colors",
                    status === filter.value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                  type="button"
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="relative w-full lg:max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <input
                className="field-input pl-9"
                placeholder="Buscar por nome ou descricao"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
        </section>

        {showForm && (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  {editingService ? "Editar servico" : "Novo servico"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Informe preco em reais. O sistema salva em centavos.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={closeForm}>
                Fechar
              </Button>
            </div>

            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
              <Field label="Nome do servico" error={errors.name?.message}>
                <input className="field-input" {...register("name")} />
              </Field>

              <Field label="Preco" error={errors.price?.message}>
                <input className="field-input" inputMode="decimal" placeholder="35,00" {...register("price")} />
              </Field>

              <Field label="Duracao em minutos" error={errors.durationMinutes?.message}>
                <input
                  className="field-input"
                  inputMode="numeric"
                  type="number"
                  {...register("durationMinutes", { valueAsNumber: true })}
                />
              </Field>

              <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" {...register("isActive")} />
                Servico ativo
              </label>

              <Field className="sm:col-span-2" label="Descricao" error={errors.description?.message}>
                <textarea className="field-input min-h-24 py-2" {...register("description")} />
              </Field>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar servico"}
                </Button>
              </div>
            </form>
          </section>
        )}

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

        <section className="space-y-3">
          {loadingServices && (
            <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Carregando servicos...
            </div>
          )}

          {emptyState && (
            <div className="rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-base font-medium text-slate-950">
                Voce ainda nao cadastrou nenhum servico.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Comece criando o primeiro item que seus clientes poderao agendar.
              </p>
              <Button className="mt-5" type="button" onClick={openCreateForm}>
                Cadastrar primeiro servico
              </Button>
            </div>
          )}

          {!loadingServices &&
            services.map((service) => (
              <article
                key={service.id}
                className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">{service.name}</h3>
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
                          service.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {service.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      {service.description || "Sem descricao."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
                      <span className="rounded-md bg-slate-100 px-2 py-1">
                        {formatCurrencyBRL(service.priceInCents)}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1">
                        {service.durationMinutes} minutos
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => openEditForm(service)}>
                      <Pencil aria-hidden="true" className="size-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingStatusId === service.id}
                      onClick={() => handleToggleStatus(service)}
                    >
                      {service.isActive ? (
                        <XCircle aria-hidden="true" className="size-4" />
                      ) : (
                        <CheckCircle2 aria-hidden="true" className="size-4" />
                      )}
                      {service.isActive ? "Inativar" : "Reativar"}
                    </Button>
                    {service.isActive && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savingStatusId === service.id}
                        onClick={() => handleSoftDelete(service)}
                      >
                        <Power aria-hidden="true" className="size-4" />
                        Desativar
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
        </section>
      </div>
    </AppShell>
  );
}

function getEmptyForm(): ServiceFormData {
  return {
    name: "",
    description: "",
    price: "0,00",
    durationMinutes: 30,
    isActive: true,
  };
}

function Field({
  children,
  className,
  error,
  label,
}: {
  children: React.ReactNode;
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
