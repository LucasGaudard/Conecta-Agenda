"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  PublicAppointmentResponse,
  PublicBusinessDTO,
  PublicServiceDTO,
} from "@conecta-agenda/types";
import { CheckCircle2, Clock, Instagram, MapPin, MessageCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";
import { cn } from "@conecta-agenda/utils";

import { ApiError } from "@/lib/api";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import {
  createPublicAppointment,
  getAvailableTimes,
  getPublicBusiness,
  getPublicServices,
} from "@/lib/public-business";
import { createWhatsappLink } from "@/lib/whatsapp";

const customerSchema = z.object({
  customerName: z.string().min(2, "Informe seu nome."),
  customerWhatsapp: z.string().min(8, "Informe seu WhatsApp."),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;
type Step = "service" | "datetime" | "customer" | "confirm" | "success";

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PublicBusinessPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [business, setBusiness] = useState<PublicBusinessDTO | null>(null);
  const [services, setServices] = useState<PublicServiceDTO[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [appointmentResponse, setAppointmentResponse] =
    useState<PublicAppointmentResponse | null>(null);
  const [step, setStep] = useState<Step>("service");
  const [loading, setLoading] = useState(true);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submittingAppointment, setSubmittingAppointment] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerName: "",
      customerWhatsapp: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!slug) {
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    Promise.all([getPublicBusiness(slug), getPublicServices(slug)])
      .then(([businessResponse, servicesResponse]) => {
        setBusiness(businessResponse.business);
        setServices(servicesResponse.services);
      })
      .catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 404) {
          setNotFound(true);
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar esta pagina.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!slug || !selectedServiceId || !selectedDate) {
      setAvailableTimes([]);
      return;
    }

    setLoadingTimes(true);
    setError(null);
    setSelectedTime(null);

    getAvailableTimes(slug, selectedServiceId, selectedDate)
      .then((response) => {
        setAvailableTimes(response.availableTimes);
      })
      .catch((requestError) => {
        setAvailableTimes([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel carregar os horarios.",
        );
      })
      .finally(() => {
        setLoadingTimes(false);
      });
  }, [selectedDate, selectedServiceId, slug]);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
  const primaryColor = business?.primaryColor || "#111827";
  const today = useMemo(() => getTodayInputValue(), []);

  function handleSelectService(service: PublicServiceDTO) {
    setSelectedServiceId(service.id);
    setSelectedDate("");
    setSelectedTime(null);
    setAvailableTimes([]);
    setStep("datetime");
  }

  function handleCustomerSubmit() {
    setStep("confirm");
  }

  async function handleConfirmAppointment() {
    if (!slug || !selectedService || !selectedDate || !selectedTime) {
      return;
    }

    const customerData = getValues();
    setSubmittingAppointment(true);
    setError(null);

    try {
      const response = await createPublicAppointment(slug, {
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: selectedTime,
        customerName: customerData.customerName,
        customerWhatsapp: customerData.customerWhatsapp,
        notes: customerData.notes ?? "",
      });
      setAppointmentResponse(response);
      setStep("success");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel confirmar o agendamento.",
      );

      if (requestError instanceof ApiError && requestError.status === 409) {
        setStep("datetime");
        setSelectedTime(null);
        try {
          const refreshedTimes = await getAvailableTimes(slug, selectedService.id, selectedDate);
          setAvailableTimes(refreshedTimes.availableTimes);
        } catch {
          setAvailableTimes([]);
        }
      }
    } finally {
      setSubmittingAppointment(false);
    }
  }

  function restartBooking() {
    setSelectedServiceId(null);
    setSelectedDate("");
    setSelectedTime(null);
    setAvailableTimes([]);
    setAppointmentResponse(null);
    setError(null);
    reset();
    setStep("service");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <p className="text-sm text-slate-600">Carregando pagina publica...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Profissional nao encontrado</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Confira se o link esta correto ou solicite um novo endereco ao profissional.
          </p>
        </section>
      </main>
    );
  }

  if (error && !business) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <section className="w-full max-w-md rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </section>
      </main>
    );
  }

  if (!business) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <BusinessHeader business={business} primaryColor={primaryColor} />

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {step !== "success" && (
          <div className="mb-6 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <span className="font-medium text-slate-950">Agendamento:</span>{" "}
            {selectedService ? selectedService.name : "Escolha um servico"}{" "}
            {selectedDate ? `- ${formatDateBR(`${selectedDate}T00:00:00`)}` : ""}{" "}
            {selectedTime ? `as ${selectedTime}` : ""}
          </div>
        )}

        {step === "service" && (
          <ServiceStep
            primaryColor={primaryColor}
            selectedServiceId={selectedServiceId}
            services={services}
            onSelect={handleSelectService}
          />
        )}

        {step === "datetime" && selectedService && (
          <DateTimeStep
            availableTimes={availableTimes}
            loadingTimes={loadingTimes}
            primaryColor={primaryColor}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            service={selectedService}
            today={today}
            onBack={() => setStep("service")}
            onContinue={() => setStep("customer")}
            onDateChange={setSelectedDate}
            onTimeSelect={setSelectedTime}
          />
        )}

        {step === "customer" && (
          <CustomerStep
            errors={errors}
            register={register}
            onBack={() => setStep("datetime")}
            onSubmit={handleSubmit(handleCustomerSubmit)}
          />
        )}

        {step === "confirm" && selectedService && selectedDate && selectedTime && (
          <ConfirmStep
            customer={getValues()}
            date={selectedDate}
            primaryColor={primaryColor}
            selectedTime={selectedTime}
            service={selectedService}
            submitting={submittingAppointment}
            onBack={() => setStep("customer")}
            onConfirm={handleConfirmAppointment}
          />
        )}

        {step === "success" && appointmentResponse && (
          <SuccessStep response={appointmentResponse} onRestart={restartBooking} />
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500">
        Agendamento online por Conecta Agenda
      </footer>
    </main>
  );
}

