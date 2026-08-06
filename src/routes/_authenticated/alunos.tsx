import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, Users, CheckCircle2, Clock, X, FolderOpen, FilterX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { AccessGuard } from "@/components/access-guard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { DocumentosPanel } from "@/components/documentos-panel";
import { brDateToISO, isoDateToBR, isValidCPF, maskCPF, maskDate, maskPhone, onlyDigits } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/alunos")({
  head: () => ({ meta: [{ title: "Alunos — JAU ERP" }] }),
  component: () => (
    <AccessGuard resource="alunos">
      <AlunosPage />
    </AccessGuard>
  ),
});

const STATUS_OPTIONS = ["Pendente", "Ativo", "Trancado", "Concluído", "Inativo"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

type Aluno = {
  id: string;
  matricula: number;
  codigo_publico: string | null;
  nome: string;
  cpf: string | null;
  rg: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  status: Status;
  created_at: string;
};

type Responsavel = { id: string; nome: string; cpf: string | null; telefone?: string | null };

type LinkedResp = {
  responsavel_id: string;
  parentesco: string | null;
  nome: string;
  cpf: string;
  telefone: string;
};

type FormState = {
  id?: string;
  codigo_publico: string;
  nome: string;
  cpf: string;
  rg: string;
  telefone: string;
  data_nascimento: string;
  status: Status;
  vinculos: LinkedResp[];
};

const emptyForm: FormState = {
  codigo_publico: "",
  nome: "",
  cpf: "",
  rg: "",
  telefone: "",
  data_nascimento: "",
  status: "Pendente",
  vinculos: [],
};

const parentescos = ["Mãe", "Pai", "Tutor", "Responsável Financeiro", "Avó", "Avô", "Outro"];

function StatusBadge({ status }: { status: Status }) {
  if (status === "Ativo")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
        Ativo
      </Badge>
    );
  if (status === "Pendente")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">
        Pendente
      </Badge>
    );
  if (status === "Trancado")
    return (
      <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/20 dark:text-red-400">
        Trancado
      </Badge>
    );
  if (status === "Concluído")
    return (
      <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/20 dark:text-sky-400">
        Concluído
      </Badge>
    );
  return <Badge variant="secondary">Inativo</Badge>;
}

function AlunosPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [nascFilter, setNascFilter] = useState("");
  const [docsAluno, setDocsAluno] = useState<Aluno | null>(null);
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const alunosQuery = useQuery({
    queryKey: ["alunos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, matricula, codigo_publico, nome, cpf, rg, telefone, data_nascimento, status, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Aluno[];
    },
  });

  const responsaveisQuery = useQuery({
    queryKey: ["responsaveis-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("id, nome, cpf, telefone")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Responsavel[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const cpfDigits = onlyDigits(f.cpf);
      if (cpfDigits && !isValidCPF(cpfDigits)) throw new Error("CPF inválido.");
      const isoNasc = f.data_nascimento ? brDateToISO(f.data_nascimento) : null;
      if (f.data_nascimento && !isoNasc) throw new Error("Data de nascimento inválida.");

      if (cpfDigits) {
        const { data: dup } = await supabase
          .from("alunos")
          .select("id")
          .eq("cpf", cpfDigits)
          .maybeSingle();
        if (dup && dup.id !== f.id) throw new Error("Já existe um aluno com esse CPF.");
      }

      const payload = {
        nome: f.nome.trim(),
        cpf: cpfDigits || null,
        rg: f.rg.trim() || null,
        telefone: onlyDigits(f.telefone) || null,
        data_nascimento: isoNasc,
        status: f.status,
        ...(f.codigo_publico.trim() ? { codigo_publico: f.codigo_publico.trim() } : {}),
      };

      let alunoId = f.id;
      if (alunoId) {
        const { error } = await supabase.from("alunos").update(payload).eq("id", alunoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("alunos").insert(payload).select("id").single();
        if (error) throw error;
        alunoId = data.id;
      }

      // Sincroniza vínculos N:N em 2 chamadas (sem loop N+1)
      const keepIds = f.vinculos.map((v) => v.responsavel_id);
      let del = supabase.from("aluno_responsavel").delete().eq("aluno_id", alunoId);
      if (keepIds.length > 0) del = del.not("responsavel_id", "in", `(${keepIds.join(",")})`);
      const { error: delErr } = await del;
      if (delErr) throw delErr;

      if (f.vinculos.length > 0) {
        for (const v of f.vinculos) {
          const rCpf = onlyDigits(v.cpf);
          if (rCpf && !isValidCPF(rCpf)) throw new Error(`CPF inválido do responsável ${v.nome}.`);
          const { error: rErr } = await supabase
            .from("responsaveis")
            .update({
              nome: v.nome.trim(),
              cpf: rCpf || null,
              telefone: onlyDigits(v.telefone) || null,
            })
            .eq("id", v.responsavel_id);
          if (rErr) throw rErr;
        }
        const { error: upErr } = await supabase.from("aluno_responsavel").upsert(
          f.vinculos.map((v) => ({
            aluno_id: alunoId!,
            responsavel_id: v.responsavel_id,
            parentesco: v.parentesco,
          })),
          { onConflict: "aluno_id,responsavel_id" },
        );
        if (upErr) throw upErr;
      }
    },
    onSuccess: () => {
      toast.success("Aluno salvo");
      qc.invalidateQueries({ queryKey: ["alunos"] });
      qc.invalidateQueries({ queryKey: ["responsaveis-lookup"] });
      qc.invalidateQueries({ queryKey: ["responsaveis"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = alunosQuery.data ?? [];
    const q = query.trim().toLowerCase();
    const qDigits = onlyDigits(query);
    const nascIso = nascFilter.length === 10 ? brDateToISO(nascFilter) : null;
    return rows.filter((r) => {
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (nascIso && r.data_nascimento !== nascIso) return false;
      if (!q) return true;
      return (
        r.nome.toLowerCase().includes(q) ||
        String(r.matricula).includes(q) ||
        (r.codigo_publico ?? "").toLowerCase().includes(q) ||
        (!!qDigits && (r.cpf ?? "").includes(qDigits)) ||
        (r.rg ?? "").toLowerCase().includes(q)
      );
    });
  }, [alunosQuery.data, query, statusFilter, nascFilter]);

  const filtrosAtivos = query.trim() !== "" || statusFilter !== "todos" || nascFilter !== "";

  const summary = useMemo(() => {
    const rows = alunosQuery.data ?? [];
    return {
      total: rows.length,
      ativos: rows.filter((r) => r.status === "Ativo").length,
      pendentes: rows.filter((r) => r.status === "Pendente").length,
    };
  }, [alunosQuery.data]);

  async function openEdit(a: Aluno) {
    // Carrega vínculos atuais
    const { data: vinc } = await supabase
      .from("aluno_responsavel")
      .select("responsavel_id, parentesco, responsaveis(nome, cpf, telefone)")
      .eq("aluno_id", a.id);
    const vinculos: LinkedResp[] = (vinc ?? []).map((v) => {
      const rel = (v as { responsaveis: { nome: string; cpf: string | null; telefone: string | null } | null })
        .responsaveis;
      return {
        responsavel_id: v.responsavel_id,
        parentesco: v.parentesco,
        nome: rel?.nome ?? "",
        cpf: rel?.cpf ? maskCPF(rel.cpf) : "",
        telefone: rel?.telefone ? maskPhone(rel.telefone) : "",
      };
    });
    setForm({
      id: a.id,
      codigo_publico: a.codigo_publico ?? "",
      nome: a.nome,
      cpf: a.cpf ? maskCPF(a.cpf) : "",
      rg: a.rg ?? "",
      telefone: a.telefone ? maskPhone(a.telefone) : "",
      data_nascimento: isoDateToBR(a.data_nascimento),
      status: a.status,
      vinculos,
    });
    setOpen(true);
  }

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do aluno");
    upsert.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alunos"
        description="Cadastro dos alunos da escola."
        actions={
          isAdmin ? (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo aluno
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Total de alunos" value={summary.total} loading={alunosQuery.isLoading} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Ativos" value={summary.ativos} loading={alunosQuery.isLoading} />
        <SummaryCard icon={<Clock className="h-4 w-4 text-amber-500" />} label="Pendentes" value={summary.pendentes} loading={alunosQuery.isLoading} />
      </div>

      <Card className="border-border/70">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 p-4">
          <div className="relative w-full max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, matrícula, código, CPF ou RG..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={nascFilter}
            inputMode="numeric"
            onChange={(e) => setNascFilter(maskDate(e.target.value))}
            placeholder="Nascimento dd/mm/aaaa"
            className="w-48"
          />
          {filtrosAtivos && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatusFilter("todos");
                setNascFilter("");
              }}
            >
              <FilterX className="mr-2 h-4 w-4" /> Limpar
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {alunosQuery.data ? `${filtered.length} aluno(s)` : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunosQuery.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!alunosQuery.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum aluno encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {a.codigo_publico ?? `#${a.matricula}`}
                  </TableCell>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{a.cpf ? maskCPF(a.cpf) : "—"}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Documentos" onClick={() => setDocsAluno(a)}>
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar aluno" : "Novo aluno"}</DialogTitle>
            <DialogDescription>Dados pessoais e vínculo com responsáveis.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo">Matrícula / Código</Label>
                <Input
                  id="codigo"
                  value={form.codigo_publico}
                  onChange={(e) => setForm({ ...form, codigo_publico: e.target.value })}
                  placeholder="Auto (ALU-000001)"
                />
                <p className="text-[11px] text-muted-foreground">Deixe em branco para gerar automaticamente.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF (opcional)</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nasc">Nascimento</Label>
                <Input
                  id="nasc"
                  inputMode="numeric"
                  value={form.data_nascimento}
                  onChange={(e) => setForm({ ...form, data_nascimento: maskDate(e.target.value) })}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsáveis vinculados</Label>
              <VinculoPicker
                value={form.vinculos}
                onChange={(vinculos) => setForm({ ...form, vinculos })}
                responsaveis={responsaveisQuery.data ?? []}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsert.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!docsAluno} onOpenChange={(v) => !v && setDocsAluno(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Documentos — {docsAluno?.nome}</DialogTitle>
            <DialogDescription>
              Arquivos enviados pela escola e documentos recebidos do responsável pelo Portal.
            </DialogDescription>
          </DialogHeader>
          {docsAluno && (
            <div className="max-h-[65vh] overflow-y-auto pr-1">
              <DocumentosPanel alunoId={docsAluno.id} mode="escola" canManage={!!isAdmin} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o aluno <strong>{confirmDelete?.nome}</strong> e seus vínculos com responsáveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteAluno.mutate(confirmDelete)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
  return (
    <Card className="border-border/70 p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">
        {loading ? <Skeleton className="h-8 w-16" /> : value}
      </div>
    </Card>
  );
}

function VinculoPicker({
  value,
  onChange,
  responsaveis,
}: {
  value: LinkedResp[];
  onChange: (v: LinkedResp[]) => void;
  responsaveis: Responsavel[];
}) {
  const [open, setOpen] = useState(false);
  const linkedIds = new Set(value.map((v) => v.responsavel_id));
  const available = responsaveis.filter((r) => !linkedIds.has(r.id));

  function addVinculo(r: Responsavel) {
    onChange([...value, { responsavel_id: r.id, nome: r.nome, parentesco: "Mãe" }]);
    setOpen(false);
  }
  function removeVinculo(id: string) {
    onChange(value.filter((v) => v.responsavel_id !== id));
  }
  function updateParentesco(id: string, parentesco: string) {
    onChange(value.map((v) => (v.responsavel_id === id ? { ...v, parentesco } : v)));
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum responsável vinculado.</p>
      )}
      {value.map((v) => (
        <div key={v.responsavel_id} className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm">{v.nome}</div>
          <Select value={v.parentesco ?? ""} onValueChange={(p) => updateParentesco(v.responsavel_id, p)}>
            <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Parentesco" /></SelectTrigger>
            <SelectContent>
              {parentescos.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="icon" variant="ghost" onClick={() => removeVinculo(v.responsavel_id)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="mt-2">
            <Plus className="mr-2 h-4 w-4" /> Vincular responsável
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar responsável..." />
            <CommandList>
              <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
              <CommandGroup>
                {available.map((r) => (
                  <CommandItem key={r.id} value={r.nome} onSelect={() => addVinculo(r)}>
                    <div className="flex flex-col">
                      <span>{r.nome}</span>
                      {r.cpf && <span className="text-xs text-muted-foreground">{maskCPF(r.cpf)}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}