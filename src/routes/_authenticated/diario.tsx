import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, X, Save, Info, Plus, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessGuard } from "@/components/access-guard";
import { useNotasHabilitadas } from "@/hooks/use-permissions";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({
    meta: [
      { title: "Diário de Classe — JAU ERP" },
      { name: "description", content: "Frequência, plano de aula e avaliações por turma e disciplina." },
      { property: "og:title", content: "Diário de Classe — JAU ERP" },
      { property: "og:description", content: "Chamada, conteúdo ministrado e notas opcionais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccessGuard resource="diario">
      <DiarioPage />
    </AccessGuard>
  ),
});

type Turma = { id: string; nome: string; codigo_publico: string | null };
type Disciplina = {
  id: string;
  nome: string;
  codigo_publico: string | null;
  professores: { nome: string } | null;
};
type AlunoMat = { id: string; nome: string; codigo_publico: string | null };
type Situacao = "Presente" | "Falta" | "Justificada";

const todayISO = () => new Date().toISOString().slice(0, 10);

function DiarioPage() {
  const { data: isAdmin } = useIsAdmin();
  const { data: notasHabilitadas } = useNotasHabilitadas();
  const qc = useQueryClient();

  const [turmaId, setTurmaId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [dataAula, setDataAula] = useState(todayISO());

  const [conteudo, setConteudo] = useState("");
  const [planejamento, setPlanejamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [tipoAula, setTipoAula] = useState<"Normal" | "Reposição">("Normal");
  const [dataOriginal, setDataOriginal] = useState("");
  const [motivoReposicao, setMotivoReposicao] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [chamada, setChamada] = useState<Record<string, Situacao>>({});

  const isRetroativo = dataAula < todayISO();
  const needsJustificativa = !!isAdmin && isRetroativo;
  const anoLetivo = Number(dataAula.slice(0, 4));

  const turmasQuery = useQuery({
    queryKey: ["turmas-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas").select("id, nome, codigo_publico").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
  });

  const disciplinasQuery = useQuery({
    queryKey: ["disciplinas-turma", turmaId],
    enabled: !!turmaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplinas")
        .select("id, nome, codigo_publico, professores(nome)")
        .eq("turma_id", turmaId)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Disciplina[];
    },
  });

  // Alunos matriculados ativos na turma (join único, sem N+1)
  const alunosQuery = useQuery({
    queryKey: ["matriculados", turmaId, anoLetivo],
    enabled: !!turmaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("aluno_id, alunos(id, nome, codigo_publico)")
        .eq("turma_id", turmaId)
        .eq("ano_letivo", anoLetivo)
        .eq("status", "Ativa")
        .is("deleted_at", null);
      if (error) throw error;
      const rows = (data ?? []) as unknown as { alunos: AlunoMat | null }[];
      return rows
        .map((r) => r.alunos)
        .filter((a): a is AlunoMat => !!a)
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const diarioQuery = useQuery({
    queryKey: ["diario", turmaId, disciplinaId, dataAula],
    enabled: !!turmaId && !!disciplinaId && !!dataAula,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_classe")
        .select("id, conteudo_ministrado, planejamento_proxima_aula, observacoes, justificativa_retroativa, tipo_aula, data_aula_original, motivo_reposicao, diario_chamada(aluno_id, situacao, presente)")
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
      setObservacoes(d.observacoes ?? "");
      setTipoAula((d.tipo_aula as "Normal" | "Reposição") ?? "Normal");
      setDataOriginal(d.data_aula_original ?? "");
      setMotivoReposicao(d.motivo_reposicao ?? "");
      setJustificativa(d.justificativa_retroativa ?? "");
      const map: Record<string, Situacao> = {};
      (d.diario_chamada ?? []).forEach((c: any) => {
        map[c.aluno_id] = (c.situacao as Situacao) ?? (c.presente ? "Presente" : "Falta");
      });
      setChamada(map);
    } else {
      setConteudo("");
      setPlanejamento("");
      setObservacoes("");
      setJustificativa("");
      setChamada({});
    }
  }, [diarioQuery.data]);

  // Faltas consecutivas por aluno (uma query)
  const faltasQuery = useQuery({
    queryKey: ["faltas-recentes", turmaId, disciplinaId],
    enabled: !!turmaId && !!disciplinaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_chamada")
        .select("aluno_id, presente, situacao, diario_classe!inner(data_aula, disciplina_id, turma_id, deleted_at)")
        .eq("diario_classe.disciplina_id", disciplinaId)
        .eq("diario_classe.turma_id", turmaId)
        .is("diario_classe.deleted_at", null)
        .order("data_aula", { referencedTable: "diario_classe", ascending: false })
        .limit(500);
      if (error) throw error;
      const byAluno: Record<string, { data: string; falta: boolean }[]> = {};
      for (const r of (data ?? []) as any[]) {
        (byAluno[r.aluno_id] ??= []).push({
          data: r.diario_classe.data_aula,
          falta: (r.situacao ?? (r.presente ? "Presente" : "Falta")) === "Falta",
        });
      }
      const alerts: Record<string, number> = {};
      for (const [aid, rows] of Object.entries(byAluno)) {
        rows.sort((a, b) => (a.data < b.data ? 1 : -1));
        let streak = 0;
        for (const r of rows) {
          if (r.falta) streak++;
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
      if (tipoAula === "Reposição" && !dataOriginal)
        throw new Error("Informe a data da aula original que está sendo reposta.");
      if (needsJustificativa && justificativa.trim().length < 5)
        throw new Error("Justificativa obrigatória (mínimo 5 caracteres) para edição retroativa.");

      const existing = diarioQuery.data as any;
      let diarioId = existing?.id as string | undefined;

      if (diarioId) {
        const { error } = await supabase
          .from("diario_classe")
          .update({
            conteudo_ministrado: conteudo,
            planejamento_proxima_aula: planejamento.trim() || null,
            observacoes: observacoes.trim() || null,
            tipo_aula: tipoAula,
            data_aula_original: tipoAula === "Reposição" ? dataOriginal : null,
            motivo_reposicao: tipoAula === "Reposição" ? motivoReposicao.trim() || null : null,
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
            planejamento_proxima_aula: planejamento.trim() || null,
            observacoes: observacoes.trim() || null,
            tipo_aula: tipoAula,
            data_aula_original: tipoAula === "Reposição" ? dataOriginal : null,
            motivo_reposicao: tipoAula === "Reposição" ? motivoReposicao.trim() || null : null,
            justificativa_retroativa: needsJustificativa ? justificativa : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        diarioId = data.id;
      }

      const rows = Object.entries(chamada).map(([aluno_id, situacao]) => ({
        diario_id: diarioId!,
        aluno_id,
        situacao,
        presente: situacao === "Presente",
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

  const alunos = alunosQuery.data ?? [];
  const faltas = faltasQuery.data ?? {};
  const setSituacao = (id: string, v: Situacao) => setChamada((p) => ({ ...p, [id]: v }));

  const resumo = useMemo(() => {
    const vals = alunos.map((a) => chamada[a.id]);
    return {
      total: alunos.length,
      presentes: vals.filter((v) => v === "Presente").length,
      faltas: vals.filter((v) => v === "Falta").length,
      justificadas: vals.filter((v) => v === "Justificada").length,
    };
  }, [alunos, chamada]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diário de Classe"
        description="Frequência, plano de aula e avaliações."
      />

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
                    {d.professores?.nome ? ` · Prof. ${d.professores.nome}` : ""}
                  </SelectItem>
                ))}
                {disciplinasQuery.data?.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhuma disciplina ativa para esta turma.
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

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tipo de aula</Label>
            <Select value={tipoAula} onValueChange={(v) => setTipoAula(v as "Normal" | "Reposição")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Aula normal</SelectItem>
                <SelectItem value="Reposição">Reposição de aula</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipoAula === "Reposição" && (
            <>
              <div className="space-y-1.5">
                <Label>Data da aula reposta</Label>
                <Input type="date" value={dataOriginal} onChange={(e) => setDataOriginal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo da reposição</Label>
                <Input
                  value={motivoReposicao}
                  onChange={(e) => setMotivoReposicao(e.target.value)}
                  placeholder="Feriado, ausência do professor..."
                />
              </div>
            </>
          )}
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
        <Tabs defaultValue="chamada" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chamada">Chamada</TabsTrigger>
            <TabsTrigger value="plano">Plano de aula</TabsTrigger>
            {notasHabilitadas && <TabsTrigger value="avaliacoes">Avaliações e notas</TabsTrigger>}
          </TabsList>

          <TabsContent value="chamada" className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Lista de chamada</h2>
                  <p className="text-xs text-muted-foreground">
                    {resumo.total} matriculados · {resumo.presentes} presentes · {resumo.faltas} faltas · {resumo.justificadas} justificadas
                  </p>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "Salvando..." : "Salvar diário"}
                </Button>
              </div>

              {alunosQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : alunos.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum aluno matriculado nesta turma para {anoLetivo}. Cadastre em Matrículas.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {alunos.map((a) => {
                    const state = chamada[a.id];
                    const streak = faltas[a.id];
                    return (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">{a.nome}</span>
                          <span className="text-xs text-muted-foreground">{a.codigo_publico ?? ""}</span>
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
                            variant={state === "Presente" ? "default" : "outline"}
                            className={state === "Presente" ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}
                            onClick={() => setSituacao(a.id, "Presente")}
                          >
                            <Check className="mr-1 h-4 w-4" /> Presença
                          </Button>
                          <Button
                            size="sm"
                            variant={state === "Falta" ? "default" : "outline"}
                            className={state === "Falta" ? "bg-red-600 text-white hover:bg-red-700" : ""}
                            onClick={() => setSituacao(a.id, "Falta")}
                          >
                            <X className="mr-1 h-4 w-4" /> Falta
                          </Button>
                          <Button
                            size="sm"
                            variant={state === "Justificada" ? "default" : "outline"}
                            className={state === "Justificada" ? "bg-amber-500 text-white hover:bg-amber-600" : ""}
                            onClick={() => setSituacao(a.id, "Justificada")}
                          >
                            <ShieldAlert className="mr-1 h-4 w-4" /> Justificada
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="plano" className="space-y-4">
            <Card className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Conteúdo ministrado *</Label>
                  <Textarea rows={5} value={conteudo} onChange={(e) => setConteudo(e.target.value)}
                    placeholder="Resumo do tema abordado hoje..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Planejamento da próxima aula</Label>
                  <Textarea rows={5} value={planejamento} onChange={(e) => setPlanejamento(e.target.value)}
                    placeholder="Assunto do próximo encontro (opcional)..." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observações do dia</Label>
                <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ocorrências, comportamento, avisos..." />
              </div>
              {needsJustificativa && (
                <div className="space-y-1.5">
                  <Label className="text-amber-700 dark:text-amber-400">Justificativa da edição retroativa *</Label>
                  <Textarea rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Explique o motivo da edição em data anterior..." />
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "Salvando..." : "Salvar diário"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {notasHabilitadas && (
          <TabsContent value="avaliacoes">
            <AvaliacoesTab turmaId={turmaId} disciplinaId={disciplinaId} alunos={alunos} />
          </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

type Avaliacao = {
  id: string;
  codigo_publico: string | null;
  titulo: string;
  data_avaliacao: string;
  nota_maxima: number | null;
};

function AvaliacoesTab({
  turmaId, disciplinaId, alunos,
}: { turmaId: string; disciplinaId: string; alunos: AlunoMat[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dataAvaliacao, setDataAvaliacao] = useState(todayISO());
  const [notaMaxima, setNotaMaxima] = useState("");
  const [selected, setSelected] = useState("");
  const [notas, setNotas] = useState<Record<string, { nota: string; parecer: string }>>({});

  const avaliacoesQuery = useQuery({
    queryKey: ["avaliacoes", turmaId, disciplinaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("id, codigo_publico, titulo, data_avaliacao, nota_maxima")
        .eq("turma_id", turmaId)
        .eq("disciplina_id", disciplinaId)
        .is("deleted_at", null)
        .order("data_avaliacao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Avaliacao[];
    },
  });

  const notasQuery = useQuery({
    queryKey: ["avaliacao-notas", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacao_notas")
        .select("aluno_id, nota, parecer")
        .eq("avaliacao_id", selected);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const map: Record<string, { nota: string; parecer: string }> = {};
    (notasQuery.data ?? []).forEach((n: any) => {
      map[n.aluno_id] = { nota: n.nota === null ? "" : String(n.nota), parecer: n.parecer ?? "" };
    });
    setNotas(map);
  }, [notasQuery.data, selected]);

  const criar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título da avaliação.");
      const { data, error } = await supabase
        .from("avaliacoes")
        .insert({
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          titulo: titulo.trim(),
          data_avaliacao: dataAvaliacao,
          nota_maxima: notaMaxima.trim() ? Number(notaMaxima.replace(",", ".")) : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Avaliação criada");
      qc.invalidateQueries({ queryKey: ["avaliacoes", turmaId, disciplinaId] });
      setOpen(false);
      setTitulo("");
      setNotaMaxima("");
      setSelected(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarNotas = useMutation({
    mutationFn: async () => {
      const rows = alunos
        .filter((a) => notas[a.id] && (notas[a.id].nota.trim() || notas[a.id].parecer.trim()))
        .map((a) => {
          const raw = notas[a.id].nota.trim().replace(",", ".");
          const nota = raw === "" ? null : Number(raw);
          if (nota !== null && Number.isNaN(nota)) throw new Error(`Nota inválida para ${a.nome}.`);
          return {
            avaliacao_id: selected,
            aluno_id: a.id,
            nota,
            parecer: notas[a.id].parecer.trim() || null,
          };
        });
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("avaliacao_notas")
        .upsert(rows, { onConflict: "avaliacao_id,aluno_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notas salvas");
      qc.invalidateQueries({ queryKey: ["avaliacao-notas", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = avaliacoesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <Label>Avaliação</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Selecione uma avaliação" /></SelectTrigger>
            <SelectContent>
              {lista.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.codigo_publico ? `${a.codigo_publico} — ` : ""}{a.titulo} ({a.data_avaliacao})
                </SelectItem>
              ))}
              {lista.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma avaliação cadastrada.</div>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova avaliação
        </Button>
      </Card>

      {selected && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Nota e parecer são opcionais — deixe em branco para não lançar.
            </p>
            <Button onClick={() => salvarNotas.mutate()} disabled={salvarNotas.isPending}>
              <Save className="mr-2 h-4 w-4" /> Salvar notas
            </Button>
          </div>
          {alunos.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno matriculado.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {alunos.map((a) => (
                <li key={a.id} className="grid gap-2 py-2.5 sm:grid-cols-[1fr_100px_1fr] sm:items-center">
                  <span className="truncate text-sm font-medium">{a.nome}</span>
                  <Input
                    inputMode="decimal"
                    placeholder="Nota"
                    value={notas[a.id]?.nota ?? ""}
                    onChange={(e) =>
                      setNotas((p) => ({ ...p, [a.id]: { nota: e.target.value, parecer: p[a.id]?.parecer ?? "" } }))
                    }
                  />
                  <Input
                    placeholder="Parecer (opcional)"
                    value={notas[a.id]?.parecer ?? ""}
                    onChange={(e) =>
                      setNotas((p) => ({ ...p, [a.id]: { nota: p[a.id]?.nota ?? "", parecer: e.target.value } }))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova avaliação</DialogTitle>
            <DialogDescription>Vinculada à turma e disciplina selecionadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tit">Título *</Label>
              <Input id="tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Prova 1, Trabalho..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dta">Data</Label>
                <Input id="dta" type="date" value={dataAvaliacao} onChange={(e) => setDataAvaliacao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmax">Nota máxima</Label>
                <Input id="nmax" inputMode="decimal" value={notaMaxima} onChange={(e) => setNotaMaxima(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
