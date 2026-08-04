import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { AccessGuard } from "@/components/access-guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Portal do Aluno — JAU ERP" },
      { name: "description", content: "Boletim, frequência e financeiro do aluno em um só lugar." },
      { property: "og:title", content: "Portal do Aluno — JAU ERP" },
      { property: "og:description", content: "Acompanhe notas, frequência e mensalidades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccessGuard resource="portal">
      <PortalPage />
    </AccessGuard>
  ),
});

type AlunoOption = { id: string; nome: string; codigo_publico: string | null };

const currency = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
};

function useMeusAlunos() {
  return useQuery({
    queryKey: ["portal-meus-alunos"],
    queryFn: async (): Promise<AlunoOption[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email?.toLowerCase();
      if (!email) return [];

      const { data: responsaveis } = await supabase
        .from("responsaveis")
        .select("id")
        .ilike("email", email);

      const respIds = (responsaveis ?? []).map((r) => r.id);
      if (respIds.length === 0) return [];

      const { data: vinculos } = await supabase
        .from("aluno_responsavel")
        .select("aluno_id")
        .in("responsavel_id", respIds);

      const alunoIds = Array.from(new Set((vinculos ?? []).map((v) => v.aluno_id)));
      if (alunoIds.length === 0) return [];

      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, codigo_publico")
        .in("id", alunoIds)
        .is("deleted_at", null);

      return alunos ?? [];
    },
    staleTime: 60_000,
  });
}

function useTodosAlunos(enabled: boolean) {
  return useQuery({
    queryKey: ["portal-todos-alunos"],
    enabled,
    queryFn: async (): Promise<AlunoOption[]> => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, codigo_publico")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useBoletim(alunoId: string | null) {
  return useQuery({
    queryKey: ["portal-boletim", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data: matriculas } = await supabase
        .from("matriculas")
        .select("id, turma_id, ano_letivo, status")
        .eq("aluno_id", alunoId as string)
        .is("deleted_at", null)
        .order("ano_letivo", { ascending: false });

      const turmaIds = Array.from(new Set((matriculas ?? []).map((m) => m.turma_id)));
      if (turmaIds.length === 0) return [] as { disciplina: string; notas: { titulo: string; nota: number | null; notaMaxima: number }[]; media: number | null }[];

      const { data: disciplinas } = await supabase
        .from("disciplinas")
        .select("id, nome, turma_id")
        .in("turma_id", turmaIds)
        .is("deleted_at", null);

      const disciplinaIds = (disciplinas ?? []).map((d) => d.id);

      const { data: avaliacoes } = await supabase
        .from("avaliacoes")
        .select("id, titulo, disciplina_id, data_avaliacao, peso, nota_maxima")
        .in("disciplina_id", disciplinaIds.length ? disciplinaIds : ["00000000-0000-0000-0000-000000000000"])
        .is("deleted_at", null);

      const avaliacaoIds = (avaliacoes ?? []).map((a) => a.id);

      const { data: notas } = await supabase
        .from("avaliacao_notas")
        .select("avaliacao_id, nota")
        .eq("aluno_id", alunoId as string)
        .in("avaliacao_id", avaliacaoIds.length ? avaliacaoIds : ["00000000-0000-0000-0000-000000000000"]);

      const notaByAvaliacao = new Map((notas ?? []).map((n) => [n.avaliacao_id, n.nota]));

      return (disciplinas ?? []).map((d) => {
        const avals = (avaliacoes ?? []).filter((a) => a.disciplina_id === d.id);
        const notasList = avals.map((a) => ({
          titulo: a.titulo,
          nota: notaByAvaliacao.get(a.id) ?? null,
          notaMaxima: a.nota_maxima ?? 10,
        }));
        const validas = notasList.filter((n) => n.nota !== null) as { nota: number }[];
        const media = validas.length
          ? validas.reduce((sum, n) => sum + Number(n.nota), 0) / validas.length
          : null;
        return { disciplina: d.nome, notas: notasList, media };
      });
    },
  });
}

function useFrequencia(alunoId: string | null) {
  return useQuery({
    queryKey: ["portal-frequencia", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data: matriculas } = await supabase
        .from("matriculas")
        .select("turma_id")
        .eq("aluno_id", alunoId as string)
        .is("deleted_at", null);

      const turmaIds = Array.from(new Set((matriculas ?? []).map((m) => m.turma_id)));
      if (turmaIds.length === 0) return { registros: [] as { data: string; situacao: string }[], percentual: null as number | null };

      const { data: diarios } = await supabase
        .from("diario_classe")
        .select("id, data_aula, turma_id")
        .in("turma_id", turmaIds)
        .is("deleted_at", null)
        .order("data_aula", { ascending: false })
        .limit(200);

      const diarioIds = (diarios ?? []).map((d) => d.id);

      const { data: chamadas } = await supabase
        .from("diario_chamada")
        .select("diario_id, situacao")
        .eq("aluno_id", alunoId as string)
        .in("diario_id", diarioIds.length ? diarioIds : ["00000000-0000-0000-0000-000000000000"]);

      const situacaoByDiario = new Map((chamadas ?? []).map((c) => [c.diario_id, c.situacao]));

      const registros = (diarios ?? [])
        .filter((d) => situacaoByDiario.has(d.id))
        .map((d) => ({ data: d.data_aula, situacao: situacaoByDiario.get(d.id) as string }))
        .slice(0, 30);

      const total = registros.length;
      const presencas = registros.filter((r) => (r.situacao ?? "").toLowerCase().includes("presen")).length;
      const percentual = total > 0 ? (presencas / total) * 100 : null;

      return { registros, percentual };
    },
  });
}

