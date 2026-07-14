import { AppShell } from "./app-shell";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <AppShell title={title}>
      <section className="mx-auto w-full max-w-4xl">
        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Em breve nesta etapa.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
