import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  Gamepad2,
  Gift,
  Library,
  LockKeyhole,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth, displayName } from "@/hooks/useAuth";
import { activitiesQuery, dashboardStatsQuery } from "@/lib/activities";
import { StatCard } from "@/components/app/StatCard";
import { ActivityCard } from "@/components/app/ActivityCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import dashboardArena from "@/assets/dashboard-arena-v2.png";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Painel do professor — Professor Play" },
      { name: "description", content: "Suas atividades, partidas e resultados em um só lugar." },
      { property: "og:title", content: "Painel do professor — Professor Play" },
      {
        property: "og:description",
        content: "Suas atividades, partidas e resultados em um só lugar.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const stats = useQuery(dashboardStatsQuery);
  const activities = useQuery(activitiesQuery);

  return (
    <div className="space-y-8">
      <section className="relative grid overflow-hidden rounded-[2rem] bg-[#172554] px-6 py-7 text-white shadow-[var(--shadow-lift)] sm:px-8 sm:py-9 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-24 size-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative z-10 min-w-0 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-50 backdrop-blur">
            <Sparkles className="size-3.5 text-yellow-300" aria-hidden="true" />
            Seu espaço de criação
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Olá, {displayName(user)}!
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100 sm:text-base">
            Transforme o próximo conteúdo da sua aula em uma experiência que seus alunos vão querer jogar.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="border-0 bg-white text-blue-700 shadow-lg hover:bg-blue-50">
              <Link to="/app/criar">
                <Plus className="size-4" aria-hidden="true" />
                Criar nova atividade
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link to="/app/biblioteca">
                <BookOpen className="size-4" aria-hidden="true" />
                Abrir biblioteca
              </Link>
            </Button>
          </div>
        </div>
        <img src={dashboardArena} alt="" width={1536} height={1024} className="mt-5 w-full rounded-2xl object-contain lg:mt-0" decoding="async" />
      </section>

      {stats.isError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-5">
          <p>Não foi possível carregar o resumo da turma.</p>
          <Button variant="outline" className="mt-3" onClick={() => void stats.refetch()}>Tentar novamente</Button>
        </div>
      ) : stats.isPending ? (
        <div role="status" aria-label="Carregando estatísticas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-2xl" />)}
        </div>
      ) : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Library} label="Atividades criadas" value={stats.data?.activities ?? 0} />
        <StatCard icon={Gamepad2} label="Partidas realizadas" value={stats.data?.sessions ?? 0} />
        <StatCard icon={Users} label="Alunos participantes" value={stats.data?.players ?? 0} />
        <StatCard
          icon={BarChart3}
          label="Média de acertos"
          value={`${stats.data?.accuracy ?? 0}%`}
          hint="Atualiza depois da primeira partida"
        />
      </div>}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-primary">Próximo passo</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold">Prepare uma nova partida</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Escolha um tema, revise as perguntas e compartilhe o código com a turma.
              </p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-highlight/25 text-highlight-foreground">
              <Gamepad2 className="size-5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Escolha o tema"],
              ["02", "Monte o desafio"],
              ["03", "Jogue com a turma"],
            ].map(([step, label]) => (
              <div key={step} className="rounded-2xl bg-surface p-3">
                <span className="text-xs font-extrabold text-primary">{step}</span>
                <p className="mt-2 text-sm font-bold">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="absolute -right-10 -top-10 size-32 rounded-full bg-violet-200/50 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-extrabold text-violet-700">
                <Gift className="size-3.5" aria-hidden="true" />
                Recursos premium
              </span>
              <LockKeyhole className="size-4 text-violet-400" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-xl font-extrabold">Mais motivos para comemorar</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Medalhas, certificados e recompensas para destacar os alunos vencedores.
            </p>
            <p className="mt-5 text-sm font-bold text-primary">Em breve · Pack de recompensas</p>
            <p className="mt-1 text-xs text-muted-foreground">Prévia de um futuro complemento. Ainda não disponível para compra.</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Atividades recentes</h2>
          <Link to="/app/biblioteca" className="text-sm font-semibold text-primary hover:underline">
            Ver todas
          </Link>
        </div>

        {activities.isError ? (
          <div role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-card p-5">
            <p>Não foi possível carregar suas atividades. Seus dados não foram apagados.</p>
            <Button variant="outline" className="mt-3" onClick={() => void activities.refetch()}>Tentar novamente</Button>
          </div>
        ) : activities.isPending ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : activities.data && activities.data.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activities.data.slice(0, 6).map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-bold">Você ainda não tem atividades</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie a primeira e veja como seus alunos entram pelo celular.
            </p>
            <Button asChild variant="hero" className="mt-5">
              <Link to="/app/criar">Criar atividade</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
