import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Plus, Search, TrendingDown, Wallet, CheckCircle2, Ban, Trash2, QrCode } from "lucide-react";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useServerFn } from "@tanstack/react-start";
import { gerarCobrancaAsaas } from "@/lib/asaas.functions";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — JAU ERP" },
      { name: "description", content: "Gestão de mensalidades, cobranças e recebimentos dos alunos." },
      { property: "og:title", content: "Financeiro — JAU ERP" },
      { property: "og:description", content: "Controle financeiro de mensalidades e inadimplência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccessGuard resource="financeiro">
      <FinanceiroPage />
    </AccessGuard>
  ),
});

const STATUS = ["Pendente", "Pago", "Atrasado", "Cancelado"] as const;
type StatusMens = (typeof STATUS)[number];
const FORMAS = ["PIX", "Boleto", "Cartão", "Dinheiro"] as const;
type Forma = (typeof FORMAS)[number];

type Mensalidade = {
  id: string;
  codigo_publico: string | null;
  aluno_id: string;
  responsavel_id: string | null;
  matricula_id: string | null;
  descricao: string | null;
  competencia: string | null;
  valor: number;
  vencimento: string;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  alunos: { nome: string; codigo_publico: string | null } | null;
  responsaveis: { nome: string } | null;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function effectiveStatus(m: Mensalidade): StatusMens {
  if (m.status === "Pendente" && m.vencimento < todayISO()) return "Atrasado";
  return m.status as StatusMens;
}

function StatusBadge({ status }: { status: StatusMens }) {
  switch (status) {
    case "Pago":
      return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Pago</Badge>;
    case "Atrasado":
      return <Badge variant="destructive">Atrasado</Badge>;
    case "Cancelado":
      return <Badge variant="secondary">Cancelado</Badge>;
    default:
      return <Badge variant="outline">Pendente</Badge>;
  }
}

type GerarForm = {
  modo: "turma" | "aluno";
  turma_id: string;
  aluno_id: string;
  descricao: string;
  valor: string;
  diaVencimento: string;
  competenciaInicial: string;
  parcelas: string;
};

const emptyGerar = (): GerarForm => ({
  modo: "turma",
  turma_id: "",
  aluno_id: "",
  descricao: "Mensalidade",
  valor: "",
  diaVencimento: "10",
  competenciaInicial: currentMonth(),
  parcelas: "1",
});

type BaixaForm = {
  id: string;
  data_pagamento: string;
  valor_pago: string;
  forma_pagamento: Forma;
};

function FinanceiroPage() {
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [competenciaFilter, setCompetenciaFilter] = useState<string>("");

  const [gerarOpen, setGerarOpen] = useState(false);
  const [gerarForm, setGerarForm] = useState<GerarForm>(emptyGerar());

  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaForm, setBaixaForm] = useState<BaixaForm | null>(null);

  const listQuery = useQuery({
    queryKey: ["mensalidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensalidades")
        .select(
          "id, codigo_publico, aluno_id, responsavel_id, matricula_id, descricao, competencia, valor, vencimento, status, data_pagamento, valor_pago, forma_pagamento, observacoes, alunos(nome, codigo_publico), responsaveis(nome)",
        )
        .is("deleted_at", null)
        .order("vencimento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Mensalidade[];
    },
  });

  const alunosQuery = useQuery({
    queryKey: ["alunos-opts-fin"],
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
    queryKey: ["turmas-opts-fin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas")
        .select("id, nome, codigo_publico")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const gerar = useMutation({
    mutationFn: async (f: GerarForm) => {
      const valorNum = Number(f.valor.replace(",", "."));
      if (!valorNum || valorNum <= 0) throw new Error("Informe um valor válido");
      const dia = Math.min(Math.max(Number(f.diaVencimento) || 1, 1), 28);
      const parcelas = Math.max(Number(f.parcelas) || 1, 1);

      let alunoIds: string[] = [];
      if (f.modo === "aluno") {
        if (!f.aluno_id) throw new Error("Selecione o aluno");
        alunoIds = [f.aluno_id];
      } else {
        if (!f.turma_id) throw new Error("Selecione a turma");
        const { data, error } = await supabase
          .from("matriculas")
          .select("aluno_id")
          .eq("turma_id", f.turma_id)
          .eq("status", "Ativa")
          .is("deleted_at", null);
        if (error) throw error;
        alunoIds = [...new Set((data ?? []).map((m) => m.aluno_id))];
        if (alunoIds.length === 0) throw new Error("Nenhuma matrícula ativa encontrada nesta turma");
      }

      const { data: vinculos, error: vErr } = await supabase
        .from("aluno_responsavel")
        .select("aluno_id, responsavel_id, parentesco")
        .in("aluno_id", alunoIds)
        .eq("parentesco", "Responsável Financeiro");
      if (vErr) throw vErr;
      const respMap = new Map<string, string>();
      for (const v of vinculos ?? []) respMap.set(v.aluno_id, v.responsavel_id);

      const [anoStr, mesStr] = f.competenciaInicial.split("-");
      let ano = Number(anoStr);
      let mes = Number(mesStr);

      const rows = [];
      for (const alunoId of alunoIds) {
        let curAno = ano;
        let curMes = mes;
        for (let i = 0; i < parcelas; i++) {
          const competencia = `${curAno}-${String(curMes).padStart(2, "0")}`;
          const vencimento = `${curAno}-${String(curMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          rows.push({
            aluno_id: alunoId,
            responsavel_id: respMap.get(alunoId) ?? null,
            descricao: f.descricao.trim() || "Mensalidade",
            competencia,
            valor: valorNum,
            vencimento,
            status: "Pendente",
          });
          curMes += 1;
          if (curMes > 12) { curMes = 1; curAno += 1; }
        }
      }

      const { error } = await supabase.from("mensalidades").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} mensalidade(s) gerada(s)`);
      qc.invalidateQueries({ queryKey: ["mensalidades"] });
      setGerarOpen(false);
      setGerarForm(emptyGerar());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const darBaixa = useMutation({
    mutationFn: async (f: BaixaForm) => {
      const valorPago = Number(f.valor_pago.replace(",", "."));
      if (!valorPago || valorPago <= 0) throw new Error("Informe um valor pago válido");
      const { error } = await supabase
        .from("mensalidades")
        .update({
          status: "Pago",
          data_pagamento: f.data_pagamento,
          valor_pago: valorPago,
          forma_pagamento: f.forma_pagamento,
        })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Baixa registrada");
      qc.invalidateQueries({ queryKey: ["mensalidades"] });
      setBaixaOpen(false);
      setBaixaForm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async (m: Mensalidade) => {
      const { error } = await supabase.from("mensalidades").update({ status: "Cancelado" }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensalidade cancelada");
      qc.invalidateQueries({ queryKey: ["mensalidades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (m: Mensalidade) => {
      const { error } = await supabase
        .from("mensalidades")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensalidade excluída");
      qc.invalidateQueries({ queryKey: ["mensalidades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = listQuery.data ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((m) => {
      const st = effectiveStatus(m);
      if (statusFilter !== "todos" && st !== statusFilter) return false;
      if (competenciaFilter && m.competencia !== competenciaFilter) return false;
      if (!q) return true;
      return (
        (m.codigo_publico ?? "").toLowerCase().includes(q) ||
        (m.alunos?.nome ?? "").toLowerCase().includes(q) ||
        (m.alunos?.codigo_publico ?? "").toLowerCase().includes(q)
      );
    });
  }, [listQuery.data, query, statusFilter, competenciaFilter]);

  const dashboard = useMemo(() => {
    const rows = listQuery.data ?? [];
    const mes = currentMonth();
    let recebido = 0;
    let aReceber = 0;
    let totalMes = 0;
    let vencidosNaoPagos = 0;

    for (const m of rows) {
      if (m.status === "Pago" && (m.data_pagamento ?? "").slice(0, 7) === mes) {
        recebido += m.valor_pago ?? 0;
      }
      if (m.status === "Pendente" || m.status === "Atrasado") {
        aReceber += m.valor;
      }
      if (m.competencia === mes) {
        totalMes += 1;
        if (effectiveStatus(m) === "Atrasado") vencidosNaoPagos += 1;
      }
    }
    const inadimplencia = totalMes > 0 ? (vencidosNaoPagos / totalMes) * 100 : 0;
    return { recebido, aReceber, inadimplencia };
  }, [listQuery.data]);

  function openBaixa(m: Mensalidade) {
    void 0;
    setBaixaForm({
      id: m.id,
      data_pagamento: todayISO(),
      valor_pago: String(m.valor),
      forma_pagamento: "PIX",
    });
    setBaixaOpen(true);
  }

  function handleBaixaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!baixaForm) return;
    darBaixa.mutate(baixaForm);
  }

  function handleGerarSubmit(e: React.FormEvent) {
    e.preventDefault();
    gerar.mutate(gerarForm);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Mensalidades, recebimentos e inadimplência."
        actions={
          isAdmin ? (
            <Button onClick={() => setGerarOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Gerar mensalidades
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border/70 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido no mês</p>
              <p className="text-xl font-semibold">{currency.format(dashboard.recebido)}</p>
            </div>
          </div>
        </Card>
        <Card className="border-border/70 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-accent/10 p-2 text-accent-foreground">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total a receber</p>
              <p className="text-xl font-semibold">{currency.format(dashboard.aReceber)}</p>
            </div>
          </div>
        </Card>
        <Card className="border-border/70 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-2 text-destructive">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxa de inadimplência (mês)</p>
              <p className="text-xl font-semibold">{dashboard.inadimplencia.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-border/70">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por aluno ou código..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="month"
            value={competenciaFilter}
            onChange={(e) => setCompetenciaFilter(e.target.value)}
            className="w-full sm:w-44"
          />
          <div className="text-xs text-muted-foreground sm:ml-auto">
            {listQuery.data ? `${filtered.length} mensalidade(s)` : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={isAdmin ? 8 : 7}><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))}
              {!listQuery.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma mensalidade encontrada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((m) => {
                const st = effectiveStatus(m);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{m.codigo_publico ?? "—"}</TableCell>
                    <TableCell className="font-medium">{m.alunos?.nome ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.responsaveis?.nome ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.competencia ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(m.vencimento)}</TableCell>
                    <TableCell>{currency.format(m.status === "Pago" ? m.valor_pago ?? m.valor : m.valor)}</TableCell>
                    <TableCell><StatusBadge status={st} /></TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {st !== "Pago" && st !== "Cancelado" && (
                            <Button size="sm" variant="ghost" title="Dar baixa" onClick={() => openBaixa(m)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {st !== "Pago" && st !== "Cancelado" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Gerar cobrança no Asaas"
                              disabled={cobrarAsaas.isPending}
                              onClick={() => cobrarAsaas.mutate(m.id)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          )}
                          {st !== "Pago" && st !== "Cancelado" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Cancelar"
                              onClick={() => {
                                if (confirm("Cancelar esta mensalidade?")) cancelar.mutate(m);
                              }}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Excluir"
                            onClick={() => {
                              if (confirm(`Excluir mensalidade de "${m.alunos?.nome ?? ""}"?`)) excluir.mutate(m);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={gerarOpen} onOpenChange={setGerarOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar mensalidades</DialogTitle>
            <DialogDescription>Crie parcelas para uma turma inteira ou para um único aluno.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGerarSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Gerar para</Label>
              <Select
                value={gerarForm.modo}
                onValueChange={(v) => setGerarForm({ ...gerarForm, modo: v as GerarForm["modo"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="turma">Turma (todas as matrículas ativas)</SelectItem>
                  <SelectItem value="aluno">Aluno específico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {gerarForm.modo === "turma" ? (
              <div className="space-y-2">
                <Label>Turma *</Label>
                <Select value={gerarForm.turma_id} onValueChange={(v) => setGerarForm({ ...gerarForm, turma_id: v })}>
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
            ) : (
              <div className="space-y-2">
                <Label>Aluno *</Label>
                <Select value={gerarForm.aluno_id} onValueChange={(v) => setGerarForm({ ...gerarForm, aluno_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                  <SelectContent>
                    {(alunosQuery.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.codigo_publico ? `${a.codigo_publico} — ` : ""}{a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="descr">Descrição</Label>
              <Input
                id="descr"
                value={gerarForm.descricao}
                onChange={(e) => setGerarForm({ ...gerarForm, descricao: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor"
                  inputMode="decimal"
                  value={gerarForm.valor}
                  onChange={(e) => setGerarForm({ ...gerarForm, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dia">Dia de vencimento</Label>
                <Input
                  id="dia"
                  inputMode="numeric"
                  value={gerarForm.diaVencimento}
                  onChange={(e) => setGerarForm({ ...gerarForm, diaVencimento: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="comp">Competência inicial</Label>
                <Input
                  id="comp"
                  type="month"
                  value={gerarForm.competenciaInicial}
                  onChange={(e) => setGerarForm({ ...gerarForm, competenciaInicial: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parc">Quantidade de parcelas</Label>
                <Input
                  id="parc"
                  inputMode="numeric"
                  value={gerarForm.parcelas}
                  onChange={(e) => setGerarForm({ ...gerarForm, parcelas: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setGerarOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={gerar.isPending}>Gerar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dar baixa</DialogTitle>
            <DialogDescription>Registre o recebimento desta mensalidade.</DialogDescription>
          </DialogHeader>
          {baixaForm && (
            <form onSubmit={handleBaixaSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dtp">Data de pagamento</Label>
                <Input
                  id="dtp"
                  type="date"
                  value={baixaForm.data_pagamento}
                  onChange={(e) => setBaixaForm({ ...baixaForm, data_pagamento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vlp">Valor pago (R$)</Label>
                <Input
                  id="vlp"
                  inputMode="decimal"
                  value={baixaForm.valor_pago}
                  onChange={(e) => setBaixaForm({ ...baixaForm, valor_pago: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select
                  value={baixaForm.forma_pagamento}
                  onValueChange={(v) => setBaixaForm({ ...baixaForm, forma_pagamento: v as Forma })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setBaixaOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={darBaixa.isPending}>Confirmar baixa</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
