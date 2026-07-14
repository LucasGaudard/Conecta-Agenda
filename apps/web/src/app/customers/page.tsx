"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CustomerDTO } from "@conecta-agenda/types";
import { Pencil, Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { createCustomer, getCustomers, updateCustomer } from "@/lib/customers";
import { formatDateBR } from "@/lib/format";

const customerFormSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente."),
  whatsapp: z.string().min(8, "Informe o WhatsApp."),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

export default function CustomersPage() {
  const { logout, token } = useAuth();
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [search, setSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDTO | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: getEmptyForm(),
  });

  const loadCustomers = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoadingCustomers(true);
    setError(null);

    try {
      const response = await getCustomers(token, {
        search: search || undefined,
      });
      setCustomers(response.customers);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar os clientes.",
      );

      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
      }
    } finally {
      setLoadingCustomers(false);
    }
  }, [logout, search, token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCustomers();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadCustomers]);

  function openCreateForm() {
    setEditingCustomer(null);
    reset(getEmptyForm());
    setShowForm(true);
    setSuccess(null);
    setError(null);
  }

  function openEditForm(customer: CustomerDTO) {
    setEditingCustomer(customer);
    reset({
      name: customer.name,
      whatsapp: customer.whatsapp ?? "",
      notes: customer.notes ?? "",
    });
    setShowForm(true);
    setSuccess(null);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingCustomer(null);
    reset(getEmptyForm());
  }

  async function onSubmit(data: CustomerFormData) {
    if (!token) {
      return;
    }

    setError(null);
    setSuccess(null);

    const payload = {
      name: data.name,
      whatsapp: data.whatsapp,
      notes: data.notes || null,
    };

    try {
      if (editingCustomer) {
        await updateCustomer(token, editingCustomer.id, payload);
        setSuccess("Cliente atualizado com sucesso.");
      } else {
        await createCustomer(token, payload);
        setSuccess("Cliente cadastrado com sucesso.");
      }

      closeForm();
      await loadCustomers();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o cliente.",
      );
    }
  }

  return (
    <AppShell title="Clientes">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Clientes</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Gerencie os clientes cadastrados.
            </p>
          </div>
          <Button type="button" onClick={openCreateForm}>
            <Plus aria-hidden="true" className="size-4" />
            Novo Cliente
          </Button>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <label className="relative block w-full lg:max-w-md">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              className="field-input pl-9"
              placeholder="Buscar por nome ou WhatsApp"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </section>

        {showForm && (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  {editingCustomer ? "Editar cliente" : "Novo cliente"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Observacoes sao internas e ajudam no atendimento.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={closeForm}>
                Fechar
              </Button>
            </div>

            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
              <Field label="Nome" error={errors.name?.message}>
                <input className="field-input" {...register("name")} />
              </Field>

              <Field label="WhatsApp" error={errors.whatsapp?.message}>
                <input className="field-input" inputMode="tel" {...register("whatsapp")} />
              </Field>

              <Field className="sm:col-span-2" label="Observacoes" error={errors.notes?.message}>
                <textarea className="field-input min-h-24 py-2" {...register("notes")} />
              </Field>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar cliente"}
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

        <section className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.7fr_1.3fr_0.6fr] gap-4 border-b border-slate-200 px-5 py-3 text-xs font-medium uppercase text-slate-500 lg:grid">
            <span>Nome</span>
            <span>WhatsApp</span>
            <span>Ultimo atendimento</span>
            <span>Atendimentos</span>
            <span>Observacoes</span>
            <span>Acoes</span>
          </div>

          {loadingCustomers && (
            <p className="p-6 text-sm text-slate-600">Carregando clientes...</p>
          )}

          {!loadingCustomers && customers.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-base font-medium text-slate-950">Nenhum cliente cadastrado.</p>
              <p className="mt-2 text-sm text-slate-600">
                Cadastre clientes manualmente para manter historico e observacoes.
              </p>
              <Button className="mt-5" type="button" onClick={openCreateForm}>
                Cadastrar cliente
              </Button>
            </div>
          )}

          {!loadingCustomers &&
            customers.map((customer) => (
              <article
                key={customer.id}
                className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 lg:grid-cols-[1.2fr_1fr_1fr_0.7fr_1.3fr_0.6fr] lg:items-center"
              >
                <Cell label="Nome">
                  <span className="font-medium text-slate-950">{customer.name}</span>
                </Cell>
                <Cell label="WhatsApp">{customer.whatsapp || "-"}</Cell>
                <Cell label="Ultimo atendimento">
                  {customer.lastAppointment
                    ? `${formatDateBR(customer.lastAppointment.date)} as ${customer.lastAppointment.startTime}`
                    : "-"}
                </Cell>
                <Cell label="Atendimentos">{customer.appointmentsCount}</Cell>
                <Cell label="Observacoes">
                  <span className="line-clamp-2">{customer.notes || "-"}</span>
                </Cell>
                <div className="flex lg:justify-end">
                  <Button type="button" variant="outline" onClick={() => openEditForm(customer)}>
                    <Pencil aria-hidden="true" className="size-4" />
                    Editar
                  </Button>
                </div>
              </article>
            ))}
        </section>
      </div>
    </AppShell>
  );
}

function getEmptyForm(): CustomerFormData {
  return {
    name: "",
    whatsapp: "",
    notes: "",
  };
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

function Cell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="text-sm text-slate-700">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-500 lg:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}
