import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

type Mode = "login" | "cadastro";

export function AuthCard({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const isSignup = mode === "cadastro";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Bem-vindo ao Professor Play.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await navigate({ to: "/app" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível continuar.";
      toast.error(
        message.includes("Invalid login credentials") ? "E-mail ou senha incorretos." : message,
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    await navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="text-2xl font-extrabold">
            {isSignup ? "Criar conta de professor" : "Entrar"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "Leva menos de um minuto. Depois é só criar seu primeiro jogo."
              : "Bom te ver de novo. Vamos jogar?"}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Seu nome</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex.: Ana Souza"
                  className="h-12"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@escola.com"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="h-12"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isSignup ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Continuar com o Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Já tem conta?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Entrar
                </Link>
              </>
            ) : (
              <>
                Ainda não tem conta?{" "}
                <Link to="/cadastro" className="font-semibold text-primary hover:underline">
                  Criar conta
                </Link>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          É aluno?{" "}
          <Link to="/jogar" className="font-semibold text-foreground hover:underline">
            Entrar em um jogo com PIN
          </Link>
        </p>
      </div>
    </div>
  );
}
