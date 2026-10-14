"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@conecta-agenda/ui";
import { calendarDateKey, monthCalendar } from "@/lib/calendar";

export function MiniCalendar({ appointmentDates }: { appointmentDates: string[] }) {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1, 12),
  );
  const marked = new Set(appointmentDates.map((date) => date.slice(0, 10)));
  const todayKey = calendarDateKey(today);
  const title = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  function changeMonth(step: number) {
    setMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + step, 1, 12),
    );
  }
  return (
    <section className="surface p-5" aria-label="Calendário de referência">
      <div className="flex items-center justify-between gap-2">
        <h2
          aria-live="polite"
          className="flex items-center gap-2 text-sm font-semibold capitalize"
        >
          <CalendarDays aria-hidden="true" className="size-4 text-violet-600" />
          {title}
        </h2>
        <div className="flex gap-1">
          <Button
            aria-label="Mês anterior"
            type="button"
            variant="outline"
            size="sm"
            className="size-8 border-transparent p-0"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="Próximo mês"
            type="button"
            variant="outline"
            size="sm"
            className="size-8 border-transparent p-0"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-y-1 text-center text-xs">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
          <span key={day} className="pb-2 font-medium text-slate-500">
            {day}
          </span>
        ))}
        {monthCalendar(month.getFullYear(), month.getMonth()).map((cell) => (
          <div key={cell.key} className="relative flex h-9 items-center justify-center">
            <span
              aria-current={cell.key === todayKey ? "date" : undefined}
              className={`flex size-8 items-center justify-center rounded-full ${cell.key === todayKey ? "bg-violet-600 font-semibold text-white" : cell.inMonth ? "text-slate-700" : "text-slate-400"}`}
            >
              {cell.day}
            </span>
            {marked.has(cell.key) && (
              <span className="absolute bottom-0 size-1 rounded-full bg-violet-500">
                <span className="sr-only">
                  Atendimento listado em {cell.date.toLocaleDateString("pt-BR")}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Os pontos indicam apenas os próximos atendimentos exibidos neste painel, não a
        disponibilidade de horários.
      </p>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12))}
          className="text-xs font-semibold text-violet-700"
        >
          Mês atual
        </button>
        <Link href="/agenda" className="text-xs font-semibold text-violet-700">
          Abrir agenda →
        </Link>
      </div>
    </section>
  );
}
