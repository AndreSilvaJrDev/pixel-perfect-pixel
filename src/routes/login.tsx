import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Professor Play" },
      { name: "description", content: "Acesse sua conta de professor no Professor Play." },
      { property: "og:title", content: "Entrar — Professor Play" },
      { property: "og:description", content: "Acesse sua conta de professor no Professor Play." },
    ],
  }),
  component: () => <AuthCard mode="login" />,
});
