import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Professor Play" },
      {
        name: "description",
        content: "Crie sua conta de professor e monte seu primeiro jogo em minutos.",
      },
      { property: "og:title", content: "Criar conta — Professor Play" },
      {
        property: "og:description",
        content: "Crie sua conta de professor e monte seu primeiro jogo em minutos.",
      },
    ],
  }),
  component: () => <AuthCard mode="cadastro" />,
});