function BusinessHeader({
  business,
  primaryColor,
}: {
  business: PublicBusinessDTO;
  primaryColor: string;
}) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div
            className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md text-xl font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {business.logoUrl ? (
              <img alt={business.name} className="size-full object-cover" src={business.logoUrl} />
            ) : (
              business.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">{business.name}</h1>
            {business.description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {business.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              {business.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-4" />
                  {business.city}
                </span>
              )}
              {business.address && <span>{business.address}</span>}
              {business.instagram && (
                <span className="inline-flex items-center gap-1">
                  <Instagram aria-hidden="true" className="size-4" />
                  {business.instagram}
                </span>
              )}
            </div>
          </div>
        </div>

        {business.whatsapp && (
          <WhatsAppLink primaryColor={primaryColor} whatsapp={business.whatsapp}>
            WhatsApp
          </WhatsAppLink>
        )}
      </div>
    </section>
  );
}

function ServiceStep({
  onSelect,
  primaryColor,
  selectedServiceId,
  services,
}: {
  onSelect: (service: PublicServiceDTO) => void;
  primaryColor: string;
  selectedServiceId: string | null;
  services: PublicServiceDTO[];
}) {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-950">Escolha um servico</h2>
      <p className="mt-2 text-sm text-slate-600">
        Selecione uma opcao para ver datas e horarios disponiveis.
      </p>

      {services.length === 0 ? (
        <div className="mt-6 rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Este profissional ainda nao possui servicos disponiveis para agendamento.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {services.map((service) => {
            const selected = selectedServiceId === service.id;

            return (
              <article
                key={service.id}
                className={cn(
                  "rounded-md border bg-white p-5 shadow-sm transition-colors",
                  selected ? "border-slate-950" : "border-slate-200",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{service.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {service.description || "Sem descricao."}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700">
                    {formatCurrencyBRL(service.priceInCents)}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                    <Clock aria-hidden="true" className="size-4" />
                    {service.durationMinutes} minutos
                  </span>
                  <button
                    className="h-10 rounded-md px-4 text-sm font-medium text-white"
                    style={{ backgroundColor: primaryColor }}
                    type="button"
                    onClick={() => onSelect(service)}
                  >
                    Selecionar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DateTimeStep({
  availableTimes,
  loadingTimes,
  onBack,
  onContinue,
  onDateChange,
  onTimeSelect,
  primaryColor,
  selectedDate,
  selectedTime,
  service,
  today,
}: {
  availableTimes: string[];
  loadingTimes: boolean;
  onBack: () => void;
  onContinue: () => void;
  onDateChange: (value: string) => void;
  onTimeSelect: (value: string) => void;
  primaryColor: string;
  selectedDate: string;
  selectedTime: string | null;
  service: PublicServiceDTO;
  today: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Escolha data e horario</h2>
      <p className="mt-2 text-sm text-slate-600">
        {service.name} - {service.durationMinutes} minutos
      </p>

      <label className="mt-5 block max-w-xs">
        <span className="text-sm font-medium text-slate-800">Data</span>
        <input
          className="field-input mt-2"
          min={today}
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-800">Horarios disponiveis</p>
        {loadingTimes && <p className="mt-3 text-sm text-slate-600">Carregando horarios...</p>}
        {!loadingTimes && selectedDate && availableTimes.length === 0 && (
          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Nenhum horario disponivel para esta data.
          </p>
        )}
        {!loadingTimes && availableTimes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTimes.map((time) => {
              const selected = selectedTime === time;
              return (
                <button
                  key={time}
                  className={cn(
                    "h-10 rounded-md border px-4 text-sm font-medium",
                    selected ? "text-white" : "border-slate-200 bg-white text-slate-700",
                  )}
                  style={selected ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
                  type="button"
                  onClick={() => onTimeSelect(time)}
                >
                  {time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" disabled={!selectedDate || !selectedTime} onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </section>
  );
}

function CustomerStep({
  errors,
  onBack,
  onSubmit,
  register,
}: {
  errors: ReturnType<typeof useForm<CustomerFormData>>["formState"]["errors"];
  onBack: () => void;
  onSubmit: () => void;
  register: ReturnType<typeof useForm<CustomerFormData>>["register"];
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Seus dados</h2>
      <p className="mt-2 text-sm text-slate-600">Informe seus dados para confirmar o horario.</p>

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <label>
          <span className="text-sm font-medium text-slate-800">Nome</span>
          <input className="field-input mt-2" {...register("customerName")} />
          {errors.customerName && (
            <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
          )}
        </label>
        <label>
          <span className="text-sm font-medium text-slate-800">WhatsApp</span>
          <input className="field-input mt-2" inputMode="tel" {...register("customerWhatsapp")} />
          {errors.customerWhatsapp && (
            <p className="mt-1 text-sm text-red-600">{errors.customerWhatsapp.message}</p>
          )}
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-medium text-slate-800">Observacao</span>
          <textarea className="field-input mt-2 min-h-24 py-2" {...register("notes")} />
        </label>
        <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            Voltar
          </Button>
          <Button type="submit">Continuar</Button>
        </div>
      </form>
    </section>
  );
}

function ConfirmStep({
  customer,
  date,
  onBack,
  onConfirm,
  primaryColor,
  selectedTime,
  service,
  submitting,
}: {
  customer: CustomerFormData;
  date: string;
  onBack: () => void;
  onConfirm: () => void;
  primaryColor: string;
  selectedTime: string;
  service: PublicServiceDTO;
  submitting: boolean;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Confirmar agendamento</h2>
      <div className="mt-5 space-y-2 text-sm text-slate-700">
        <p>
          <strong>Servico:</strong> {service.name}
        </p>
        <p>
          <strong>Preco:</strong> {formatCurrencyBRL(service.priceInCents)}
        </p>
        <p>
          <strong>Duracao:</strong> {service.durationMinutes} minutos
        </p>
        <p>
          <strong>Data:</strong> {formatDateBR(`${date}T00:00:00`)}
        </p>
        <p>
          <strong>Horario:</strong> {selectedTime}
        </p>
        <p>
          <strong>Cliente:</strong> {customer.customerName}
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <button
          className="h-10 rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
          disabled={submitting}
          style={{ backgroundColor: primaryColor }}
          type="button"
          onClick={onConfirm}
        >
          {submitting ? "Confirmando..." : "Confirmar agendamento"}
        </button>
      </div>
    </section>
  );
}

function SuccessStep({
  response,
  onRestart,
}: {
  response: PublicAppointmentResponse;
  onRestart: () => void;
}) {
  return (
    <section className="rounded-md border border-emerald-200 bg-white p-6 text-center shadow-sm">
      <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
      <h2 className="mt-4 text-2xl font-semibold text-slate-950">Agendamento confirmado!</h2>
      <div className="mx-auto mt-5 max-w-md space-y-2 rounded-md bg-slate-50 p-4 text-left text-sm text-slate-700">
        <p>
          <strong>Servico:</strong> {response.appointment.serviceName}
        </p>
        <p>
          <strong>Data:</strong> {formatDateBR(`${response.appointment.date}T00:00:00`)}
        </p>
        <p>
          <strong>Horario:</strong> {response.appointment.startTime} - {response.appointment.endTime}
        </p>
        <p>
          <strong>Cliente:</strong> {response.appointment.customer.name}
        </p>
      </div>
      {response.business.whatsapp && (
        <div className="mt-5">
          <WhatsAppLink primaryColor="#111827" whatsapp={response.business.whatsapp}>
            Falar com o profissional pelo WhatsApp
          </WhatsAppLink>
        </div>
      )}
      <div className="mt-3">
        <Button type="button" variant="outline" onClick={onRestart}>
          Fazer novo agendamento
        </Button>
      </div>
    </section>
  );
}

function WhatsAppLink({
  children,
  primaryColor,
  whatsapp,
}: {
  children: React.ReactNode;
  primaryColor: string;
  whatsapp: string;
}) {
  return (
    <a
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-white"
      href={createWhatsappLink(whatsapp)}
      rel="noreferrer"
      style={{ backgroundColor: primaryColor }}
      target="_blank"
    >
      <MessageCircle aria-hidden="true" className="size-4" />
      {children}
    </a>
  );
}
