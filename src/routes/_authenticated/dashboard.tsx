import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, BookOpen, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const stats = [
    { label: "Usuários do sistema", value: userCount ?? "—", icon: Users, hint: "cadastrados" },
    { label: "Alunos ativos", value: "—", icon: GraduationCap, hint: "em breve" },
    { label: "Cursos oferecidos", value: "—", icon: BookOpen, hint: "em breve" },
    { label: "Mensalidades do mês", value: "—", icon: Wallet, hint: "em breve" },
  ];

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
          <CardTitle className="text-base">Próximos módulos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          O módulo <strong className="text-foreground">Usuários e Permissões</strong> foi ativado.
          Módulos disponíveis para desenvolvimento: Alunos e Matrículas, Cursos e Turmas, Financeiro.
          Peça para o assistente ativar o próximo módulo quando quiser.
        </CardContent>
      </Card>
    </div>
  );
}