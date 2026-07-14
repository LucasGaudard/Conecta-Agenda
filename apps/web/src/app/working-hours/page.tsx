"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BlockedTimeDTO, DayOfWeek, WorkingHourDTO } from "@conecta-agenda/types";
import { Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@conecta-agenda/ui";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { createBlockedTime, deleteBlockedTime, getBlockedTimes } from "@/lib/blocked-times";
import { formatDateBR } from "@/lib/format";
import { getWorkingHours, updateWorkingHours } from "@/lib/working-hours";

const dayLabels: Record<DayOfWeek, string> = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Terca-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sabado",
  SUNDAY: "Domingo",
};

const dayOrder: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const blockedTimeSchema = z
  .object({
    date: z.string().min(1, "Informe a data."),
    startTime: z.string().regex(timePattern, "Horario invalido."),
    endTime: z.string().regex(timePattern, "Horario invalido."),
    reason: z.string().optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    path: ["endTime"],
    message: "Fim deve ser maior que inicio.",
  });

type BlockedTimeFormData = z.infer<typeof blockedTimeSchema>;

export default function WorkingHoursPage() {
  const { logout, token } = useAuth();
  const [workingHours, setWorkingHours] = useState<WorkingHourDTO[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTimeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BlockedTimeFormData>({
    resolver: zodResolver(blockedTimeSchema),
    defaultValues: {
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      reason: "",
    },
  });

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [hoursResponse, blocksResponse] = await Promise.all([
        getWorkingHours(token),
        getBlockedTimes(token),
      ]);
      setWorkingHours(sortWorkingHours(hoursResponse.workingHours));
      setBlockedTimes(blocksResponse.blockedTimes);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar os horarios.",
      );

      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [logout, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateHour(dayOfWeek: DayOfWeek, changes: Partial<WorkingHourDTO>) {
    setWorkingHours((current) =>
      current.map((hour) => (hour.dayOfWeek === dayOfWeek ? { ...hour, ...changes } : hour)),
    );
  }

  function validateWorkingHours() {
    if (workingHours.length !== 7) {
      return "Configure exatamente 7 dias da semana.";
    }

    for (const hour of workingHours) {
      if (!timePattern.test(hour.startTime) || !timePattern.test(hour.endTime)) {
        return `Horario invalido em ${dayLabels[hour.dayOfWeek]}.`;
      }

      if (hour.isActive && hour.endTime <= hour.startTime) {
        return `Fim deve ser maior que inicio em ${dayLabels[hour.dayOfWeek]}.`;
      }

      const hasBreakStart = Boolean(hour.breakStart);
      const hasBreakEnd = Boolean(hour.breakEnd);

      if (hasBreakStart !== hasBreakEnd) {
        return `Informe inicio e fim do intervalo em ${dayLabels[hour.dayOfWeek]}.`;
      }

      if (hour.breakStart && hour.breakEnd) {
        if (!timePattern.test(hour.breakStart) || !timePattern.test(hour.breakEnd)) {
          return `Intervalo invalido em ${dayLabels[hour.dayOfWeek]}.`;
        }

        if (hour.breakEnd <= hour.breakStart) {
          return `Fim do intervalo deve ser maior que inicio em ${dayLabels[hour.dayOfWeek]}.`;
        }

        if (hour.breakStart < hour.startTime || hour.breakEnd > hour.endTime) {
          return `Intervalo deve estar dentro do expediente em ${dayLabels[hour.dayOfWeek]}.`;
        }
      }
    }

    return null;
  }

  async function handleSaveWorkingHours() {
    if (!token) {
      return;
    }

    const validationMessage = validateWorkingHours();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSavingHours(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await updateWorkingHours(token, {
        workingHours: workingHours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          isActive: hour.isActive,
          startTime: hour.startTime,
          endTime: hour.endTime,
          breakStart: hour.breakStart || null,
          breakEnd: hour.breakEnd || null,
        })),
      });
      setWorkingHours(sortWorkingHours(response.workingHours));
      setSuccess("Horarios salvos com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar os horarios.",
      );
    } finally {
      setSavingHours(false);
    }
  }

  async function onCreateBlockedTime(data: BlockedTimeFormData) {
    if (!token) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await createBlockedTime(token, {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason || null,
      });
      reset({ date: "", startTime: "09:00", endTime: "10:00", reason: "" });
      setSuccess("Bloqueio criado com sucesso.");
      const response = await getBlockedTimes(token);
      setBlockedTimes(response.blockedTimes);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel criar o bloqueio.",
      );
    }
  }

  async function handleDeleteBlockedTime(blockedTime: BlockedTimeDTO) {
    if (!token) {
      return;
    }

    const confirmed = window.confirm("Deseja remover este bloqueio?");

    if (!confirmed) {
      return;
    }

    setRemovingId(blockedTime.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteBlockedTime(token, blockedTime.id);
      setBlockedTimes((current) => current.filter((item) => item.id !== blockedTime.id));
      setSuccess("Bloqueio removido com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel remover o bloqueio.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <AppShell title="Horarios">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section>
          <h2 className="text-2xl font-semibold text-slate-950">Horarios de atendimento</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Defina os dias e horarios em que sua agenda estara disponivel.
          </p>
        </section>

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

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Horarios semanais</h3>
              <p className="mt-1 text-sm text-slate-600">Configure os 7 dias da semana.</p>
            </div>
            <Button type="button" disabled={savingHours || loading} onClick={handleSaveWorkingHours}>
              {savingHours ? "Salvando..." : "Salvar horarios"}
            </Button>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-600">Carregando horarios...</p>
          ) : (
            <div className="mt-5 space-y-3">
              {workingHours.map((hour) => (
                <article
                  key={hour.dayOfWeek}
                  className="rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr] lg:items-end">
                    <label className="flex items-center gap-3">
                      <input
                        checked={hour.isActive}
                        type="checkbox"
                        onChange={(event) =>
                          updateHour(hour.dayOfWeek, { isActive: event.target.checked })
                        }
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-950">
                          {dayLabels[hour.dayOfWeek]}
                        </span>
                        <span className="text-xs text-slate-500">
                          {hour.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </span>
                    </label>

                    <TimeInput
                      label="Inicio"
                      value={hour.startTime}
                      onChange={(value) => updateHour(hour.dayOfWeek, { startTime: value })}
                    />
                    <TimeInput
                      label="Fim"
                      value={hour.endTime}
                      onChange={(value) => updateHour(hour.dayOfWeek, { endTime: value })}
                    />
                    <TimeInput
                      label="Intervalo inicio"
                      value={hour.breakStart ?? ""}
                      onChange={(value) =>
                        updateHour(hour.dayOfWeek, { breakStart: value || null })
                      }
                    />
                    <TimeInput
                      label="Intervalo fim"
                      value={hour.breakEnd ?? ""}
                      onChange={(value) => updateHour(hour.dayOfWeek, { breakEnd: value || null })}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Novo bloqueio</h3>
            <p className="mt-1 text-sm text-slate-600">Reserve um horario especifico na agenda.</p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit(onCreateBlockedTime)}>
              <Field label="Data" error={errors.date?.message}>
                <input className="field-input" type="date" {...register("date")} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Inicio" error={errors.startTime?.message}>
                  <input className="field-input" type="time" {...register("startTime")} />
                </Field>
                <Field label="Fim" error={errors.endTime?.message}>
                  <input className="field-input" type="time" {...register("endTime")} />
                </Field>
              </div>
              <Field label="Motivo" error={errors.reason?.message}>
                <input className="field-input" {...register("reason")} />
              </Field>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar bloqueio"}
              </Button>
            </form>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Bloqueios especificos</h3>
            {blockedTimes.length === 0 ? (
              <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Nenhum horario bloqueado.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {blockedTimes.map((blockedTime) => (
                  <article
                    key={blockedTime.id}
                    className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {formatDateBR(`${blockedTime.date}T00:00:00`)} - {blockedTime.startTime} as{" "}
                        {blockedTime.endTime}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {blockedTime.reason || "Sem motivo informado."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={removingId === blockedTime.id}
                      onClick={() => handleDeleteBlockedTime(blockedTime)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Remover
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function sortWorkingHours(hours: WorkingHourDTO[]) {
  return [...hours].sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek));
}

function TimeInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        className="field-input mt-1"
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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
