import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock3,
  Link2,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { Button } from "@conecta-agenda/ui";
import { Brand } from "@/components/app/brand";

const benefits = [
  [
    Clock3,
    "Sua rotina em um só lugar",
    "Centralize horários, bloqueios e atendimentos para organizar seu dia.",
  ],
  [
    Link2,
    "Um link. Mais facilidade.",
    "Compartilhe sua página e deixe o cliente escolher um horário disponível.",
  ],
  [
    Smartphone,
    "Perto de você, onde estiver",
    "Gerencie sua agenda no celular e envie lembretes pelo WhatsApp.",
  ],
] as const;

export default function HomePage() {
  return (
    <main className="auth-background min-h-screen text-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-6">
        <Link href="/" aria-label="Conecta Agenda, início">
          <Brand />
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-[1.2fr_1fr] sm:py-20">
        <div>
          <span className="rounded-full border border-violet-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-violet-700">
            Feito para quem trabalha com hora marcada
          </span>
          <h1 className="mt-7 text-4xl font-bold leading-[1.12] tracking-tight sm:text-6xl">
            Sua agenda organizada.
            <br />
            <span className="text-violet-600">Seu dia mais leve.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-600">
            Seus clientes agendam. Você ganha tempo para fazer o que sabe de melhor.
            Conecte seus atendimentos a uma rotina simples e profissional.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Criar minha agenda <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Já tenho conta</Link>
            </Button>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="hero-panel flex min-h-72 items-center justify-center p-8 sm:min-h-96"
        >
          <div className="relative z-10 rotate-[-4deg] rounded-3xl border border-white bg-white/90 p-7 shadow-xl shadow-violet-200/50">
            <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <CalendarCheck className="size-7" />
            </span>
            <p className="text-xl font-bold">Tudo no seu tempo.</p>
            <div className="mt-6 space-y-4">
              {[
                "Agenda e atendimentos",
                "Clientes e serviços",
                "Horários e disponibilidade",
              ].map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl bg-violet-50 px-4 py-3 text-sm text-slate-600"
                >
                  <Check className="size-4 text-violet-600" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section
        aria-label="Benefícios"
        className="mx-auto grid max-w-6xl gap-5 px-5 pb-16 md:grid-cols-3"
      >
        {benefits.map(([Icon, title, description]) => (
          <article key={title} className="surface p-7">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-5 text-base font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
          </article>
        ))}
      </section>
      <section className="border-y border-violet-100 bg-white/70 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-violet-600">
            Simples, do início ao atendimento
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold">
            Sua agenda em três passos
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              "Configure seus serviços e horários.",
              "Compartilhe seu link público.",
              "Receba e gerencie agendamentos.",
            ].map((text, index) => (
              <div key={text} className="rounded-2xl bg-slate-50 p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                  0{index + 1}
                </span>
                <p className="mt-4 text-sm font-semibold">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="hero-panel p-8 sm:p-12">
          <div className="relative z-10">
            <UsersRound aria-hidden="true" className="size-7 text-violet-600" />
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
              Mais organização para o seu negócio.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
              Para profissionais autônomos que querem reduzir mensagens, evitar conflitos
              e cuidar melhor da rotina de atendimentos.
            </p>
            <Button asChild className="mt-6">
              <Link href="/register">
                Começar agora <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pb-8">
        <Brand />
        <p className="text-xs text-slate-500">Organize · Agende · Cresça</p>
      </footer>
    </main>
  );
}
