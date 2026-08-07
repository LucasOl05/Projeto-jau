import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Users, PlugZap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { testarConexaoAsaas } from "@/lib/asaas.functions";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — JAU ERP" },
      { name: "description", content: "Módulo de notas, integrações Asaas e Waseller e permissões do JAU ERP." },
      { property: "og:title", content: "Configurações — JAU ERP" },
      { property: "og:description", content: "Ajuste o módulo pedagógico e as integrações do sistema." },
    ],
  }),
  component: () => (
    <AccessGuard resource="configuracoes">
      <ConfiguracoesPage />
    </AccessGuard>
  ),
});

type Config = {
  id: string;
  school_id: string;
  notas_habilitadas: boolean;
  asaas_ambiente: string;
  asaas_api_key: string | null;
  waseller_token: string | null;
  waseller_endpoint: string | null;
  portal_url: string | null;
  asaas_webhook_token: string | null;
};

function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Config>>({});

  const configQuery = useQuery({
    queryKey: ["configuracoes", "full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select(
          "id, school_id, notas_habilitadas, asaas_ambiente, asaas_api_key, asaas_webhook_token, waseller_token, waseller_endpoint, portal_url",
        )
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Config | null;
    },
  });

  useEffect(() => {
    if (configQuery.data) setForm(configQuery.data);
  }, [configQuery.data]);

  const salvar = useMutation({
    mutationFn: async (patch: Partial<Config>) => {
      if (!configQuery.data?.id) throw new Error("Configuração da escola não encontrada.");
      const { error } = await supabase.from("configuracoes").update(patch).eq("id", configQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas.");
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/asaas-webhook` : "/api/public/asaas-webhook";

  const testar = useServerFn(testarConexaoAsaas);
  const testarConexao = useMutation({
    mutationFn: async () => await testar({ data: undefined as never }),
    onSuccess: (r) => toast.success(`Conexão OK (${r.ambiente}).`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Módulo pedagógico, integrações e permissões do sistema."
        actions={
          <Button asChild variant="outline">
            <Link to="/usuarios">
              <Users className="mr-2 h-4 w-4" />
              Gestão de usuários
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="pedagogico">
        <TabsList>
          <TabsTrigger value="pedagogico">Pedagógico</TabsTrigger>
          <TabsTrigger value="asaas">Asaas</TabsTrigger>
          <TabsTrigger value="waseller">Waseller / WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="pedagogico" className="mt-4">
          <Card className="border-border/70 p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <Label className="text-base">Habilitar Módulo de Notas/Avaliações</Label>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Desativado (padrão), o Diário de Classe e o Portal focam 100% em frequência e conteúdo
                  ministrado. O progresso do aluno é calculado por (Aulas Presentes ÷ Total de Aulas Previstas).
                </p>
              </div>
              <Switch
                checked={!!form.notas_habilitadas}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, notas_habilitadas: v }));
                  salvar.mutate({ notas_habilitadas: v });
                }}
              />
            </div>

            <div className="mt-6 max-w-md space-y-2">
              <Label htmlFor="portal_url">Link do Portal (usado nas mensagens de boas-vindas)</Label>
              <Input
                id="portal_url"
                value={form.portal_url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, portal_url: e.target.value }))}
                placeholder="https://minhaescola.lovable.app/portal"
              />
              <Button size="sm" onClick={() => salvar.mutate({ portal_url: form.portal_url ?? null })}>
                Salvar
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="asaas" className="mt-4">
          <Card className="max-w-2xl space-y-4 border-border/70 p-6">
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={form.asaas_ambiente ?? "sandbox"}
                onValueChange={(v) => setForm((f) => ({ ...f, asaas_ambiente: v }))}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asaas_api_key">Chave de API do Asaas</Label>
              <Input
                id="asaas_api_key"
                type="password"
                value={form.asaas_api_key ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, asaas_api_key: e.target.value }))}
                placeholder="$aact_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asaas_webhook_token">Token de Segurança do Webhook</Label>
              <Input
                id="asaas_webhook_token"
                type="password"
                value={form.asaas_webhook_token ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, asaas_webhook_token: e.target.value }))}
                placeholder="whsec_..."
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo valor no campo "Token de autenticação" do webhook no Asaas. Requisições sem esse token são
                recusadas.
              </p>
            </div>
            <div className="space-y-2">
              <Label>URL de Webhook do ERP</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success("URL copiada.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cadastre essa URL no Asaas para receber o evento PAYMENT_RECEIVED.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  salvar.mutate({
                    asaas_ambiente: form.asaas_ambiente ?? "sandbox",
                    asaas_api_key: form.asaas_api_key ?? null,
                    asaas_webhook_token: form.asaas_webhook_token ?? null,
                  })
                }
                disabled={salvar.isPending}
              >
                Salvar integração Asaas
              </Button>
              <Button variant="outline" onClick={() => testarConexao.mutate()} disabled={testarConexao.isPending}>
                <PlugZap className="mr-2 h-4 w-4" />
                {testarConexao.isPending ? "Testando..." : "Testar conexão"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="waseller" className="mt-4">
          <Card className="max-w-2xl space-y-4 border-border/70 p-6">
            <div className="space-y-2">
              <Label htmlFor="waseller_endpoint">Endpoint da API Waseller</Label>
              <Input
                id="waseller_endpoint"
                value={form.waseller_endpoint ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, waseller_endpoint: e.target.value }))}
                placeholder="https://api.waseller.com/send"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waseller_token">Token da API Waseller</Label>
              <Input
                id="waseller_token"
                type="password"
                value={form.waseller_token ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, waseller_token: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sem token configurado, os envios de WhatsApp usam o link direto wa.me como alternativa.
            </p>
            <Button
              onClick={() =>
                salvar.mutate({
                  waseller_endpoint: form.waseller_endpoint ?? null,
                  waseller_token: form.waseller_token ?? null,
                })
              }
              disabled={salvar.isPending}
            >
              Salvar integração Waseller
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}