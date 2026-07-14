import Link from "next/link";
import { CalendarCheck, Clock3, Link2, Smartphone, UsersRound } from "lucide-react";

import { Button } from "@conecta-agenda/ui";

const benefits = [
  [Clock3, "Menos trabalho manual", "Centralize horarios, bloqueios e atendimentos em um lugar simples."],
  [Link2, "Agendamento online", "Compartilhe seu link e deixe o cliente escolher um horario disponivel."],
  [Smartphone, "Feito para o celular", "Gerencie sua rotina e fale com seus clientes pelo WhatsApp."],
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:py-24">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-md bg-slate-950 text-white"><CalendarCheck aria-hidden="true" className="size-7" /></div>
        <h1 className="text-4xl font-bold sm:text-6xl">Conecta Agenda</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-700">Organize seus atendimentos. Seus clientes agendam. Voce ganha tempo.</p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Uma agenda online simples para autonomos que querem reduzir mensagens, evitar conflitos e cuidar melhor da rotina.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/register">Criar conta</Link></Button><Button asChild size="lg" variant="outline"><Link href="/login">Entrar</Link></Button></div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-16 md:grid-cols-3">
        {benefits.map(([Icon, title, description]) => <article key={title} className="rounded-md border border-slate-200 bg-white p-6 shadow-sm"><Icon aria-hidden="true" className="size-6 text-slate-700" /><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}
      </section>
      <section className="bg-slate-950 px-5 py-16 text-white"><div className="mx-auto max-w-6xl"><h2 className="text-center text-3xl font-semibold">Como funciona</h2><div className="mt-10 grid gap-6 md:grid-cols-3">{["Configure seus servicos e horarios.", "Compartilhe seu link publico.", "Receba e gerencie agendamentos."].map((text, index) => <div key={text} className="rounded-md border border-slate-700 p-5"><span className="text-sm text-slate-400">Passo {index + 1}</span><p className="mt-2 font-medium">{text}</p></div>)}</div></div></section>
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-2"><div><UsersRound aria-hidden="true" className="size-7" /><h2 className="mt-4 text-2xl font-semibold">Para quem trabalha com hora marcada</h2><p className="mt-3 text-sm leading-6 text-slate-600">Barbeiros, manicures, cabeleireiros, esteticistas, personal trainers, fotografos, professores e outros profissionais autonomos.</p></div><div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium text-slate-500">Plano Starter</p><p className="mt-2 text-3xl font-semibold">R$ 39/mes</p><p className="mt-3 text-sm text-slate-600">Agenda, servicos, clientes, pagina publica, WhatsApp manual, dashboard e financeiro previsto.</p><Button asChild className="mt-5"><Link href="/register">Comecar agora</Link></Button></div></section>
    </main>
  );
}
