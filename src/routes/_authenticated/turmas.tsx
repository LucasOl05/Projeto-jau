import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, Power, Trash2 } from "lucide-react";
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
import { EstruturaTabs } from "@/components/estrutura-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/turmas")({
  head: () => ({ meta: [{ title: "Turmas — JAU ERP" }] }),
  component: () => (
    <AccessGuard resource="estrutura">
      <TurmasPage />
    </AccessGuard>
  ),
});

type Turma = {
  id: string;
  curso_id: string;
  nome: string;
  horario: string | null;
  dias_semana: string[];
  vagas_totais: number | null;
  data_inicio: string | null;
  data_termino: string | null;
  ativo: boolean;
  created_at: string;
};

type CursoOpt = { id: string; nome: string; ativo: boolean };

const DIAS = [
  { v: "seg", l: "Seg" },
  { v: "ter", l: "Ter" },
  { v: "qua", l: "Qua" },
  { v: "qui", l: "Qui" },
  { v: "sex", l: "Sex" },
  { v: "sab", l: "Sáb" },
  { v: "dom", l: "Dom" },
];

type FormState = {
  id?: string;
  curso_id: string;
  nome: string;
  horario: string;
  dias_semana: string[];
  vagas_totais: string;
  data_inicio: string;
  data_termino: string;
};

const emptyForm: FormState = {
  curso_id: "",
  nome: "",
  horario: "",
  dias_semana: [],
  vagas_totais: "",
  data_inicio: "",
  data_termino: "",
};

function TurmasPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const turmasQuery = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
  });

  const cursosQuery = useQuery({
    queryKey: ["cursos", "opts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nome, ativo")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as CursoOpt[];
    },
  });

  const cursosById = useMemo(() => {
    const m = new Map<string, CursoOpt>();
    (cursosQuery.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [cursosQuery.data]);

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        curso_id: f.curso_id,
        nome: f.nome.trim(),
        horario: f.horario.trim() || null,
        dias_semana: f.dias_semana,
        vagas_totais: f.vagas_totais ? Number(f.vagas_totais) : null,
        data_inicio: f.data_inicio || null,
        data_termino: f.data_termino || null,
      };
      if (f.id) {
        const { error } = await supabase.from("turmas").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("turmas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Turma salva");
      qc.invalidateQueries({ queryKey: ["turmas"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (t: Turma) => {
      const { error } = await supabase.from("turmas").update({ ativo: !t.ativo }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: (_d, t) => {
      toast.success(t.ativo ? "Turma fechada" : "Turma reaberta");
      qc.invalidateQueries({ queryKey: ["turmas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (t: Turma) => {
      const { error } = await supabase
        .from("turmas")
        .update({ deleted_at: new Date().toISOString(), ativo: false })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma excluída");
      qc.invalidateQueries({ queryKey: ["turmas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = turmasQuery.data ?? [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => {
      const cursoNome = cursosById.get(r.curso_id)?.nome ?? "";
      return r.nome.toLowerCase().includes(q) || cursoNome.toLowerCase().includes(q);
    });
  }, [turmasQuery.data, query, cursosById]);

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(t: Turma) {
    setForm({
      id: t.id,
      curso_id: t.curso_id,
      nome: t.nome,
      horario: t.horario ?? "",
      dias_semana: t.dias_semana ?? [],
      vagas_totais: t.vagas_totais?.toString() ?? "",
      data_inicio: t.data_inicio ?? "",
      data_termino: t.data_termino ?? "",
    });
    setOpen(true);
  }

  function toggleDia(v: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      dias_semana: checked ? [...f.dias_semana, v] : f.dias_semana.filter((d) => d !== v),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.curso_id) return toast.error("Selecione o curso");
    if (!form.nome.trim()) return toast.error("Informe o nome da turma");
    upsert.mutate(form);
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  }

  return (
    <div className="space-y-6">
      <EstruturaTabs />
      <PageHeader
        title="Turmas"
        description="Turmas vinculadas aos cursos cadastrados."
        actions={
          isAdmin ? (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nova turma
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
              placeholder="Buscar por turma ou curso..."
              className="pl-9"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {turmasQuery.data ? `${filtered.length} turma(s)` : ""}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Término</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {turmasQuery.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={isAdmin ? 8 : 7}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!turmasQuery.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma turma encontrada.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell className="text-muted-foreground">{cursosById.get(t.curso_id)?.nome ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.horario ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.dias_semana?.length ? t.dias_semana.join(", ") : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(t.data_inicio)}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(t.data_termino)}</TableCell>
                <TableCell>
                  {t.ativo ? (
                    <Badge>Aberta</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">Fechada</Badge>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleAtivo.mutate(t)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir a turma "${t.nome}"?`)) softDelete.mutate(t);
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
            <DialogTitle>{form.id ? "Editar turma" : "Nova turma"}</DialogTitle>
            <DialogDescription>Preencha os dados da turma.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Curso *</Label>
              <Select value={form.curso_id} onValueChange={(v) => setForm({ ...form, curso_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um curso" />
                </SelectTrigger>
                <SelectContent>
                  {(cursosQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {!c.ativo && "(inativo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tnome">Nome da turma *</Label>
              <Input id="tnome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hor">Horário</Label>
                <Input id="hor" placeholder="19h - 22h" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vagas">Vagas totais</Label>
                <Input id="vagas" type="number" min="0" value={form.vagas_totais} onChange={(e) => setForm({ ...form, vagas_totais: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-3">
                {DIAS.map((d) => (
                  <label key={d.v} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.dias_semana.includes(d.v)}
                      onCheckedChange={(c) => toggleDia(d.v, !!c)}
                    />
                    {d.l}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="di">Data de início</Label>
                <Input id="di" type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dt">Data de término</Label>
                <Input id="dt" type="date" value={form.data_termino} onChange={(e) => setForm({ ...form, data_termino: e.target.value })} />
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