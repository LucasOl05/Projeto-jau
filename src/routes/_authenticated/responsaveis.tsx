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
import { useIsAdmin } from "@/hooks/use-is-admin";
import { isValidCPF, maskCPF, maskPhone, onlyDigits } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/responsaveis")({
  head: () => ({ meta: [{ title: "Responsáveis — JAU ERP" }] }),
  component: () => (
    <AccessGuard resource="responsaveis">
      <ResponsaveisPage />
    </AccessGuard>
  ),
});

type Responsavel = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
};

type FormState = {
  id?: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
};

const emptyForm: FormState = { nome: "", cpf: "", telefone: "", email: "" };

function ResponsaveisPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const responsaveisQuery = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("*")
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Responsavel[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const cpfDigits = onlyDigits(f.cpf);
      if (cpfDigits && !isValidCPF(cpfDigits)) {
        throw new Error("CPF inválido.");
      }
      // Verifica duplicidade de CPF
      if (cpfDigits) {
        const { data: dup, error: dupErr } = await supabase
          .from("responsaveis")
          .select("id")
          .eq("cpf", cpfDigits)
          .maybeSingle();
        if (dupErr) throw dupErr;
        if (dup && dup.id !== f.id) {
          throw new Error("Já existe um responsável com esse CPF.");
        }
      }
      const payload = {
        nome: f.nome.trim(),
        cpf: cpfDigits || null,
        telefone: onlyDigits(f.telefone) || null,
        email: f.email.trim() || null,
      };
      if (f.id) {
        const { error } = await supabase.from("responsaveis").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("responsaveis").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Responsável salvo");
      qc.invalidateQueries({ queryKey: ["responsaveis"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (r: Responsavel) => {
      const { error } = await supabase
        .from("responsaveis")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável excluído");
      qc.invalidateQueries({ queryKey: ["responsaveis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = responsaveisQuery.data ?? [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    const qDigits = onlyDigits(query);
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        (qDigits && (r.cpf ?? "").includes(qDigits)),
    );
  }, [responsaveisQuery.data, query]);

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(r: Responsavel) {
    setForm({
      id: r.id,
      nome: r.nome,
      cpf: r.cpf ? maskCPF(r.cpf) : "",
      telefone: r.telefone ? maskPhone(r.telefone) : "",
      email: r.email ?? "",
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do responsável");
    upsert.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Responsáveis"
        description="Cadastro dos responsáveis pelos alunos."
        actions={
          isAdmin ? (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo responsável
            </Button>
          ) : null
        }
      />

      <Card className="border-border/70">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 p-4">
          <div className="relative w-full max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="pl-9"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {responsaveisQuery.data ? `${filtered.length} responsável(is)` : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {responsaveisQuery.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={isAdmin ? 5 : 4}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!responsaveisQuery.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum responsável encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{r.cpf ? maskCPF(r.cpf) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.telefone ? maskPhone(r.telefone) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                  {isAdmin && (
                    <TableCell className="space-x-1 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir o responsável "${r.nome}"?`)) softDelete.mutate(r);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>{form.id ? "Editar responsável" : "Novo responsável"}</DialogTitle>
            <DialogDescription>Dados de contato do responsável.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  inputMode="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="responsavel@exemplo.com"
              />
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