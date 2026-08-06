import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, BookOpen, Wallet, UserPlus, Wallet2, NotebookPen, Building2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — JAU ERP" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: userCount } = useQuery({
    queryKey: ["profiles-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: alunosAtivos } = useQuery({
    queryKey: ["dash-alunos-ativos"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alunos")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "Ativo");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: cursosAtivos } = useQuery({
    queryKey: ["dash-cursos-ativos"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cursos")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("ativo", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: mensalidadesMes } = useQuery({
    queryKey: ["dash-mensalidades-mes"],
    queryFn: async () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("mensalidades")
        .select("valor")
        .is("deleted_at", null)
        .gte("vencimento", first)
        .lte("vencimento", last);
      if (error) throw error;
      return (data ?? []).reduce((acc, m) => acc + Number(m.valor ?? 0), 0);
    },
  });

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const stats = [
    { label: "Alunos ativos", value: alunosAtivos ?? "—", icon: GraduationCap, hint: "com status Ativo" },
    { label: "Cursos oferecidos", value: cursosAtivos ?? "—", icon: BookOpen, hint: "cursos ativos" },
    {
      label: "Mensalidades do mês",
      value: mensalidadesMes === undefined ? "—" : brl(mensalidadesMes),
      icon: Wallet,
      hint: "vencimentos no mês atual",
    },
    { label: "Usuários do sistema", value: userCount ?? "—", icon: Users, hint: "cadastrados" },
  ];

  const atalhos = [
    { label: "Nova matrícula", to: "/matriculas", icon: UserPlus },
    { label: "Financeiro", to: "/financeiro", icon: Wallet2 },
    { label: "Diário de classe", to: "/diario", icon: NotebookPen },
    { label: "Empresas B2B", to: "/estrutura", icon: Building2 },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Visão geral da operação da escola." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <Card key={label} className="border-border/70">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Atalhos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {atalhos.map(({ label, to, icon: Icon }) => (
            <Button key={to} asChild variant="outline">
              <Link to={to}>
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}