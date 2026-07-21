import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, X, Save, Info } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({ meta: [{ title: "Diário de Classe — JAU ERP" }] }),
  component: DiarioPage,
});

type Turma = { id: string; nome: string; codigo_publico: string | null };
type Disciplina = { id: string; nome: string; turma_id: string; codigo_publico: string | null };
type Aluno = { id: string; nome: string; matricula: number };

const todayISO = () => new Date().toISOString().slice(0, 10);

function DiarioPage() {
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();

  const [turmaId, setTurmaId] = useState<string>("");
  const [disciplinaId, setDisciplinaId] = useState<string>("");
  const [dataAula, setDataAula] = useState<string>(todayISO());

  const [conteudo, setConteudo] = useState("");
  const [planejamento, setPlanejamento] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});

  const isRetroativo = dataAula < todayISO();
  const needsJustificativa = isAdmin && isRetroativo;

  // Turmas
  const turmasQuery = useQuery({
    queryKey: ["turmas-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas")
        .select("id, nome, codigo_publico")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
  });

  // Disciplinas da turma
  const disciplinasQuery = useQuery({
    queryKey: ["disciplinas", turmaId],
    enabled: !!turmaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplinas")
        .select("id, nome, turma_id, codigo_publico")
        .eq("turma_id", turmaId)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Disciplina[];
    },
  });

  // Alunos ativos (não temos vínculo aluno-turma ainda; lista alunos com status Ativo)
  const alunosQuery = useQuery({
    queryKey: ["alunos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, matricula, status")
        .in("status", ["Ativo", "Pendente"])
        .order("nome");
      if (error) throw error;
      return (data ?? []) as (Aluno & { status: string })[];
    },
  });

  // Diário existente para (turma, disciplina, data)
  const diarioQuery = useQuery({
    queryKey: ["diario", turmaId, disciplinaId, dataAula],
    enabled: !!turmaId && !!disciplinaId && !!dataAula,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_classe")
        .select("*, diario_chamada(aluno_id, presente)")
        .eq("turma_id", turmaId)
        .eq("disciplina_id", disciplinaId)
        .eq("data_aula", dataAula)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const d = diarioQuery.data as any;
    if (d) {
      setConteudo(d.conteudo_ministrado ?? "");
      setPlanejamento(d.planejamento_proxima_aula ?? "");
      setJustificativa(d.justificativa_retroativa ?? "");
      const map: Record<string, boolean> = {};
      (d.diario_chamada ?? []).forEach((c: any) => (map[c.aluno_id] = c.presente));
      setPresencas(map);
    } else {
      setConteudo("");
      setPlanejamento("");
      setJustificativa("");
      setPresencas({});
    }
  }, [diarioQuery.data]);

  // Faltas recentes por aluno na disciplina — para badge de evasão
  const faltasQuery = useQuery({
    queryKey: ["faltas-recentes", turmaId, disciplinaId],
    enabled: !!turmaId && !!disciplinaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_chamada")
        .select("aluno_id, presente, diario_classe!inner(data_aula, disciplina_id, turma_id, deleted_at)")
        .eq("diario_classe.disciplina_id", disciplinaId)
        .eq("diario_classe.turma_id", turmaId)
        .is("diario_classe.deleted_at", null)
        .order("data_aula", { referencedTable: "diario_classe", ascending: false })
        .limit(500);
      if (error) throw error;
      // Conta faltas consecutivas mais recentes por aluno
      const byAluno: Record<string, { data: string; presente: boolean }[]> = {};
      for (const r of (data ?? []) as any[]) {
        (byAluno[r.aluno_id] ??= []).push({
          data: r.diario_classe.data_aula,
          presente: r.presente,
        });
      }
      const alerts: Record<string, number> = {};
      for (const [aid, rows] of Object.entries(byAluno)) {
        rows.sort((a, b) => (a.data < b.data ? 1 : -1));
        let streak = 0;
        for (const r of rows) {
          if (!r.presente) streak++;
          else break;
        }
        if (streak >= 3) alerts[aid] = streak;
      }
      return alerts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!turmaId || !disciplinaId || !dataAula) throw new Error("Selecione turma, disciplina e data.");
      if (!conteudo.trim()) throw new Error("Informe o conteúdo ministrado.");
      if (!planejamento.trim()) throw new Error("Informe o planejamento da próxima aula.");
      if (needsJustificativa && justificativa.trim().length < 5)
        throw new Error("Justificativa obrigatória (mínimo 5 caracteres) para edição retroativa.");

      const existing = diarioQuery.data as any;
      let diarioId = existing?.id as string | undefined;

      if (diarioId) {
        const { error } = await supabase
          .from("diario_classe")
          .update({
            conteudo_ministrado: conteudo,
            planejamento_proxima_aula: planejamento,
            justificativa_retroativa: needsJustificativa ? justificativa : existing.justificativa_retroativa,
          })
          .eq("id", diarioId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("diario_classe")
          .insert({
            turma_id: turmaId,
            disciplina_id: disciplinaId,
            data_aula: dataAula,
            conteudo_ministrado: conteudo,
            planejamento_proxima_aula: planejamento,
            justificativa_retroativa: needsJustificativa ? justificativa : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        diarioId = data.id;
      }

      // Upsert chamada
      const rows = Object.entries(presencas).map(([aluno_id, presente]) => ({
        diario_id: diarioId!,
        aluno_id,
        presente,
      }));
      if (rows.length > 0) {
        const { error } = await supabase
          .from("diario_chamada")
          .upsert(rows, { onConflict: "diario_id,aluno_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Diário salvo.");
      qc.invalidateQueries({ queryKey: ["diario"] });
      qc.invalidateQueries({ queryKey: ["faltas-recentes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const canWrite = true; // RLS + triggers decidem no banco; UI mostra erro se bloqueado
  const alunos = alunosQuery.data ?? [];
  const faltas = faltasQuery.data ?? {};

  const setPresenca = (id: string, v: boolean) => setPresencas((p) => ({ ...p, [id]: v }));

  const total = alunos.length;
  const presentes = useMemo(() => alunos.filter((a) => presencas[a.id] === true).length, [alunos, presencas]);
  const faltosos = useMemo(() => alunos.filter((a) => presencas[a.id] === false).length, [alunos, presencas]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diário de Classe"
        description="Registro de conteúdo, planejamento e frequência dos alunos."
      />

      {/* Filtros encadeados */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Turma</Label>
            <Select value={turmaId} onValueChange={(v) => { setTurmaId(v); setDisciplinaId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
              <SelectContent>
                {(turmasQuery.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.codigo_publico ? `${t.codigo_publico} — ` : ""}{t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Disciplina</Label>
            <Select value={disciplinaId} onValueChange={setDisciplinaId} disabled={!turmaId}>
              <SelectTrigger>
                <SelectValue placeholder={turmaId ? "Selecione a disciplina" : "Escolha a turma primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {(disciplinasQuery.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.codigo_publico ? `${d.codigo_publico} — ` : ""}{d.nome}
                  </SelectItem>
                ))}
                {disciplinasQuery.data?.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhuma disciplina cadastrada para esta turma.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data da aula</Label>
            <Input type="date" value={dataAula} onChange={(e) => setDataAula(e.target.value)} />
          </div>
        </div>

        {isRetroativo && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Data retroativa selecionada. {isAdmin
                ? "Como administrador, você pode editar, mas é obrigatório justificar."
                : "Somente administradores podem lançar/editar em datas anteriores."}
            </div>
          </div>
        )}
      </Card>

      {!turmaId || !disciplinaId ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Selecione turma e disciplina para lançar o diário.
        </Card>
      ) : (
        <>
          {/* Conteúdo pedagógico */}
          <Card className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Conteúdo ministrado *</Label>
                <Textarea
                  rows={5}
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Resumo do tema abordado hoje..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Planejamento da próxima aula *</Label>
                <Textarea
                  rows={5}
                  value={planejamento}
                  onChange={(e) => setPlanejamento(e.target.value)}
                  placeholder="Assunto do próximo encontro..."
                />
              </div>
            </div>

            {needsJustificativa && (
              <div className="space-y-1.5">
                <Label className="text-amber-700 dark:text-amber-400">Justificativa da edição retroativa *</Label>
                <Textarea
                  rows={2}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Explique o motivo da edição em data anterior..."
                />
              </div>
            )}
          </Card>

          {/* Lista de chamada */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Lista de chamada</h2>
                <p className="text-xs text-muted-foreground">
                  {total} alunos · {presentes} presentes · {faltosos} faltas
                </p>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canWrite}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Salvando..." : "Salvar diário"}
              </Button>
            </div>

            {alunosQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : alunos.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhum aluno ativo.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {alunos.map((a) => {
                  const state = presencas[a.id];
                  const streak = faltas[a.id];
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{a.nome}</span>
                        <span className="text-xs text-muted-foreground">#{a.matricula}</span>
                        {streak && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Atenção: {streak}+ faltas consecutivas
                          </Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant={state === true ? "default" : "outline"}
                          className={state === true ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}
                          onClick={() => setPresenca(a.id, true)}
                        >
                          <Check className="mr-1 h-4 w-4" /> Presença
                        </Button>
                        <Button
                          size="sm"
                          variant={state === false ? "default" : "outline"}
                          className={state === false ? "bg-red-600 text-white hover:bg-red-700" : ""}
                          onClick={() => setPresenca(a.id, false)}
                        >
                          <X className="mr-1 h-4 w-4" /> Falta
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
