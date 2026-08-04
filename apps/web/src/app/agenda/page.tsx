"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppointmentDTO, AppointmentStatus, CustomerDTO, ServiceDTO } from "@conecta-agenda/types";
import {
  CheckCircle2,
  Clock,
  Eye,
  MessageCircle,
  Plus,
  RotateCcw,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";

import { Button } from "@conecta-agenda/ui";
import { cn } from "@conecta-agenda/utils";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentAvailableTimes,
  getAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from "@/lib/appointments";
import { getCustomers } from "@/lib/customers";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import { getServices } from "@/lib/services";
import {
  createCancellationMessage,
  createConfirmationMessage,
  createReminderMessage,
  createRescheduleMessage,
  createWhatsappLink,
} from "@/lib/whatsapp";

const statusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluido",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

const statusStyles: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-sky-50 text-sky-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-slate-100 text-slate-700",
  CANCELED: "bg-red-50 text-red-700",
  NO_SHOW: "bg-amber-50 text-amber-700",
};

type CreateFormState = {
  serviceId: string;
  date: string;
  startTime: string;
  customerId: string;
  customerName: string;
  customerWhatsapp: string;
  notes: string;
};

type RescheduleState = {
  appointment: AppointmentDTO;
  date: string;
  startTime: string;
};

export default function AgendaPage() {
  const { business, logout, token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [rescheduleTimes, setRescheduleTimes] = useState<string[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [detailsAppointment, setDetailsAppointment] = useState<AppointmentDTO | null>(null);
  const [rescheduleState, setRescheduleState] = useState<RescheduleState | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [loadingRescheduleTimes, setLoadingRescheduleTimes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>(() => getEmptyCreateForm(getToday()));

  const activeServices = useMemo(() => services.filter((service) => service.isActive), [services]);

  const loadAppointments = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoadingAppointments(true);
    setError(null);

    try {
      const response = await getAppointments(token, { date: selectedDate });
      setAppointments(response.appointments);
    } catch (requestError) {
      handleRequestError(requestError, "Nao foi possivel carregar a agenda.", setError, logout);
    } finally {
      setLoadingAppointments(false);
    }
  }, [logout, selectedDate, token]);

  const loadFormData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const [servicesResponse, customersResponse] = await Promise.all([
        getServices(token, { status: "active" }),
        getCustomers(token),
      ]);
      setServices(servicesResponse.services);
      setCustomers(customersResponse.customers);
    } catch (requestError) {
      handleRequestError(requestError, "Nao foi possivel carregar servicos e clientes.", setError, logout);
    }
  }, [logout, token]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  useEffect(() => {
    setCreateForm((current) => ({
      ...current,
      date: selectedDate,
    }));
  }, [selectedDate]);

  useEffect(() => {
    if (!token || !createForm.serviceId || !createForm.date) {
      setAvailableTimes([]);
      return;
    }

    setLoadingTimes(true);

    getAppointmentAvailableTimes(token, {
      serviceId: createForm.serviceId,
      date: createForm.date,
    })
      .then((response) => {
        setAvailableTimes(response.availableTimes);
        setCreateForm((current) => ({
          ...current,
          startTime: response.availableTimes.includes(current.startTime) ? current.startTime : "",
        }));
      })
      .catch((requestError) => {
        setAvailableTimes([]);
        handleRequestError(requestError, "Nao foi possivel buscar horarios.", setError, logout);
      })
      .finally(() => setLoadingTimes(false));
  }, [createForm.date, createForm.serviceId, logout, token]);

  useEffect(() => {
    if (!token || !rescheduleState?.appointment.service?.id || !rescheduleState.date) {
      setRescheduleTimes([]);
      return;
    }

    setLoadingRescheduleTimes(true);

    getAppointmentAvailableTimes(token, {
      serviceId: rescheduleState.appointment.service.id,
      date: rescheduleState.date,
      ignoreAppointmentId: rescheduleState.appointment.id,
    })
      .then((response) => {
        setRescheduleTimes(response.availableTimes);
        setRescheduleState((current) =>
          current
            ? {
                ...current,
                startTime: response.availableTimes.includes(current.startTime) ? current.startTime : "",
              }
            : current,
        );
      })
      .catch((requestError) => {
        setRescheduleTimes([]);
        handleRequestError(requestError, "Nao foi possivel buscar horarios para remarcacao.", setError, logout);
      })
      .finally(() => setLoadingRescheduleTimes(false));
  }, [logout, rescheduleState?.appointment.id, rescheduleState?.appointment.service?.id, rescheduleState?.date, token]);

  function changeDay(days: number) {
    const date = new Date(`${selectedDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
  }

  function openCreateForm() {
    setCreateForm(getEmptyCreateForm(selectedDate));
    setAvailableTimes([]);
    setShowCreateForm(true);
    setSuccess(null);
    setError(null);
  }

  function closeCreateForm() {
    setShowCreateForm(false);
    setCreateForm(getEmptyCreateForm(selectedDate));
    setAvailableTimes([]);
  }

  async function handleCreateAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setError(null);
    setSuccess(null);
    setCreatingAppointment(true);

    try {
      await createAppointment(token, {
        serviceId: createForm.serviceId,
        date: createForm.date,
        startTime: createForm.startTime,
        customerId: createForm.customerId || undefined,
        customerName: createForm.customerId ? undefined : createForm.customerName,
        customerWhatsapp: createForm.customerId ? undefined : createForm.customerWhatsapp,
        notes: createForm.notes,
      });

      setSuccess("Agendamento criado com sucesso.");
      closeCreateForm();
      await loadFormData();
      await loadAppointments();
    } catch (requestError) {
      handleRequestError(requestError, "Nao foi possivel criar o agendamento.", setError, logout);
    } finally {
      setCreatingAppointment(false);
    }
  }

  async function handleStatus(appointment: AppointmentDTO, status: AppointmentStatus) {
    if (!token) {
      return;
    }

    setSavingId(appointment.id);
    setError(null);
    setSuccess(null);

    try {
      await updateAppointmentStatus(token, appointment.id, status);
      setSuccess("Status atualizado com sucesso.");
      await loadAppointments();
    } catch (requestError) {
      handleRequestError(requestError, "Nao foi possivel atualizar o status.", setError, logout);
    } finally {
      setSavingId(null);
    }
  }

  async function handleCancel(appointment: AppointmentDTO) {
    if (!token) {
      return;
    }

    const confirmed = window.confirm("Deseja cancelar este agendamento?");

    if (!confirmed) {
      return;
    }

    setSavingId(appointment.id);
    setError(null);
    setSuccess(null);

    try {
      await cancelAppointment(token, appointment.id);
      setSuccess("Agendamento cancelado.");
      await loadAppointments();
    } catch (requestError) {
      handleRequestError(requestError, "Nao foi possivel cancelar o agendamento.", setError, logout);
    } finally {
      setSavingId(null);
    }
  }

  function openReschedule(appointment: AppointmentDTO) {
    setRescheduleState({
      appointment,
      date: appointment.date,
      startTime: appointment.startTime,
    });
    setRescheduleTimes([]);
    setSuccess(null);
    setError(null);
  }

  async function handleReschedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !rescheduleState) {
      return;
    }

    setSavingId(rescheduleState.appointment.id);
    setError(null);
    setSuccess(null);

    try {
      await rescheduleAppointment(token, rescheduleState.appointment.id, {
        date: rescheduleState.date,
        startTime: rescheduleState.startTime,
      });
      setSuccess("Agendamento remarcado com sucesso.");
      setRescheduleState(null);
      await loadAppointments();
    } catch (requestError) {
      handleRequestError(requestError, "Nao foi possivel remarcar o agendamento.", setError, logout);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AppShell title="Agenda">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Agenda</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Visualize e gerencie seus atendimentos.
            </p>
          </div>
          <Button type="button" onClick={openCreateForm}>
            <Plus aria-hidden="true" className="size-4" />
            Novo agendamento
          </Button>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <label className="w-full md:max-w-xs">
              <span className="text-sm font-medium text-slate-800">Data</span>
              <input
                className="field-input mt-2"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => changeDay(-1)}>
                Dia anterior
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedDate(getToday())}>
                Hoje
              </Button>
              <Button type="button" variant="outline" onClick={() => changeDay(1)}>
                Proximo dia
              </Button>
            </div>
          </div>
        </section>

        {showCreateForm && (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <FormHeader title="Novo agendamento" onClose={closeCreateForm} />

            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleCreateAppointment}>
              <Field label="Servico">
                <select
                  className="field-input"
                  required
                  value={createForm.serviceId}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, serviceId: event.target.value }))
                  }
                >
                  <option value="">Selecione</option>
                  {activeServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {formatCurrencyBRL(service.priceInCents)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Data">
                <input
                  className="field-input"
                  required
                  type="date"
                  value={createForm.date}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </Field>

              <Field label="Horario">
                <select
                  className="field-input"
                  required
                  value={createForm.startTime}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, startTime: event.target.value }))
                  }
                >
                  <option value="">{loadingTimes ? "Carregando..." : "Selecione"}</option>
                  {availableTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cliente existente">
                <select
                  className="field-input"
                  value={createForm.customerId}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      customerId: event.target.value,
                      customerName: "",
                      customerWhatsapp: "",
                    }))
                  }
                >
                  <option value="">Novo cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.whatsapp ? `- ${customer.whatsapp}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {!createForm.customerId && (
                <>
                  <Field label="Nome do cliente">
                    <input
                      className="field-input"
                      required
                      value={createForm.customerName}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, customerName: event.target.value }))
                      }
                    />
                  </Field>

                  <Field label="WhatsApp">
                    <input
                      className="field-input"
                      inputMode="tel"
                      required
                      value={createForm.customerWhatsapp}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          customerWhatsapp: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </>
              )}

              <Field className="sm:col-span-2" label="Observacoes">
                <textarea
                  className="field-input min-h-24 py-2"
                  value={createForm.notes}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </Field>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={creatingAppointment}>
                  {creatingAppointment ? "Salvando..." : "Salvar agendamento"}
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
          {loadingAppointments && (
            <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Carregando agenda...
            </div>
          )}

          {!loadingAppointments && appointments.length === 0 && (
            <div className="rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-base font-medium text-slate-950">
                Nenhum atendimento agendado para esta data.
              </p>
              <Button className="mt-5" type="button" onClick={openCreateForm}>
                Criar agendamento
              </Button>
            </div>
          )}

          {!loadingAppointments &&
            appointments.map((appointment) => (
              <article
                key={appointment.id}
                className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-base font-semibold text-slate-950">
                        <Clock aria-hidden="true" className="size-4" />
                        {appointment.startTime} - {appointment.endTime}
                      </span>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        {appointment.customer.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {appointment.customer.whatsapp || "WhatsApp nao informado"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                      <span className="rounded-md bg-slate-100 px-2 py-1">
                        {appointment.serviceName}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1">
                        {formatCurrencyBRL(appointment.priceInCents)}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1">
                        {appointment.durationMinutes} minutos
                      </span>
                    </div>
                    {appointment.notes && (
                      <p className="max-w-2xl text-sm text-slate-600">{appointment.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button type="button" variant="outline" onClick={() => setDetailsAppointment(appointment)}>
                      <Eye aria-hidden="true" className="size-4" />
                      Detalhes
                    </Button>
                    <AppointmentActions
                      appointment={appointment}
                      businessName={business?.name ?? "seu profissional"}
                      disabled={savingId === appointment.id}
                      onCancel={handleCancel}
                      onReschedule={openReschedule}
                      onStatus={handleStatus}
                    />
                  </div>
                </div>
              </article>
            ))}
        </section>

        {detailsAppointment && (
          <Modal title="Detalhes do agendamento" onClose={() => setDetailsAppointment(null)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Cliente">{detailsAppointment.customer.name}</Detail>
              <Detail label="WhatsApp">{detailsAppointment.customer.whatsapp || "-"}</Detail>
              <Detail label="Servico">{detailsAppointment.serviceName}</Detail>
              <Detail label="Preco">{formatCurrencyBRL(detailsAppointment.priceInCents)}</Detail>
              <Detail label="Duracao">{detailsAppointment.durationMinutes} minutos</Detail>
              <Detail label="Data">{detailsAppointment.date}</Detail>
              <Detail label="Horario">
                {detailsAppointment.startTime} - {detailsAppointment.endTime}
              </Detail>
              <Detail label="Status">{statusLabels[detailsAppointment.status]}</Detail>
              <Detail className="sm:col-span-2" label="Observacoes">
                {detailsAppointment.notes || "-"}
              </Detail>
            </div>
          </Modal>
        )}

        {rescheduleState && (
          <Modal title="Remarcar agendamento" onClose={() => setRescheduleState(null)}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleReschedule}>
              <Field label="Nova data">
                <input
                  className="field-input"
                  required
                  type="date"
                  value={rescheduleState.date}
                  onChange={(event) =>
                    setRescheduleState((current) =>
                      current ? { ...current, date: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Novo horario">
                <select
                  className="field-input"
                  required
                  value={rescheduleState.startTime}
                  onChange={(event) =>
                    setRescheduleState((current) =>
                      current ? { ...current, startTime: event.target.value } : current,
                    )
                  }
                >
                  <option value="">{loadingRescheduleTimes ? "Carregando..." : "Selecione"}</option>
                  {rescheduleTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={savingId === rescheduleState.appointment.id}>
                  {savingId === rescheduleState.appointment.id ? "Remarcando..." : "Remarcar"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}

function AppointmentActions({
  appointment,
  businessName,
  disabled,
  onCancel,
  onReschedule,
  onStatus,
}: {
  appointment: AppointmentDTO;
  businessName: string;
  disabled: boolean;
  onCancel: (appointment: AppointmentDTO) => void;
  onReschedule: (appointment: AppointmentDTO) => void;
  onStatus: (appointment: AppointmentDTO, status: AppointmentStatus) => void;
}) {
  const canChangeStatus =
    appointment.status !== "CANCELED" && appointment.status !== "COMPLETED";
  const canReschedule = appointment.status !== "CANCELED" && appointment.status !== "COMPLETED";
  const messageData = {
    customerName: appointment.customer.name,
    serviceName: appointment.serviceName,
    date: formatDateBR(`${appointment.date}T00:00:00`),
    startTime: appointment.startTime,
    businessName,
  };

  function whatsappButton(label: string, message?: string) {
    if (!appointment.customer.whatsapp) return null;
    return (
      <Button asChild variant="outline">
        <a href={createWhatsappLink(appointment.customer.whatsapp, message)} rel="noreferrer" target="_blank">
          <MessageCircle aria-hidden="true" className="size-4" />{label}
        </a>
      </Button>
    );
  }

  return (
    <>
      {canChangeStatus && appointment.status !== "CONFIRMED" && (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => onStatus(appointment, "CONFIRMED")}>
          <UserCheck aria-hidden="true" className="size-4" />
          Confirmar
        </Button>
      )}
      {canChangeStatus && (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => onStatus(appointment, "COMPLETED")}>
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Concluir
        </Button>
      )}
      {canChangeStatus && appointment.status !== "NO_SHOW" && (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => onStatus(appointment, "NO_SHOW")}>
          <UserX aria-hidden="true" className="size-4" />
          Falta
        </Button>
      )}
      {canReschedule && appointment.service && (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => onReschedule(appointment)}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Remarcar
        </Button>
      )}
      {appointment.status !== "CANCELED" && appointment.status !== "COMPLETED" && (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => onCancel(appointment)}>
          <XCircle aria-hidden="true" className="size-4" />
          Cancelar
        </Button>
      )}
      {appointment.status === "SCHEDULED" && whatsappButton("Enviar confirmacao", createConfirmationMessage(messageData))}
      {appointment.status === "CONFIRMED" && whatsappButton("Enviar lembrete", createReminderMessage(messageData))}
      {appointment.status === "CANCELED" && whatsappButton("Avisar cancelamento", createCancellationMessage(messageData))}
      {canReschedule && whatsappButton("Avisar remarcacao", createRescheduleMessage(messageData))}
      {whatsappButton("Falar com cliente")}
    </>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-medium", statusStyles[status])}>
      {statusLabels[status]}
    </span>
  );
}

function FormHeader({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">
          Escolha servico, cliente, data e horario disponivel.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={onClose}>
        Fechar
      </Button>
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  const titleId = `modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
    >
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white p-5 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-slate-950">
            {title}
          </h3>
          <Button autoFocus type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Detail({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={cn("rounded-md border border-slate-200 bg-slate-50 p-3", className)}>
      <span className="block text-xs font-medium uppercase text-slate-500">{label}</span>
      <span className="mt-1 block text-sm text-slate-800">{children}</span>
    </div>
  );
}

function Field({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <label className={className}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function getEmptyCreateForm(date: string): CreateFormState {
  return {
    serviceId: "",
    date,
    startTime: "",
    customerId: "",
    customerName: "",
    customerWhatsapp: "",
    notes: "",
  };
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function handleRequestError(
  requestError: unknown,
  fallbackMessage: string,
  setError: (message: string) => void,
  logout: () => void,
) {
  setError(requestError instanceof Error ? requestError.message : fallbackMessage);

  if (requestError instanceof ApiError && requestError.status === 401) {
    logout();
  }
}
