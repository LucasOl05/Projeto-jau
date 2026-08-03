import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/disciplinas")({
  head: () => ({ meta: [{ title: "Disciplinas — JAU ERP" }] }),
  component: DisciplinasPage,
});

type Disciplina = {
  id: string;
  codigo_publico: string | null;
  nome: string;
  turma_id: string;
  professor_id: string | null;
  ativo: boolean;
  status: string;
  deleted_at: string | null;
};
type TurmaOpt = { id: string; nome: string; codigo_publico: string | null };
type ProfOpt = { id: string; nome: string; ativo: boolean };

type FormState = {
  id?: string;
  nome: string;
  turma_id: string;
  professor_id: string;
};
const emptyForm: FormState = { nome: "", turma_id: "", professor_id: "" };

function DisciplinasPage() {
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const listQuery = useQuery({
    queryKey: ["disciplinas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplinas")
        .select("id, codigo_publico, nome, turma_id, professor_id, ativo, status, deleted_at")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Disciplina[];
    },
  });

  const turmasQuery = useQuery({
    queryKey: ["turmas-opts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas").select("id, nome, codigo_publico").order("nome");
      if (error) throw error;
      return (data ?? []) as TurmaOpt[];
    },
  });

  const profsQuery = useQuery({
    queryKey: ["professores-opts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professores").select("id, nome, ativo").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as ProfOpt[];
    },
  });

  const turmasById = useMemo(() => {
    const m = new Map<string, TurmaOpt>();
    (turmasQuery.data ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [turmasQuery.data]);
  const profsById = useMemo(() => {
    const m = new Map<string, ProfOpt>();
    (profsQuery.data ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [profsQuery.data]);

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        nome: f.nome.trim(),
        turma_id: f.turma_id,
        professor_id: f.professor_id || null,
      };
      if (f.id) {
        const { error } = await supabase.from("disciplinas").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("disciplinas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Disciplina salva");
      qc.invalidateQueries({ queryKey: ["disciplinas-list"] });
      qc.invalidateQueries({ queryKey: ["disciplinas"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (d: Disciplina) => {
      const { error } = await supabase
        .from("disciplinas")
        .update({ deleted_at: new Date().toISOString(), status: "Excluído", ativo: false })
        .eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Disciplina excluída");
      qc.invalidateQueries({ queryKey: ["disciplinas-list"] });
      qc.invalidateQueries({ queryKey: ["disciplinas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = listQuery.data ?? [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => {
      const turmaNome = turmasById.get(r.turma_id)?.nome ?? "";
      const profNome = r.professor_id ? profsById.get(r.professor_id)?.nome ?? "" : "";
      return (
        r.nome.toLowerCase().includes(q) ||
        (r.codigo_publico ?? "").toLowerCase().includes(q) ||
        turmaNome.toLowerCase().includes(q) ||
        profNome.toLowerCase().includes(q)
      );
    });
  }, [listQuery.data, query, turmasById, profsById]);

  function openNew() { setForm(emptyForm); setOpen(true); }
  function openEdit(d: Disciplina) {
    setForm({ id: d.id, nome: d.nome, turma_id: d.turma_id, professor_id: d.professor_id ?? "" });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.turma_id) return toast.error("Selecione a turma");
    if (!form.nome.trim()) return toast.error("Informe o nome da disciplina");
    upsert.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disciplinas"
        description="Disciplinas por turma e professor titular."
        actions={isAdmin ? (
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova disciplina</Button>
        ) : null}
      />

      <Card className="border-border/70">
        <div className="flex items-center gap-3 border-b border-border/70 p-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, código, turma ou professor..."
              className="pl-9"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {listQuery.data ? `${filtered.length} disciplina(s)` : ""}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead>Professor</TableHead>
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
                  Nenhuma disciplina cadastrada.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{d.codigo_publico ?? "—"}</TableCell>
                <TableCell className="font-medium">{d.nome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {turmasById.get(d.turma_id)?.nome ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {d.professor_id ? profsById.get(d.professor_id)?.nome ?? "—" : "—"}
                </TableCell>
                <TableCell>
                  {d.ativo ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir disciplina "${d.nome}"?`)) softDelete.mutate(d);
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
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar disciplina" : "Nova disciplina"}</DialogTitle>
            <DialogDescription>Vincule a disciplina a uma turma e ao professor titular.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="dnome">Nome da disciplina *</Label>
              <Input
                id="dnome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Professor titular</Label>
              <Select
                value={form.professor_id || "none"}
                onValueChange={(v) => setForm({ ...form, professor_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sem professor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem professor</SelectItem>
                  {(profsQuery.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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