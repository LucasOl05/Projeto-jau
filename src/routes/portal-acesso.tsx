import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import type { PortalSessao } from "@/lib/portal-publico.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";
import { PortalDashboard, PortalLoginForm } from "@/components/portal-publico-shared";

export const Route = createFileRoute("/portal-acesso")({
  head: () => ({
    meta: [
      { title: "Portal do Aluno — Acesso rápido | JAU" },
      {
        name: "description",
        content: "Consulte mensalidades, links de pagamento e frequência usando CPF ou RA e data de nascimento.",
      },
      { property: "og:title", content: "Portal do Aluno — Acesso rápido | JAU" },
      { property: "og:description", content: "Extrato financeiro e frequência do aluno sem precisar de senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalAcessoPage,
});

function PortalAcessoPage() {
  const [sessao, setSessao] = useState<PortalSessao | null>(null);

  if (sessao) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-8">
        <PortalDashboard sessao={sessao} onLogout={() => setSessao(null)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Portal do Aluno e Responsável</CardTitle>
          </CardHeader>
          <CardContent>
            <PortalLoginForm onSuccess={setSessao} />
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          É da equipe da escola?{" "}
          <Link to="/auth" className="underline underline-offset-4">
            Entrar com e-mail e senha
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          É empresa parceira?{" "}
          <Link to="/portal-empresa" className="underline underline-offset-4">
            Portal da Empresa
          </Link>
        </p>
      </div>
    </div>
  );
}
