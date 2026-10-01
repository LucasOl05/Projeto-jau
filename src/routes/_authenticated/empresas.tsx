import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  FileText,
  Search,
  Copy,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { maskCNPJ, maskPhone, maskCEP, buscarEnderecoPorCEP } from "@/lib/masks";
import { EmpresaFinanceiroDialog } from "@/components/empresa-financeiro";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas (B2B) — JAU ERP" },
      { name: "description", content: "Gestão de empresas parceiras e faturamento B2B." },
    ],
  }),
  component: EmpresasPage,
});

type Empresa = {
  id: string;
  codigo_publico: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  valor_contrato: number | null;
  status: string;
};


const emptyEmpresa = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  email: "",
  telefone: "",
  cep: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
  contato_nome: "",
  contato_email: "",
  contato_telefone: "",
  valor_contrato: "",
  status: "Ativa",
};


const currency = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function EmpresasPage() {
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState(emptyEmpresa);
  const [removing, setRemoving] = useState<Empresa | null>(null);
  const [faturasEmpresa, setFaturasEmpresa] = useState<Empresa | null>(null);

  const empresasQuery = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .is("deleted_at", null)
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });


  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.razao_social.trim()) throw new Error("Informe a razão social.");
      const payload = {
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj || null,
        email: form.email || null,
        telefone: form.telefone || null,
        cep: form.cep || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        uf: form.uf || null,
        contato_nome: form.contato_nome || null,
        contato_email: form.contato_email || null,
        contato_telefone: form.contato_telefone || null,
        valor_contrato: form.valor_contrato ? Number(form.valor_contrato.replace(",", ".")) : null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("empresas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empresas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Empresa atualizada." : "Empresa cadastrada.");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyEmpresa);
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("duplicate") ? "CNPJ já cadastrado." : e.message),
  });

  const remover = useMutation({
    mutationFn: async (empresa: Empresa) => {
      const { error } = await supabase
        .from("empresas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", empresa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa removida.");
      setRemoving(null);
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const empresas = (empresasQuery.data ?? []).filter((e) => {
    const q = busca.toLowerCase();
    return (
      !q ||
      e.razao_social.toLowerCase().includes(q) ||
      (e.nome_fantasia ?? "").toLowerCase().includes(q) ||
      (e.cnpj ?? "").includes(q) ||
      (e.codigo_publico ?? "").toLowerCase().includes(q)
    );
  });

  const ativas = (empresasQuery.data ?? []).filter((e) => e.status === "Ativa").length;
  const totalContratos = (empresasQuery.data ?? []).reduce(
    (s, e) => s + Number(e.valor_contrato ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas (B2B)"
        description="Empresas parceiras, contratos e faturamento via Asaas com NFS-e."
        actions={
          perms.isAdmin ? (
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyEmpresa);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova empresa
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Empresas ativas</p>
          <p className="text-2xl font-semibold text-foreground">{ativas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total cadastrado</p>
          <p className="text-2xl font-semibold text-foreground">
            {empresasQuery.data?.length ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Contratos (soma)</p>
          <p className="text-2xl font-semibold text-foreground">{currency(totalContratos)}</p>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CNPJ ou código..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {empresasQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : empresas.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma empresa cadastrada.
        </Card>
      ) : (
        <div className="grid gap-3">
          {empresas.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {e.codigo_publico ? `${e.codigo_publico} · ` : ""}
                      {e.nome_fantasia || e.razao_social}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {e.cnpj ?? "CNPJ não informado"}
                      {e.cidade ? ` · ${e.cidade}/${e.uf ?? ""}` : ""}
                      {e.valor_contrato ? ` · ${currency(e.valor_contrato)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={e.status === "Ativa" ? "default" : "secondary"}>{e.status}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setFaturasEmpresa(e)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Financeiro
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="Copiar acesso ao Portal da Empresa"
                    onClick={() => {
                      const texto = `Olá! Acesse o Portal da Empresa JAU para ver faturas, boletos e notas fiscais:\n${window.location.origin}/portal-empresa\nCNPJ: ${e.cnpj ?? ""}\nCódigo de acesso: ${e.codigo_publico ?? ""}`;
                      navigator.clipboard.writeText(texto);
                      toast.success("Acesso copiado. Cole no WhatsApp da empresa.");
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Acesso portal
                  </Button>
                  {perms.isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(e);
                          setForm({
                            razao_social: e.razao_social,
                            nome_fantasia: e.nome_fantasia ?? "",
                            cnpj: e.cnpj ?? "",
                            email: e.email ?? "",
                            telefone: e.telefone ?? "",
                            cep: e.cep ?? "",
                            endereco: e.endereco ?? "",
                            numero: e.numero ?? "",
                            bairro: e.bairro ?? "",
                            cidade: e.cidade ?? "",
                            uf: e.uf ?? "",
                            contato_nome: e.contato_nome ?? "",
                            contato_email: e.contato_email ?? "",
                            contato_telefone: e.contato_telefone ?? "",
                            valor_contrato: e.valor_contrato ? String(e.valor_contrato) : "",
                            status: e.status,
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setRemoving(e)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog cadastro/edição de empresa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>Dados cadastrais e contato da empresa parceira.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              salvar.mutate();
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label>Razão social *</Label>
              <Input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nome fantasia</Label>
              <Input
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })}
                onBlur={async (e) => {
                  const endereco = await buscarEnderecoPorCEP(e.target.value);
                  if (!endereco) return;
                  setForm((f) => ({
                    ...f,
                    endereco: endereco.logradouro || f.endereco,
                    bairro: endereco.bairro || f.bairro,
                    cidade: endereco.cidade || f.cidade,
                    uf: endereco.uf || f.uf,
                  }));
                  toast.success("Endereço preenchido pelo CEP.");
                }}
                placeholder="00000-000"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor do contrato (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.valor_contrato}
                onChange={(e) => setForm({ ...form, valor_contrato: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Contato — nome</Label>
              <Input
                value={form.contato_nome}
                onChange={(e) => setForm({ ...form, contato_nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contato — e-mail</Label>
              <Input
                type="email"
                value={form.contato_email}
                onChange={(e) => setForm({ ...form, contato_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contato — telefone</Label>
              <Input
                value={form.contato_telefone}
                onChange={(e) => setForm({ ...form, contato_telefone: maskPhone(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Financeiro da empresa */}
      <EmpresaFinanceiroDialog
        empresa={faturasEmpresa}
        onOpenChange={(o) => !o && setFaturasEmpresa(null)}
        canManage={perms.isAdmin}
      />


      {/* Confirmação de remoção */}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.razao_social} será marcada como removida. O histórico de faturas é
              preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && remover.mutate(removing)}
              disabled={remover.isPending}
            >
              {remover.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
