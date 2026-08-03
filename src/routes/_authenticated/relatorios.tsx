import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Central de Relatórios — JAU ERP" },
      { name: "description", content: "Emissão de boletins, declarações oficiais e atas de resultados." },
      { property: "og:title", content: "Central de Relatórios — JAU ERP" },
      { property: "og:description", content: "Geração de PDFs acadêmicos via impressão do navegador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatoriosPage,
});

type Turma = { id: string; nome: string; codigo_publico: string | null; curso_id: string | null };
type Aluno = { id: string; nome: string; codigo_publico: string | null };
type Curso = { id: string; nome: string; carga_horaria: number | null; frequencia_minima: number | null };
type Escola = { id: string; nome: string };

const anosLetivos = () => {
  const now = new Date().getFullYear();
  return [now, now - 1, now - 2].map(String);
};

function printHtml(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    toast.error("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
    return;
  }
  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Georgia", "Times New Roman", serif; color: #1a1a1a; line-height: 1.5; }
  h1, h2, h3 { font-family: "Georgia", serif; margin: 0 0 8px; }
  h1 { font-size: 20px; text-align: center; }
  h2 { font-size: 15px; margin-top: 18px; }
  p { margin: 4px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th, td { border: 1px solid #444; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; }
  .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .signature { margin-top: 60px; text-align: center; }
  .signature .line { border-top: 1px solid #333; width: 260px; margin: 0 auto; padding-top: 6px; }
  .muted { color: #555; font-size: 11px; }
  .final-status { font-weight: bold; margin-top: 10px; }
  @media print {
    .no-print { display: none; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}

function extenso(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function situacaoFinal(media: number, freq: number, freqMinima: number) {
  if (media >= 6 && freq >= freqMinima) return "Aprovado";
  if (media >= 4 && media < 6) return "Em Recuperação";
  return "Retido";
}

function useEscolaPadrao() {
  return useQuery({
    queryKey: ["escola-padrao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escolas")
        .select("id, nome")
        .eq("ativa", true)
        .order("padrao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Escola | null;
    },
  });
}

function useTurmas() {
  return useQuery({
    queryKey: ["relatorios-turmas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas")
        .select("id, nome, codigo_publico, curso_id")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
  });
}

async function fetchAlunosDaTurma(turmaId: string, anoLetivo: number) {
  const { data, error } = await supabase
    .from("matriculas")
    .select("aluno_id, alunos(id, nome, codigo_publico)")
    .eq("turma_id", turmaId)
    .eq("ano_letivo", anoLetivo)
    .eq("status", "Ativa")
    .is("deleted_at", null);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { alunos: Aluno | null }[];
  return rows.map((r) => r.alunos).filter((a): a is Aluno => !!a).sort((a, b) => a.nome.localeCompare(b.nome));
}

async function fetchCurso(cursoId: string | null) {
  if (!cursoId) return null;
  const { data, error } = await supabase
    .from("cursos")
    .select("id, nome, carga_horaria, frequencia_minima")
    .eq("id", cursoId)
    .maybeSingle();
  if (error) throw error;
  return data as Curso | null;
}

async function computeBoletim(turmaId: string, alunoId: string, anoLetivo: number) {
  const { data: disciplinas, error: eDisc } = await supabase
    .from("disciplinas")
    .select("id, nome")
    .eq("turma_id", turmaId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("nome");
  if (eDisc) throw eDisc;

  const rows: { disciplina: string; media: number; frequencia: number }[] = [];

  for (const disc of disciplinas ?? []) {
    const { data: avals, error: eAval } = await supabase
      .from("avaliacoes")
      .select("id, peso, nota_maxima")
      .eq("turma_id", turmaId)
      .eq("disciplina_id", disc.id)
      .is("deleted_at", null);
    if (eAval) throw eAval;

    let mediaPonderada = 0;
    let pesoTotal = 0;
    if (avals && avals.length > 0) {
      const avalIds = avals.map((a) => a.id);
      const { data: notas, error: eNotas } = await supabase
        .from("avaliacao_notas")
        .select("avaliacao_id, nota")
        .eq("aluno_id", alunoId)
        .in("avaliacao_id", avalIds);
      if (eNotas) throw eNotas;
      const notaByAval = new Map((notas ?? []).map((n) => [n.avaliacao_id, n.nota]));
      for (const av of avals) {
        const peso = av.peso ?? 1;
        const notaMax = av.nota_maxima ?? 10;
        const nota = notaByAval.get(av.id);
        if (nota != null && notaMax > 0) {
          mediaPonderada += (Number(nota) / Number(notaMax)) * 10 * peso;
          pesoTotal += peso;
        }
      }
    }
    const media = pesoTotal > 0 ? mediaPonderada / pesoTotal : 0;

    const { data: aulas, error: eAulas } = await supabase
      .from("diario_classe")
      .select("id")
      .eq("turma_id", turmaId)
      .eq("disciplina_id", disc.id)
      .is("deleted_at", null);
    if (eAulas) throw eAulas;
    const aulaIds = (aulas ?? []).map((a) => a.id);

    let frequencia = 100;
    if (aulaIds.length > 0) {
      const { data: chamadas, error: eCham } = await supabase
        .from("diario_chamada")
        .select("situacao, diario_id")
        .eq("aluno_id", alunoId)
        .in("diario_id", aulaIds);
      if (eCham) throw eCham;
      const total = aulaIds.length;
      const presencas = (chamadas ?? []).filter(
        (c) => c.situacao === "Presente" || c.situacao === "Justificada",
      ).length;
      frequencia = total > 0 ? (presencas / total) * 100 : 100;
    }

    rows.push({ disciplina: disc.nome, media, frequencia });
  }

  return rows;
}

function RelatoriosPage() {
  const escolaQuery = useEscolaPadrao();
  const turmasQuery = useTurmas();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Relatórios"
        description="Emissão de boletins, declarações e atas em PDF."
      />

      <BoletimCard turmas={turmasQuery.data ?? []} escola={escolaQuery.data ?? null} />
      <DeclaracaoCard turmas={turmasQuery.data ?? []} escola={escolaQuery.data ?? null} />
      <AtaCard turmas={turmasQuery.data ?? []} escola={escolaQuery.data ?? null} />
    </div>
  );
}

function BoletimCard({ turmas, escola }: { turmas: Turma[]; escola: Escola | null }) {
  const [turmaId, setTurmaId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [anoLetivo, setAnoLetivo] = useState(anosLetivos()[0]);

  const alunosQuery = useQuery({
    queryKey: ["relatorios-alunos-turma", turmaId, anoLetivo],
    enabled: !!turmaId,
    queryFn: () => fetchAlunosDaTurma(turmaId, Number(anoLetivo)),
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const turma = turmas.find((t) => t.id === turmaId);
      const aluno = (alunosQuery.data ?? []).find((a) => a.id === alunoId);
      if (!turma || !aluno) throw new Error("Selecione turma e aluno.");
      const curso = await fetchCurso(turma.curso_id);
      const rows = await computeBoletim(turmaId, alunoId, Number(anoLetivo));

      const mediaGeral = rows.length > 0 ? rows.reduce((s, r) => s + r.media, 0) / rows.length : 0;
      const freqGeral = rows.length > 0 ? rows.reduce((s, r) => s + r.frequencia, 0) / rows.length : 100;
      const freqMinima = curso?.frequencia_minima ?? 75;
      const situacao = situacaoFinal(mediaGeral, freqGeral, freqMinima);

      const linhas = rows
        .map(
          (r) => `<tr><td>${r.disciplina}</td><td>${r.media.toFixed(1)}</td><td>${r.frequencia.toFixed(1)}%</td></tr>`,
        )
        .join("");

      const html = `
        <div class="header">
          <h1>${escola?.nome ?? "Instituição de Ensino"}</h1>
          <p>Boletim Escolar — Ano Letivo ${anoLetivo}</p>
        </div>
        <p><strong>Aluno:</strong> ${aluno.nome} ${aluno.codigo_publico ? `(${aluno.codigo_publico})` : ""}</p>
        <p><strong>Turma:</strong> ${turma.nome} ${turma.codigo_publico ? `(${turma.codigo_publico})` : ""}</p>
        <p><strong>Curso:</strong> ${curso?.nome ?? "—"}</p>
        <h2>Desempenho por disciplina</h2>
        <table>
          <thead><tr><th>Disciplina</th><th>Média</th><th>Frequência</th></tr></thead>
          <tbody>${linhas || `<tr><td colspan="3">Nenhuma disciplina lançada.</td></tr>`}</tbody>
        </table>
        <p class="final-status">Média geral: ${mediaGeral.toFixed(1)} · Frequência geral: ${freqGeral.toFixed(1)}%</p>
        <p class="final-status">Situação final: ${situacao}</p>
        <div class="signature">
          <div class="line">Assinatura da Secretaria Escolar</div>
        </div>
      `;
      printHtml(`Boletim — ${aluno.nome}`, html);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Boletim Escolar</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Turma</Label>
          <Select value={turmaId} onValueChange={(v) => { setTurmaId(v); setAlunoId(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
            <SelectContent>
              {turmas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.codigo_publico ? `${t.codigo_publico} — ` : ""}{t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Aluno</Label>
          <Select value={alunoId} onValueChange={setAlunoId} disabled={!turmaId}>
            <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
            <SelectContent>
              {(alunosQuery.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano letivo</Label>
          <Select value={anoLetivo} onValueChange={setAnoLetivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosLetivos().map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => gerar.mutate()} disabled={gerar.isPending || !alunoId}>
            <Printer className="mr-2 h-4 w-4" />
            Gerar PDF
          </Button>
        </div>
      </div>
    </Card>
  );
}

const TIPOS_DECLARACAO = ["Declaração de Matrícula", "Atestado de Frequência"] as const;

function DeclaracaoCard({ turmas, escola }: { turmas: Turma[]; escola: Escola | null }) {
  const [alunoId, setAlunoId] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS_DECLARACAO)[number]>(TIPOS_DECLARACAO[0]);
  const [anoLetivo, setAnoLetivo] = useState(anosLetivos()[0]);

  const alunosQuery = useQuery({
    queryKey: ["relatorios-alunos-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, codigo_publico")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Aluno[];
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const aluno = (alunosQuery.data ?? []).find((a) => a.id === alunoId);
      if (!aluno) throw new Error("Selecione o aluno.");

      const { data: mat, error: eMat } = await supabase
        .from("matriculas")
        .select("turma_id, ano_letivo, turmas(nome, curso_id, cursos(nome))")
        .eq("aluno_id", alunoId)
        .eq("ano_letivo", Number(anoLetivo))
        .eq("status", "Ativa")
        .is("deleted_at", null)
        .maybeSingle();
      if (eMat) throw eMat;

      const turmaNome = (mat as any)?.turmas?.nome ?? "—";
      const cursoNome = (mat as any)?.turmas?.cursos?.nome ?? "—";

      const hoje = extenso(new Date());
      const corpo =
        tipo === "Declaração de Matrícula"
          ? `Declaramos, para os devidos fins, que <strong>${aluno.nome}</strong> encontra-se regularmente matriculado(a) na turma <strong>${turmaNome}</strong>, curso <strong>${cursoNome}</strong>, referente ao ano letivo de <strong>${anoLetivo}</strong>.`
          : `Atestamos, para os devidos fins, a frequência regular de <strong>${aluno.nome}</strong> na turma <strong>${turmaNome}</strong>, curso <strong>${cursoNome}</strong>, durante o ano letivo de <strong>${anoLetivo}</strong>.`;

      const html = `
        <div class="header">
          <h1>${escola?.nome ?? "Instituição de Ensino"}</h1>
          <p>${tipo}</p>
        </div>
        <p style="margin-top:30px; font-size:14px; text-align:justify;">${corpo}</p>
        <p style="margin-top:30px;">Por ser verdade, firmamos a presente declaração.</p>
        <p class="muted" style="text-align:right; margin-top:30px;">${hoje}</p>
        <div class="signature">
          <div class="line">Assinatura da Secretaria Escolar</div>
        </div>
      `;
      printHtml(tipo, html);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Declarações Oficiais</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Aluno</Label>
          <Select value={alunoId} onValueChange={setAlunoId}>
            <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
            <SelectContent>
              {(alunosQuery.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as (typeof TIPOS_DECLARACAO)[number])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_DECLARACAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano letivo</Label>
          <Select value={anoLetivo} onValueChange={setAnoLetivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosLetivos().map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => gerar.mutate()} disabled={gerar.isPending || !alunoId}>
            <Printer className="mr-2 h-4 w-4" />
            Gerar PDF
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AtaCard({ turmas, escola }: { turmas: Turma[]; escola: Escola | null }) {
  const [turmaId, setTurmaId] = useState("");
  const [anoLetivo, setAnoLetivo] = useState(anosLetivos()[0]);

  const gerar = useMutation({
    mutationFn: async () => {
      const turma = turmas.find((t) => t.id === turmaId);
      if (!turma) throw new Error("Selecione a turma.");
      const curso = await fetchCurso(turma.curso_id);
      const freqMinima = curso?.frequencia_minima ?? 75;
      const alunos = await fetchAlunosDaTurma(turmaId, Number(anoLetivo));

      const linhas: string[] = [];
      for (const aluno of alunos) {
        const rows = await computeBoletim(turmaId, aluno.id, Number(anoLetivo));
        const mediaGeral = rows.length > 0 ? rows.reduce((s, r) => s + r.media, 0) / rows.length : 0;
        const freqGeral = rows.length > 0 ? rows.reduce((s, r) => s + r.frequencia, 0) / rows.length : 100;
        const situacao = situacaoFinal(mediaGeral, freqGeral, freqMinima);
        linhas.push(
          `<tr><td>${aluno.nome}</td><td>${mediaGeral.toFixed(1)}</td><td>${freqGeral.toFixed(1)}%</td><td>${situacao}</td></tr>`,
        );
      }

      const html = `
        <div class="header">
          <h1>${escola?.nome ?? "Instituição de Ensino"}</h1>
          <p>Ata de Resultados Finais — ${turma.nome} — Ano Letivo ${anoLetivo}</p>
        </div>
        <table>
          <thead><tr><th>Aluno</th><th>Média final</th><th>Frequência</th><th>Situação</th></tr></thead>
          <tbody>${linhas.join("") || `<tr><td colspan="4">Nenhum aluno matriculado.</td></tr>`}</tbody>
        </table>
        <div class="signature">
          <div class="line">Assinatura da Secretaria Escolar</div>
        </div>
      `;
      printHtml(`Ata — ${turma.nome}`, html);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Ata de Resultados</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Turma</Label>
          <Select value={turmaId} onValueChange={setTurmaId}>
            <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
            <SelectContent>
              {turmas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.codigo_publico ? `${t.codigo_publico} — ` : ""}{t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano letivo</Label>
          <Select value={anoLetivo} onValueChange={setAnoLetivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosLetivos().map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => gerar.mutate()} disabled={gerar.isPending || !turmaId}>
            <Printer className="mr-2 h-4 w-4" />
            Gerar PDF
          </Button>
        </div>
      </div>
    </Card>
  );
}
