import type { LucideIcon } from "lucide-react";

const tones = {
  violet: "bg-violet-100 text-violet-600",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
};

export function OverviewCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "violet",
}: {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  return (
    <article className="surface flex items-start gap-4 p-5">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-600">{title}</p>
        <p className="mt-1.5 break-words text-2xl font-bold tracking-tight text-slate-950">
          {value}
        </p>
        {description && (
          <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
        )}
      </div>
    </article>
  );
}
