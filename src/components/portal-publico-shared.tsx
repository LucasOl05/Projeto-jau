import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, LogOut, ExternalLink, Copy } from "lucide-react";

import { acessarPortalPublico } from "@/lib/portal-publico.functions";
import type { PortalSessao } from "@/lib/portal-publico.server";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { maskDate, brDateToISO } from "@/lib/masks";

const currency = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
};

function statusVariant(status: string, vencimento: string) {
  const s = (status ?? "").toLowerCase();
  if (s.includes("pago")) return "default" as const;
  const atrasado = new Date(`${vencimento}T00:00:00`).getTime() < Date.now();
  return atrasado ? ("destructive" as const) : ("secondary" as const);
}

export function PortalLoginForm({ onSuccess }: { onSuccess: (s: PortalSessao) => void }) {
  const [identificador, setIdentificador] = useState("");
  const [nascimento, setNascimento] = useState("");

  const acessar = useServerFn(acessarPortalPublico);
  const entrar = useMutation({
    mutationFn: async () => {
      const iso = brDateToISO(nascimento);
      if (!iso) throw new Error("Informe a data de nascimento no formato dd/mm/aaaa.");
      return (await acessar({ data: { identificador, nascimento: iso } })) as PortalSessao;
    },
    onSuccess,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        entrar.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="portal-identificador">CPF do aluno ou Matrícula</Label>
        <Input
          id="portal-identificador"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          placeholder="000.000.000-00 ou nº de matrícula"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="portal-nascimento">Data de nascimento do aluno</Label>
        <Input
          id="portal-nascimento"
          value={nascimento}
          onChange={(e) => setNascimento(maskDate(e.target.value))}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={entrar.isPending}>
        {entrar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Acessar portal
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Acesso sem senha: use o CPF ou RA do aluno e a data de nascimento.
      </p>
    </form>
  );
}

export function PortalDashboard({
  sessao,
  onLogout,
}: {
  sessao: PortalSessao;
  onLogout: () => void;
}) {
  const abertas = sessao.mensalidades.filter((m) => !(m.status ?? "").toLowerCase().includes("pago"));
  const totalAberto = abertas.reduce((sum, m) => sum + Number(m.valor ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{sessao.aluno.nome}</h1>
          <p className="text-sm text-muted-foreground">
            RA {sessao.aluno.codigo_publico ?? sessao.aluno.matricula ?? "—"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Em aberto</p>
          <p className="text-2xl font-semibold text-foreground">{currency(totalAberto)}</p>
          <p className="text-xs text-muted-foreground">{abertas.length} parcela(s)</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Frequência</p>
          <p className="text-2xl font-semibold text-foreground">
            {sessao.frequencia.percentual !== null ? `${sessao.frequencia.percentual.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {sessao.frequencia.presencas} de {sessao.frequencia.total} aulas
          </p>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Extrato financeiro</h2>
        {sessao.mensalidades.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma mensalidade lançada.</Card>
        ) : (
          sessao.mensalidades.map((m) => (
            <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {m.descricao ?? m.competencia ?? m.codigo_publico ?? "Mensalidade"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Vencimento {formatDate(m.vencimento)} · {currency(m.valor)}
                  {m.data_pagamento ? ` · pago em ${formatDate(m.data_pagamento)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(m.status, m.vencimento)}>{m.status}</Badge>
                {m.asaas_invoice_url && (
                  <Button asChild size="sm" variant="outline">
                    <a href={m.asaas_invoice_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Pagar
                    </a>
                  </Button>
                )}
                {m.asaas_pix_payload && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(m.asaas_pix_payload as string);
                      toast.success("Código PIX copiado.");
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    PIX
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
