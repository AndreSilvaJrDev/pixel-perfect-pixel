import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const CHECKOUT_URL = "https://pay.kiwify.com.br/pi0O1jt";

export function FinalCta() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] sm:p-12">
          <h2 className="max-w-3xl text-balance-tight text-3xl font-extrabold sm:text-4xl">
            Transforme qualquer matéria em um jogo que seus alunos podem jogar pelo celular em
            poucos segundos.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Professor Play Completo por R$ 27,90, em pagamento único. IA para criação de atividades
            educacionais sujeita à Política de Uso Justo e aos limites técnicos de segurança.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            No checkout, você também pode adicionar o Pack Alunos Campeões por R$ 9,90.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="highlight" size="xl">
              <a href={CHECKOUT_URL}>Quero transformar minhas aulas em jogos</a>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link to="/jogar">Sou aluno, quero entrar</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
