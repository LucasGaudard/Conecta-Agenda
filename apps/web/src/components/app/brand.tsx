import { CalendarCheck } from "lucide-react";

export function Brand({
  subtitle = "Organize · Agende · Cresça",
}: {
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="brand-mark">
        <CalendarCheck aria-hidden="true" className="size-6" />
      </span>
      <div>
        <p className="text-base font-bold leading-tight text-slate-950">
          Conecta <span className="text-violet-600">Agenda</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
