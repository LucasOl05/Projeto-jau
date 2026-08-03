import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { isValidCPF, maskCPF, maskPhone, onlyDigits } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/matriculas")({
  head: () => ({
    meta: [
      { title: "Matrículas — JAU ERP" },
      { name: "description", content: "Matrícula de alunos em turmas por ano letivo, com código público sequencial." },
      { property: "og:title", content: "Matrículas — JAU ERP" },
      { property: "og:description", content: "Gestão de matrículas por turma e ano letivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatriculasPage,
});

const STATUS = ["Ativa", "Trancada", "Concluída", "Cancelada"] as const;
type StatusMat = (typeof STATUS)[number];

const PARENTESCOS = ["Mãe", "Pai", "Tutor", "Responsável Financeiro"] as const;

type Matricula = {
  id: string;
  codigo_publico: string | null;
  aluno_id: string;
  turma_id: string;
  ano_letivo: number;
  data_matricula: string;
  status: StatusMat;
  observacoes: string | null;
  alunos: { nome: string; codigo_publico: string | null } | null;
  turmas: { nome: string; codigo_publico: string | null } | null;
};

type FormState = {
  id?: string;
  codigo_publico: string;
  aluno_id: string;
  turma_id: string;
  ano_letivo: string;
  data_matricula: string;
  status: StatusMat;
  observacoes: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormState => ({
  codigo_publico: "",
  aluno_id: "",
  turma_id: "",
  ano_letivo: String(new Date().getFullYear()),
  data_matricula: todayISO(),
  status: "Ativa",
  observacoes: "",
});

function MatriculasPage() {
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [novoAluno, setNovoAluno] = useState(false);
  const [novoResp, setNovoResp] = useState(false);
  const [alunoNovo, setAlunoNovo] = useState({ nome: "", cpf: "", codigo_publico: "" });
  const [respSel, setRespSel] = useState("");
  const [respNovo, setRespNovo] = useState({ nome: "", telefone: "", parentesco: "Mãe" as string });

  const listQuery = useQuery({
    queryKey: ["matriculas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select(
          "id, codigo_publico, aluno_id, turma_id, ano_letivo, data_matricula, status, observacoes, alunos(nome, codigo_publico), turmas(nome, codigo_publico)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Matricula[];
    },
  });

  const alunosQuery = useQuery({
    queryKey: ["alunos-opts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, codigo_publico")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const turmasQuery = useQuery({
    queryKey: ["turmas-opts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas")
        .select("id, nome, codigo_publico")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      let alunoId = f.aluno_id;

      if (novoAluno) {
        const cpfDigits = onlyDigits(alunoNovo.cpf);
        if (cpfDigits && !isValidCPF(cpfDigits)) throw new Error("CPF do aluno inválido.");
        if (!alunoNovo.nome.trim()) throw new Error("Informe o nome do novo aluno.");

        // 1) Responsável (novo ou existente)
        let responsavelId = respSel || "";
        if (novoResp) {
          if (!respNovo.nome.trim()) throw new Error("Informe o nome do responsável.");
          const { data: r, error: rErr } = await supabase
            .from("responsaveis")
            .insert({
              nome: respNovo.nome.trim(),
              telefone: onlyDigits(respNovo.telefone) || null,
            })
            .select("id")
            .single();
          if (rErr) throw rErr;
          responsavelId = r.id;
        }

        // 2) Aluno
        const { data: a, error: aErr } = await supabase
          .from("alunos")
          .insert({
            nome: alunoNovo.nome.trim(),
            cpf: cpfDigits || null,
            status: "Ativo",
            ...(alunoNovo.codigo_publico.trim() ? { codigo_publico: alunoNovo.codigo_publico.trim() } : {}),
          })
          .select("id")
          .single();
        if (aErr) throw aErr;
        alunoId = a.id;

        // 3) Vínculo N:N
        if (responsavelId) {
          const { error: vErr } = await supabase.from("aluno_responsavel").upsert(
            { aluno_id: alunoId, responsavel_id: responsavelId, parentesco: respNovo.parentesco },
            { onConflict: "aluno_id,responsavel_id" },
          );
          if (vErr) throw vErr;
        }
      }

      const payload = {
        aluno_id: alunoId,
        turma_id: f.turma_id,
        ano_letivo: Number(f.ano_letivo),
        data_matricula: f.data_matricula,
        status: f.status,
        observacoes: f.observacoes.trim() || null,
        ...(f.codigo_publico.trim() ? { codigo_publico: f.codigo_publico.trim() } : {}),
      };
      if (f.id) {
        const { error } = await supabase.from("matriculas").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matriculas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Matrícula salva");
      qc.invalidateQueries({ queryKey: ["matriculas"] });
      qc.invalidateQueries({ queryKey: ["alunos-opts"] });
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["responsaveis"] });
      setOpen(false);
      setForm(emptyForm());
      resetQuick();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const responsaveisQuery = useQuery({
    queryKey: ["responsaveis-opts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  function resetQuick() {
    setNovoAluno(false);
    setNovoResp(false);
    setAlunoNovo({ nome: "", cpf: "", codigo_publico: "" });
    setRespSel("");
    setRespNovo({ nome: "", telefone: "", parentesco: "Mãe" });
  }

  const remove = useMutation({
    mutationFn: async (m: Matricula) => {
      const { error } = await supabase
        .from("matriculas")
        .update({ deleted_at: new Date().toISOString(), status: "Cancelada" })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matrícula excluída");
      qc.invalidateQueries({ queryKey: ["matriculas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = listQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (m) =>
        (m.codigo_publico ?? "").toLowerCase().includes(q) ||
        (m.alunos?.nome ?? "").toLowerCase().includes(q) ||
        (m.turmas?.nome ?? "").toLowerCase().includes(q) ||
        String(m.ano_letivo).includes(q),
    );
  }, [listQuery.data, query]);

  function openNew() { setForm(emptyForm()); resetQuick(); setOpen(true); }
  function openEdit(m: Matricula) {
    resetQuick();
    setForm({
      id: m.id,
      codigo_publico: m.codigo_publico ?? "",
      aluno_id: m.aluno_id,
      turma_id: m.turma_id,
      ano_letivo: String(m.ano_letivo),
      data_matricula: m.data_matricula,
      status: m.status,
      observacoes: m.observacoes ?? "",
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!novoAluno && !form.aluno_id) return toast.error("Selecione o aluno");
    if (novoAluno && !alunoNovo.nome.trim()) return toast.error("Informe o nome do novo aluno");
    if (!form.turma_id) return toast.error("Selecione a turma");
    if (!/^\d{4}$/.test(form.ano_letivo)) return toast.error("Ano letivo inválido");
    upsert.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matrículas"
        description="Vínculo de alunos a turmas por ano letivo."
        actions={isAdmin ? <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova matrícula</Button> : null}
      />

      <Card className="border-border/70">
        <div className="flex items-center gap-3 border-b border-border/70 p-4">
          <div className="relative w-full max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código, aluno, turma ou ano..."
              className="pl-9"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {listQuery.data ? `${filtered.length} matrícula(s)` : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Ano letivo</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={isAdmin ? 6 : 5}><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))}
              {!listQuery.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma matrícula registrada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.codigo_publico ?? "—"}</TableCell>
                  <TableCell className="font-medium">{m.alunos?.nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.turmas?.nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.ano_letivo}</TableCell>
                  <TableCell>
                    {m.status === "Ativa" ? <Badge>Ativa</Badge> : <Badge variant="secondary">{m.status}</Badge>}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Excluir matrícula de "${m.alunos?.nome ?? ""}"?`)) remove.mutate(m);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar matrícula" : "Nova matrícula"}</DialogTitle>
            <DialogDescription>Selecione o aluno, a turma e o ano letivo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Aluno *</Label>
              <div className="flex gap-2">
                {!novoAluno && (
                  <Select value={form.aluno_id} onValueChange={(v) => setForm({ ...form, aluno_id: v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                    <SelectContent>
                      {(alunosQuery.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.codigo_publico ? `${a.codigo_publico} — ` : ""}{a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant={novoAluno ? "secondary" : "outline"}
                  className={novoAluno ? "flex-1" : "shrink-0"}
                  onClick={() => { setNovoAluno(!novoAluno); setForm({ ...form, aluno_id: "" }); }}
                >
                  {novoAluno ? "Selecionar aluno existente" : "+ Cadastrar novo aluno"}
                </Button>
              </div>
            </div>

            {novoAluno && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="an-nome">Nome do aluno *</Label>
                    <Input id="an-nome" value={alunoNovo.nome} onChange={(e) => setAlunoNovo({ ...alunoNovo, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="an-cpf">CPF (opcional)</Label>
                    <Input id="an-cpf" inputMode="numeric" value={alunoNovo.cpf}
                      onChange={(e) => setAlunoNovo({ ...alunoNovo, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="an-cod">Matrícula / código (opcional)</Label>
                  <Input id="an-cod" value={alunoNovo.codigo_publico}
                    onChange={(e) => setAlunoNovo({ ...alunoNovo, codigo_publico: e.target.value })} placeholder="Auto (ALU-000001)" />
                </div>

                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <div className="flex gap-2">
                    {!novoResp && (
                      <Select value={respSel} onValueChange={setRespSel}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                        <SelectContent>
                          {(responsaveisQuery.data ?? []).map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      type="button"
                      variant={novoResp ? "secondary" : "outline"}
                      className={novoResp ? "flex-1" : "shrink-0"}
                      onClick={() => { setNovoResp(!novoResp); setRespSel(""); }}
                    >
                      {novoResp ? "Selecionar existente" : "+ Cadastrar novo responsável"}
                    </Button>
                  </div>
                </div>

                {novoResp && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rn-nome">Nome do responsável *</Label>
                      <Input id="rn-nome" value={respNovo.nome} onChange={(e) => setRespNovo({ ...respNovo, nome: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rn-tel">Telefone</Label>
                      <Input id="rn-tel" inputMode="tel" value={respNovo.telefone}
                        onChange={(e) => setRespNovo({ ...respNovo, telefone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                )}

                {(novoResp || respSel) && (
                  <div className="space-y-2">
                    <Label>Parentesco</Label>
                    <Select value={respNovo.parentesco} onValueChange={(v) => setRespNovo({ ...respNovo, parentesco: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PARENTESCOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
            </div>
            <div className="space-y-2">
              <Label>Turma *</Label>
              <Select value={form.turma_id} onValueChange={(v) => setForm({ ...form, turma_id: v })}>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ano">Ano letivo *</Label>
                <Input
                  id="ano"
                  inputMode="numeric"
                  value={form.ano_letivo}
                  onChange={(e) => setForm({ ...form, ano_letivo: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dtm">Data</Label>
                <Input
                  id="dtm"
                  type="date"
                  value={form.data_matricula}
                  onChange={(e) => setForm({ ...form, data_matricula: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as StatusMat })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codm">Código da matrícula</Label>
              <Input
                id="codm"
                value={form.codigo_publico}
                onChange={(e) => setForm({ ...form, codigo_publico: e.target.value })}
                placeholder="Auto (MAT-000001)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea id="obs" rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsert.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
