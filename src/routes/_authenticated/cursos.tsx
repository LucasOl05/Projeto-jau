import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, Power, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/cursos")({
  head: () => ({ meta: [{ title: "Cursos — JAU ERP" }] }),
  component: CursosPage,
});

type Curso = {
  id: string;
  nome: string;
  descricao: string | null;
  carga_horaria: number | null;
  valor: number | null;
  frequencia_minima: number;
  ativo: boolean;
  created_at: string;
};

type FormState = {
  id?: string;
  nome: string;
  descricao: string;
  carga_horaria: string;
  valor: string;
  frequencia_minima: string;
};

const emptyForm: FormState = {
  nome: "",
  descricao: "",
  carga_horaria: "",
  valor: "",
  frequencia_minima: "75",
};

function CursosPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const cursosQuery = useQuery({
    queryKey: ["cursos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Curso[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        nome: f.nome.trim(),
        descricao: f.descricao.trim() || null,
        carga_horaria: f.carga_horaria ? Number(f.carga_horaria) : null,
        valor: f.valor ? Number(f.valor) : null,
        frequencia_minima: f.frequencia_minima ? Number(f.frequencia_minima) : 75,
      };
      if (f.id) {
        const { error } = await supabase.from("cursos").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cursos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Curso salvo");
      qc.invalidateQueries({ queryKey: ["cursos"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (c: Curso) => {
      const { error } = await supabase.from("cursos").update({ ativo: !c.ativo }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: (_d, c) => {
      toast.success(c.ativo ? "Curso desativado" : "Curso ativado");
      qc.invalidateQueries({ queryKey: ["cursos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = cursosQuery.data ?? [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => r.nome.toLowerCase().includes(q));
  }, [cursosQuery.data, query]);

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(c: Curso) {
    setForm({
      id: c.id,
      nome: c.nome,
      descricao: c.descricao ?? "",
      carga_horaria: c.carga_horaria?.toString() ?? "",
      valor: c.valor?.toString() ?? "",
      frequencia_minima: c.frequencia_minima?.toString() ?? "75",
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do curso");
    upsert.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cursos"
        description="Cadastro de cursos profissionalizantes."
        actions={
          isAdmin ? (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo curso
            </Button>
          ) : null
        }
      />

      <Card className="border-border/70">
        <div className="flex items-center gap-3 border-b border-border/70 p-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-9"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {cursosQuery.data ? `${filtered.length} curso(s)` : ""}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Carga horária</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Frequência mín.</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cursosQuery.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={isAdmin ? 6 : 5}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!cursosQuery.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum curso encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-muted-foreground">{c.carga_horaria ? `${c.carga_horaria}h` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.valor != null ? c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.frequencia_minima}%</TableCell>
                <TableCell>
                  {c.ativo ? (
                    <Badge>Ativo</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">Inativo</Badge>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleAtivo.mutate(c)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir o curso "${c.nome}"?`)) softDelete.mutate(c);
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
            <DialogTitle>{form.id ? "Editar curso" : "Novo curso"}</DialogTitle>
            <DialogDescription>Preencha os dados do curso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch">Carga horária</Label>
                <Input id="ch" type="number" min="0" value={form.carga_horaria} onChange={(e) => setForm({ ...form, carga_horaria: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input id="valor" type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freq">Freq. mín. (%)</Label>
                <Input id="freq" type="number" min="0" max="100" value={form.frequencia_minima} onChange={(e) => setForm({ ...form, frequencia_minima: e.target.value })} />
              </div>
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