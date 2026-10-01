import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, FileText, LogOut, Receipt } from "lucide-react";

import { acessarPortalEmpresa } from "@/lib/portal-empresa.functions";
import type { PortalEmpresaSessao } from "@/lib/portal-empresa.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/portal-empresa")({
  head: () => ({
    meta: [
      { title: "Portal da Empresa — JAU" },
      { name: "description", content: "Empresas parceiras consultam faturas, boletos, PIX e notas fiscais da JAU." },
      { property: "og:title", content: "Portal da Empresa — JAU" },
      { property: "og:description", content: "Faturas, boletos e histórico de pagamentos das empresas parceiras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalEmpresaPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—");

function situacao(status: string, venc: string) {
  if (status === "Paga") return { label: "Paga", variant: "default" as const };
  if (status === "Cancelada") return { label: "Cancelada", variant: "secondary" as const };
  if (venc < new Date().toISOString().slice(0, 10)) return { label: "Vencida", variant: "destructive" as const };
  return { label: "Em aberto", variant: "outline" as const };
}

function PortalEmpresaPage() {
  const acessar = useServerFn(acessarPortalEmpresa);
  const [cnpj, setCnpj] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessao, setSessao] = useState<PortalEmpresaSessao | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      setSessao(await acessar({ data: { cnpj, codigo } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  if (!sessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center"><BrandLogo /></div>
          <Card>
            <CardHeader><CardTitle>Portal da Empresa</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={entrar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código de acesso</Label>
                  <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="EMP-000001" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            É aluno ou responsável? <Link to="/portal-acesso" className="underline underline-offset-4">Portal do Aluno</Link>
          </p>
        </div>
      </div>
    );
  }

  const f = sessao.faturas;
  const hoje = new Date().toISOString().slice(0, 10);
  const aberto = f.filter((x) => x.status !== "Paga" && x.status !== "Cancelada" && x.vencimento >= hoje).reduce((s, x) => s + Number(x.valor), 0);
  const vencido = f.filter((x) => x.status !== "Paga" && x.status !== "Cancelada" && x.vencimento < hoje).reduce((s, x) => s + Number(x.valor), 0);
  const pago = f.filter((x) => x.status === "Paga").reduce((s, x) => s + Number(x.valor), 0);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{sessao.empresa.nome_fantasia || sessao.empresa.razao_social}</h1>
            <p className="text-sm text-muted-foreground">{sessao.empresa.cnpj} · {sessao.empresa.codigo_publico}</p>
          </div>
          <Button variant="outline" onClick={() => setSessao(null)}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[["Em aberto", aberto], ["Vencido", vencido], ["Pago", pago]].map(([l, v]) => (
            <Card key={l as string}><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{l}</p>
              <p className="text-xl font-semibold text-foreground">{brl(v as number)}</p>
            </CardContent></Card>
          ))}
        </div>

        <div className="space-y-3">
          {f.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fatura até o momento.</p>}
          {f.map((x) => {
            const s = situacao(x.status, x.vencimento);
            const aberta = x.status !== "Paga" && x.status !== "Cancelada";
            return (
              <Card key={x.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{x.descricao || x.competencia || x.codigo_publico}</p>
                      <p className="text-sm text-muted-foreground">
                        Vencimento {data(x.vencimento)}{x.data_pagamento ? ` · Pago em ${data(x.data_pagamento)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{brl(Number(x.valor))}</p>
                      <div className="mt-1 flex justify-end gap-1">
                        <Badge variant={s.variant}>{s.label}</Badge>
                        <Badge variant="outline">NF: {x.status_fiscal}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aberta && x.asaas_bank_slip_url && (
                      <Button asChild size="sm"><a href={x.asaas_bank_slip_url} target="_blank" rel="noreferrer"><Receipt className="mr-2 h-4 w-4" />Boleto</a></Button>
                    )}
                    {aberta && x.asaas_invoice_url && (
                      <Button asChild size="sm" variant="outline"><a href={x.asaas_invoice_url} target="_blank" rel="noreferrer">Pagar online</a></Button>
                    )}
                    {aberta && x.asaas_pix_payload && (
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(x.asaas_pix_payload!); toast.success("PIX copiado."); }}>
                        <Copy className="mr-2 h-4 w-4" />PIX copia e cola
                      </Button>
                    )}
                    {x.url_pdf_nfse && (
                      <Button asChild size="sm" variant="ghost"><a href={x.url_pdf_nfse} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />Nota fiscal (PDF)</a></Button>
                    )}
                    {x.url_xml_nfse && (
                      <Button asChild size="sm" variant="ghost"><a href={x.url_xml_nfse} target="_blank" rel="noreferrer">XML</a></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
