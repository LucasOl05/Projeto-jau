import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ExternalLink, FileText, Loader2, Plus, Repeat } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { gerarCobrancaEmpresaAsaas } from "@/lib/asaas.functions";
import { brDateToISO, maskDate } from "@/lib/masks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type EmpresaBasica = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
};

type Cobranca = {
  id: string;
  codigo_publico: string | null;
  competencia: string | null;
  descricao: string | null;
  valor: number;
  vencimento: string;
  data_pagamento: string | null;
  status: string;
  status_fiscal: string | null;
  numero_nfse: string | null;
  url_pdf_nfse: string | null;
  url_xml_nfse: string | null;
  forma_pagamento: string | null;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_pix_payload: string | null;
};

type Recorrente = {
  id: string;
  empresa_id: string;
  descricao: string | null;
  valor: number;
  dia_vencimento: number;
  forma_pagamento: string;
  status: string;
};

const currency = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBR = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const emptyCobranca = {
  competencia: "",
  descricao: "",
  valor: "",
  vencimento: "",
  forma_pagamento: "BOLETO",
};

const emptyRecorrente = {
  descricao: "",
  valor: "",
  dia_vencimento: "10",
  forma_pagamento: "BOLETO",
  status: "ATIVA",
};

export function EmpresaFinanceiroDialog({
  empresa,
  onOpenChange,
  canManage,
}: {
  empresa: EmpresaBasica | null;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [novaOpen, setNovaOpen] = useState(false);
  const [form, setForm] = useState(emptyCobranca);
  const [recorrenteOpen, setRecorrenteOpen] = useState(false);
  const [recForm, setRecForm] = useState(emptyRecorrente);
  const [detalhe, setDetalhe] = useState<Cobranca | null>(null);
  const gerarCobranca = useServerFn(gerarCobrancaEmpresaAsaas);

  const cobrancasQuery = useQuery({
    queryKey: ["faturas_empresas", empresa?.id],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faturas_empresas")
        .select("*")
        .eq("empresa_id", empresa!.id)
        .is("deleted_at", null)
        .order("vencimento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cobranca[];
    },
  });

  const recorrenteQuery = useQuery({
    queryKey: ["mensalidades_empresas", empresa?.id],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensalidades_empresas")
        .select("*")
        .eq("empresa_id", empresa!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as unknown as Recorrente | null;
    },
  });

  const resumo = useMemo(() => {
    const rows = cobrancasQuery.data ?? [];
    const hoje = new Date().toISOString().slice(0, 10);
    let aberto = 0;
    let vencido = 0;
    let pago = 0;
    for (const c of rows) {
      const quitada = c.status === "Paga" || c.status === "Pago";
      if (quitada) pago += Number(c.valor);
      else if (c.vencimento < hoje) vencido += Number(c.valor);
      else aberto += Number(c.valor);
    }
    return { aberto, vencido, pago };
  }, [cobrancasQuery.data]);

  const salvarCobranca = useMutation({
    mutationFn: async () => {
      if (!empresa) return;
      const iso = brDateToISO(form.vencimento);
      if (!form.valor || !iso) throw new Error("Informe valor e vencimento.");
      const { error } = await supabase.from("faturas_empresas").insert({
        empresa_id: empresa.id,
        competencia: form.competencia || null,
        descricao: form.descricao || null,
        valor: Number(form.valor.replace(",", ".")),
        vencimento: iso,
        forma_pagamento: form.forma_pagamento,
        status: "Pendente",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança lançada.");
      setNovaOpen(false);
      setForm(emptyCobranca);
      qc.invalidateQueries({ queryKey: ["faturas_empresas", empresa?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarRecorrente = useMutation({
    mutationFn: async () => {
      if (!empresa) return;
      const payload = {
        empresa_id: empresa.id,
        descricao: recForm.descricao || null,
        valor: Number(recForm.valor.replace(",", ".")),
        dia_vencimento: Number(recForm.dia_vencimento),
        forma_pagamento: recForm.forma_pagamento,
        status: recForm.status,
      };
      if (!payload.valor) throw new Error("Informe o valor da mensalidade.");
      const atual = recorrenteQuery.data;
      if (atual) {
        const { error } = await supabase
          .from("mensalidades_empresas")
          .update(payload as never)
          .eq("id", atual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mensalidades_empresas").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Mensalidade recorrente salva.");
      setRecorrenteOpen(false);
      qc.invalidateQueries({ queryKey: ["mensalidades_empresas", empresa?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emitir = useMutation({
    mutationFn: async (c: Cobranca) =>
      gerarCobranca({
        data: {
          faturaId: c.id,
          billingType: (c.forma_pagamento === "PIX" ? "PIX" : "BOLETO") as "PIX" | "BOLETO",
        },
      }),
    onSuccess: () => {
      toast.success("Cobrança gerada no meio de pagamento.");
      qc.invalidateQueries({ queryKey: ["faturas_empresas", empresa?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixar = useMutation({
    mutationFn: async (c: Cobranca) => {
      const { error } = await supabase
        .from("faturas_empresas")
        .update({
          status: "Paga",
          data_pagamento: new Date().toISOString().slice(0, 10),
        } as never)
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      qc.invalidateQueries({ queryKey: ["faturas_empresas", empresa?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rec = recorrenteQuery.data;

  return (
    <>
      <Dialog open={!!empresa} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Financeiro — {empresa?.nome_fantasia || empresa?.razao_social}
            </DialogTitle>
            <DialogDescription>
              Cobranças da empresa parceira. A situação financeira é independente da situação
              fiscal da nota.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Em aberto</p>
              <p className="text-xl font-semibold text-foreground">{currency(resumo.aberto)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Vencido</p>
              <p className="text-xl font-semibold text-destructive">{currency(resumo.vencido)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Pago no período</p>
              <p className="text-xl font-semibold text-foreground">{currency(resumo.pago)}</p>
            </Card>
          </div>

          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Mensalidade recorrente</p>
              <p className="text-xs text-muted-foreground">
                {rec
                  ? `${currency(rec.valor)} · todo dia ${rec.dia_vencimento} · ${rec.forma_pagamento} · ${rec.status}`
                  : "Nenhuma mensalidade configurada."}
              </p>
            </div>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRecForm(
                    rec
                      ? {
                          descricao: rec.descricao ?? "",
                          valor: String(rec.valor),
                          dia_vencimento: String(rec.dia_vencimento),
                          forma_pagamento: rec.forma_pagamento,
                          status: rec.status,
                        }
                      : emptyRecorrente,
                  );
                  setRecorrenteOpen(true);
                }}
              >
                <Repeat className="mr-2 h-4 w-4" />
                {rec ? "Editar" : "Configurar"}
              </Button>
            )}
          </Card>

          {canManage && (
            <Button
              size="sm"
              className="w-fit"
              onClick={() => {
                setForm(emptyCobranca);
                setNovaOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova cobrança avulsa
            </Button>
          )}

          {cobrancasQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (cobrancasQuery.data ?? []).length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma cobrança lançada.
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Financeiro</TableHead>
                    <TableHead>Fiscal</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cobrancasQuery.data ?? []).map((c) => {
                    const quitada = c.status === "Paga" || c.status === "Pago";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.codigo_publico ? `${c.codigo_publico} · ` : ""}
                          {c.descricao ?? c.competencia ?? "Cobrança"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{dataBR(c.vencimento)}</TableCell>
                        <TableCell>{currency(c.valor)}</TableCell>
                        <TableCell>
                          <Badge variant={quitada ? "default" : "secondary"}>{c.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status_fiscal ?? "PENDENTE"}</Badge>
                        </TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setDetalhe(c)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          {canManage && !c.asaas_payment_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={emitir.isPending}
                              onClick={() => emitir.mutate(c)}
                            >
                              Gerar
                            </Button>
                          )}
                          {canManage && !quitada && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={baixar.isPending}
                              onClick={() => baixar.mutate(c)}
                            >
                              Baixar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhes da cobrança */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detalhe?.descricao ?? detalhe?.competencia ?? "Cobrança"}</DialogTitle>
            <DialogDescription>
              {currency(detalhe?.valor)} · vencimento {dataBR(detalhe?.vencimento ?? null)} ·{" "}
              {detalhe?.status}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {detalhe?.asaas_pix_payload ? (
              <div className="space-y-2">
                <Label>PIX copia e cola</Label>
                <div className="flex gap-2">
                  <Input readOnly value={detalhe.asaas_pix_payload} />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(detalhe.asaas_pix_payload as string);
                      toast.success("Código PIX copiado.");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <img
                  alt="QR Code do PIX da cobrança"
                  className="h-44 w-44 rounded-md border border-border bg-background p-2"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(detalhe.asaas_pix_payload)}`}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                PIX disponível após gerar a cobrança com forma de pagamento PIX.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {detalhe?.asaas_bank_slip_url && (
                <Button asChild variant="outline" size="sm">
                  <a href={detalhe.asaas_bank_slip_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> Boleto
                  </a>
                </Button>
              )}
              {detalhe?.asaas_invoice_url && (
                <Button asChild variant="outline" size="sm">
                  <a href={detalhe.asaas_invoice_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> Fatura
                  </a>
                </Button>
              )}
              {detalhe?.url_pdf_nfse && (
                <Button asChild variant="outline" size="sm">
                  <a href={detalhe.url_pdf_nfse} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> NFS-e (PDF)
                  </a>
                </Button>
              )}
              {detalhe?.url_xml_nfse && (
                <Button asChild variant="outline" size="sm">
                  <a href={detalhe.url_xml_nfse} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> NFS-e (XML)
                  </a>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Situação fiscal: {detalhe?.status_fiscal ?? "PENDENTE"}
              {detalhe?.numero_nfse ? ` · Nota ${detalhe.numero_nfse}` : ""}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova cobrança avulsa */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova cobrança avulsa</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              salvarCobranca.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Competência</Label>
              <Input
                placeholder="Ex: 09/2026"
                value={form.competencia}
                onChange={(e) => setForm({ ...form, competencia: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  required
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  required
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  value={form.vencimento}
                  onChange={(e) => setForm({ ...form, vencimento: maskDate(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={form.forma_pagamento}
                onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNovaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvarCobranca.isPending}>
                {salvarCobranca.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lançar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mensalidade recorrente */}
      <Dialog open={recorrenteOpen} onOpenChange={setRecorrenteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensalidade recorrente</DialogTitle>
            <DialogDescription>
              Valor cobrado todo mês desta empresa parceira.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              salvarRecorrente.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={recForm.descricao}
                onChange={(e) => setRecForm({ ...recForm, descricao: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  required
                  inputMode="decimal"
                  placeholder="0,00"
                  value={recForm.valor}
                  onChange={(e) => setRecForm({ ...recForm, valor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dia do vencimento *</Label>
                <Input
                  required
                  inputMode="numeric"
                  value={recForm.dia_vencimento}
                  onChange={(e) =>
                    setRecForm({ ...recForm, dia_vencimento: e.target.value.replace(/\D/g, "").slice(0, 2) })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select
                  value={recForm.forma_pagamento}
                  onValueChange={(v) => setRecForm({ ...recForm, forma_pagamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select
                  value={recForm.status}
                  onValueChange={(v) => setRecForm({ ...recForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVA">Ativa</SelectItem>
                    <SelectItem value="INATIVA">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRecorrenteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvarRecorrente.isPending}>
                {salvarRecorrente.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