function useFinanceiro(alunoId: string | null) {
  return useQuery({
    queryKey: ["portal-financeiro", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensalidades")
        .select("id, codigo_publico, descricao, competencia, valor, vencimento, status, data_pagamento, valor_pago")
        .eq("aluno_id", alunoId as string)
        .is("deleted_at", null)
        .order("vencimento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function statusBadgeVariant(status: string) {
  const s = status.toLowerCase();
  if (s.includes("pago")) return "default" as const;
  if (s.includes("atras") || s.includes("venc")) return "destructive" as const;
  return "secondary" as const;
}

function situacaoBadgeVariant(situacao: string) {
  const s = situacao.toLowerCase();
  if (s.includes("presen")) return "default" as const;
  if (s.includes("falta") || s.includes("ausente")) return "destructive" as const;
  return "secondary" as const;
}

function isOverdue(m: { status: string; vencimento: string }) {
  const s = m.status.toLowerCase();
  if (s.includes("pago")) return false;
  const venc = new Date(`${m.vencimento}T00:00:00`);
  return venc.getTime() < Date.now();
}

function PortalPage() {
  const { data: isAdmin } = useIsAdmin();
  const { data: meusAlunos, isLoading: loadingMeus } = useMeusAlunos();
  const { data: todosAlunos, isLoading: loadingTodos } = useTodosAlunos(!!isAdmin && (meusAlunos?.length ?? 0) === 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const alunos = (meusAlunos && meusAlunos.length > 0) ? meusAlunos : [];
  const alunoAtual = useMemo(() => {
    if (alunos.length === 0) return null;
    return alunos.find((a) => a.id === selectedId) ?? alunos[0];
  }, [alunos, selectedId]);

  const previewMode = alunos.length === 0 && !!isAdmin;
  const previewAluno = previewMode ? (todosAlunos ?? []).find((a) => a.id === selectedId) ?? null : null;

  const alunoId = alunoAtual?.id ?? previewAluno?.id ?? null;

  const { data: boletim, isLoading: loadingBoletim } = useBoletim(alunoId);
  const { data: frequencia, isLoading: loadingFrequencia } = useFrequencia(alunoId);
  const { data: financeiro, isLoading: loadingFinanceiro } = useFinanceiro(alunoId);

  const loadingInicial = loadingMeus || (previewMode && loadingTodos);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal do Aluno e Responsável"
        description="Acompanhe boletim, frequência e financeiro em um só lugar."
      />

      {loadingInicial ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : alunos.length > 0 ? (
        <>
          {alunos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {alunos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    alunoAtual?.id === a.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {a.nome}
                </button>
              ))}
            </div>
          )}
          {alunoId && (
            <PortalConteudo
              alunoNome={alunoAtual?.nome ?? ""}
              boletim={boletim}
              loadingBoletim={loadingBoletim}
              frequencia={frequencia}
              loadingFrequencia={loadingFrequencia}
              financeiro={financeiro}
              loadingFinanceiro={loadingFinanceiro}
            />
          )}
        </>
      ) : previewMode ? (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sua conta de administrador não está vinculada a um aluno. Selecione um aluno abaixo para pré-visualizar o portal.
            </p>
            <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Selecione um aluno" />
              </SelectTrigger>
              <SelectContent>
                {(todosAlunos ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
          {alunoId && (
            <PortalConteudo
              alunoNome={previewAluno?.nome ?? ""}
              boletim={boletim}
              loadingBoletim={loadingBoletim}
              frequencia={frequencia}
              loadingFrequencia={loadingFrequencia}
              financeiro={financeiro}
              loadingFinanceiro={loadingFinanceiro}
            />
          )}
        </div>
      ) : (
        <Card className="p-6 text-center space-y-2">
          <p className="text-base font-medium text-foreground">Nenhum aluno vinculado à sua conta</p>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não está associada a nenhum aluno. Entre em contato com a secretaria da escola para vincular
            seu cadastro de responsável ao(s) aluno(s).
          </p>
        </Card>
      )}
    </div>
  );
}

function PortalConteudo({
  alunoNome,
  boletim,
  loadingBoletim,
  frequencia,
  loadingFrequencia,
  financeiro,
  loadingFinanceiro,
}: {
  alunoNome: string;
  boletim: ReturnType<typeof useBoletim>["data"];
  loadingBoletim: boolean;
  frequencia: ReturnType<typeof useFrequencia>["data"];
  loadingFrequencia: boolean;
  financeiro: ReturnType<typeof useFinanceiro>["data"];
  loadingFinanceiro: boolean;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{alunoNome}</h2>
      <Tabs defaultValue="boletim">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="boletim">Boletim</TabsTrigger>
          <TabsTrigger value="frequencia">Frequência</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="boletim" className="mt-4 space-y-4">
          {loadingBoletim ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : !boletim || boletim.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma disciplina encontrada.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boletim.map((d) => (
                <Card key={d.disciplina} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-foreground">{d.disciplina}</h3>
                    <Badge variant={d.media !== null && d.media >= 6 ? "default" : "secondary"}>
                      Média: {d.media !== null ? d.media.toFixed(1) : "—"}
                    </Badge>
                  </div>
                  {d.notas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem avaliações lançadas.</p>
                  ) : (
                    <ul className="space-y-1">
                      {d.notas.map((n, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{n.titulo}</span>
                          <span className="font-medium text-foreground">
                            {n.nota !== null ? n.nota : "—"} / {n.notaMaxima}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="frequencia" className="mt-4 space-y-4">
          {loadingFrequencia ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <Card className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Percentual de presença</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {frequencia?.percentual !== null && frequencia?.percentual !== undefined
                      ? `${frequencia.percentual.toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
              </Card>
              <Card className="divide-y divide-border">
                {!frequencia || frequencia.registros.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Nenhum registro de chamada encontrado.</p>
                ) : (
                  frequencia.registros.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-foreground">{formatDate(r.data)}</span>
                      <Badge variant={situacaoBadgeVariant(r.situacao)}>{r.situacao}</Badge>
                    </div>
                  ))
                )}
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4 space-y-4">
          {loadingFinanceiro ? (
            <Skeleton className="h-40" />
          ) : !financeiro || financeiro.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma mensalidade encontrada.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {financeiro.map((m) => {
                const overdue = isOverdue(m);
                return (
                  <Card
                    key={m.id}
                    className={`p-4 space-y-2 ${overdue ? "border-destructive/50 bg-destructive/5" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{m.competencia}</span>
                      <Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.descricao}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Vencimento: {formatDate(m.vencimento)}</span>
                      <span className="font-medium text-foreground">{currency(m.valor)}</span>
                    </div>
                    {overdue && <p className="text-xs font-medium text-destructive">Pagamento em atraso</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
