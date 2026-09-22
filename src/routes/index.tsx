import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { GameModes } from "@/components/landing/GameModes";
import { FinalCta } from "@/components/landing/FinalCta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Professor Play — Transforme sua aula em jogo" },
      {
        name: "description",
        content:
          "Escolha o conteúdo, deixe a IA criar as perguntas e seus alunos entram pelo celular com um QR Code.",
      },
      { property: "og:title", content: "Professor Play — Transforme sua aula em jogo" },
      {
        property: "og:description",
        content:
          "Crie um jogo a partir de qualquer matéria e seus alunos jogam pelo celular em segundos.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <GameModes />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
