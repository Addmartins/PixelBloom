import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, Flower2, Gift, HeartHandshake, Heart } from "lucide-react";
import { parseLoginPortal } from "@/features/auth/login-access";

export const metadata: Metadata = { title: "Demonstração" };

export function generateStaticParams() {
  return [{ portal: "corporativo" }, { portal: "familia" }];
}

function DemoAgenda({ corporate }: { corporate: boolean }) {
  return (
    <section className="panel grid content-start gap-4" aria-labelledby="agenda-demo">
      <h2 id="agenda-demo" className="flex items-center gap-2 text-xl font-semibold">
        <CalendarDays aria-hidden="true" size={21} className="text-primary" /> Próximos atendimentos
      </h2>
      <ul className="grid gap-3">
        <li className="grid gap-1 rounded-xl bg-background p-4">
          <strong>Terça-feira, às 9h</strong>
          <span>Orientação familiar · Alex Demo</span>
          <span className="font-medium text-accent">Confirmado</span>
        </li>
        <li className="grid gap-1 rounded-xl bg-background p-4">
          <strong>Quinta-feira, às 14h</strong>
          <span>Atividade de linguagem · {corporate ? "Lia Demo" : "Alex Demo"}</span>
          <span className="text-muted">Agendado</span>
        </li>
      </ul>
    </section>
  );
}

function CorporatePreview() {
  const metrics = [["Pacientes ativos", 2], ["Profissionais", 2], ["Atendimentos agendados", 2]] as const;
  return <>
    <dl className="grid gap-3 sm:grid-cols-3">
      {metrics.map(([label, value]) => <div key={label} className="panel grid gap-1">
        <dt className="text-muted">{label}</dt>
        <dd className="text-3xl font-bold">{value}</dd>
      </div>)}
    </dl>
    <div className="grid gap-4 md:grid-cols-2">
      <DemoAgenda corporate />
      <section className="panel grid content-start gap-4">
        <h2 className="text-xl font-semibold">Equipe da clínica</h2>
        <ul className="grid gap-3">
          <li className="grid gap-1 rounded-xl bg-background p-4"><strong>Marina Demo</strong><span>Psicologia</span></li>
          <li className="grid gap-1 rounded-xl bg-background p-4"><strong>Rafael Demo</strong><span>Fonoaudiologia</span></li>
        </ul>
      </section>
    </div>
  </>;
}

function FamilyPreview() {
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <DemoAgenda corporate={false} />
      <div className="grid gap-4">
        <section className="panel grid gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Heart aria-hidden="true" size={21} className="text-primary" /> Controle parental</h2>
          <dl className="grid gap-2">
            <div className="flex flex-wrap justify-between gap-2"><dt>PixelBloom Kids</dt><dd className="font-medium text-accent">Ativo</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt>Compartilhar emoções</dt><dd className="font-medium text-accent">Autorizado</dd></div>
          </dl>
          <p className="rounded-xl bg-background p-3">Último registro de Alex Demo: <strong>Tranquilo</strong>.</p>
        </section>
        <section className="panel grid gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Gift aria-hidden="true" size={21} className="text-primary" /> Loja de prêmios</h2>
          <p className="text-muted">Saldo de demonstração: 40 pontos</p>
          <p className="rounded-xl bg-background p-3"><strong>Kit de desenho personalizado</strong> · 20 pontos</p>
        </section>
      </div>
    </div>
  );
}

export default async function DemoPage({ params }: { params: Promise<{ portal: string }> }) {
  const portal = parseLoginPortal((await params).portal);
  if (!portal) notFound();
  const corporate = portal === "corporativo";
  const Icon = corporate ? Building2 : HeartHandshake;

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/login" className="flex items-center gap-2 text-lg font-bold text-primary">
          <Flower2 aria-hidden="true" size={24} /> PixelBloom
        </Link>
        <nav aria-label="Demonstrações" className="flex flex-wrap gap-2">
          <Link className={corporate ? "button" : "button-secondary"} aria-current={corporate ? "page" : undefined} href="/demo/corporativo">Corporativo</Link>
          <Link className={corporate ? "button-secondary" : "button"} aria-current={corporate ? undefined : "page"} href="/demo/familia">Família</Link>
        </nav>
      </header>
      <section className="panel grid gap-2">
        <Icon aria-hidden="true" size={26} className="text-primary" />
        <h1 className="text-2xl font-bold sm:text-3xl">{corporate ? "Painel corporativo" : "Área de pacientes e responsáveis"}</h1>
        <p className="text-muted">Demonstração com dados fictícios e somente leitura.</p>
      </section>
      {corporate ? <CorporatePreview /> : <FamilyPreview />}
    </main>
  );
}
