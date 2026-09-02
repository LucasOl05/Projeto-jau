import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalDashboard, PortalLoginForm } from "@/components/portal-publico-shared";
import type { PortalSessao } from "@/lib/portal-publico.server";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso — JAU ERP" },
      { name: "description", content: "Acesse o sistema de gestão da JAU ou o portal do aluno e responsável." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email({ message: "E-mail inválido" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Mínimo 8 caracteres" })
  .max(72, { message: "Máximo 72 caracteres" });
const nameSchema = z.string().trim().min(2, { message: "Informe seu nome" }).max(100);

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showSignInPw, setShowSignInPw] = useState(false);
  const [showSignUpPw, setShowSignUpPw] = useState(false);
  const [portalSessao, setPortalSessao] = useState<PortalSessao | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setCheckingSession(false);
      }
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(form.get("email"));
    const password = passwordSchema.safeParse(form.get("password"));
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.data,
      password: password.data,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha inválidos" : error.message);
      return;
    }
    toast.success("Bem-vindo(a) ao JAU ERP");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = nameSchema.safeParse(form.get("name"));
    const email = emailSchema.safeParse(form.get("email"));
    const password = passwordSchema.safeParse(form.get("password"));
    if (!name.success) return toast.error(name.error.issues[0].message);
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: name.data },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada. Você já pode entrar.");
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (portalSessao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/40 px-4 py-8">
        <PortalDashboard sessao={portalSessao} onLogout={() => setPortalSessao(null)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/40 px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <BrandLogo size={44} />
          <div className="text-left">
            <div className="text-lg font-semibold leading-tight text-foreground">JAU ERP</div>
            <div className="text-xs text-muted-foreground">Jovem Aprendiz Uberlândia</div>
          </div>
        </Link>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Acesso ao sistema</CardTitle>
            <CardDescription>Equipe, alunos e responsáveis em um só lugar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="portal">Portal</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-mail</Label>
                    <Input id="signin-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        name="password"
                        type={showSignInPw ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPw((v) => !v)}
                        aria-label={showSignInPw ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showSignInPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">Uso restrito à equipe da escola.</p>
                </form>
              </TabsContent>

              <TabsContent value="portal" className="mt-4">
                <PortalLoginForm onSuccess={setPortalSessao} />
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <Input id="signup-name" name="name" type="text" autoComplete="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="password"
                        type={showSignUpPw ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPw((v) => !v)}
                        aria-label={showSignUpPw ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showSignUpPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
