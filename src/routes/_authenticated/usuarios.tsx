import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Search, Check, X, Ban, Undo2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessGuard } from "@/components/access-guard";
import { maskCPF } from "@/lib/masks";
import { RESOURCES, usePermissions, type AppRole, type ResourceKey } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e Permissões — JAU ERP" },
      { name: "description", content: "Gestão de perfis, promoções, rebaixamentos e solicitações de acesso." },
      { property: "og:title", content: "Usuários e Permissões — JAU ERP" },
      { property: "og:description", content: "Controle quem acessa cada módulo do JAU ERP." },
    ],
  }),
  component: () => (
    <AccessGuard resource="usuarios">
      <UsuariosPage />
    </AccessGuard>
  ),
});

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  ativo: boolean;
};

type AlunoRow = {
  id: string;
  nome: string;
  codigo_publico: string | null;
  cpf: string | null;
  status: string;
  responsaveis: string;
  cpf_responsavel: string | null;
};

const HIDDEN_EMAIL = "matheusoliveiralopes0166@gmail.com";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "secretaria", label: "Secretaria" },
  { value: "professor", label: "Professor" },
  { value: "responsavel", label: "Responsável" },
];

function UsuariosPage() {
  const [query, setQuery] = useState("");
  const [alunoQuery, setAlunoQuery] = useState("");
  const [confirmAluno, setConfirmAluno] = useState<AlunoRow | null>(null);
  const queryClient = useQueryClient();
  const perms = usePermissions();

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, created_at, email, ativo")
        .not("email", "ilike", HIDDEN_EMAIL)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const solicitacoesQuery = useQuery({
    queryKey: ["solicitacoes_acesso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_acesso")
        .select("id, user_id, recurso, justificativa, status, expira_em, revogado_em, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const alunosQuery = useQuery({
    queryKey: ["usuarios-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, codigo_publico, cpf, status, aluno_responsavel(responsaveis(nome, cpf))")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((a) => {
        const vincs = (a as unknown as {
          aluno_responsavel: { responsaveis: { nome: string; cpf: string | null } | null }[];
        }).aluno_responsavel ?? [];
        const resps = vincs.map((v) => v.responsaveis).filter(Boolean) as { nome: string; cpf: string | null }[];
        return {
          id: a.id,
          nome: a.nome,
          codigo_publico: a.codigo_publico,
          cpf: a.cpf,
          status: a.status,
          responsaveis: resps.map((r) => r.nome).join(", "),
          cpf_responsavel: resps.find((r) => r.cpf)?.cpf ?? null,
        } as AlunoRow;
      });
    },
  });

  const excluirAlunoFn = useServerFn(excluirAlunoDefinitivo);

  const excluirAluno = useMutation({
    mutationFn: async (a: AlunoRow) => {
      try {
        await excluirAlunoFn({ data: { alunoId: a.id } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Não foi possível excluir o aluno.";
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      toast.success("Aluno excluído definitivamente.");
      queryClient.invalidateQueries({ queryKey: ["usuarios-alunos"] });
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      setConfirmAluno(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const definirPapel = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole | "nenhum" }) => {
      const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delError) throw delError;
      if (role !== "nenhum") {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Papel atualizado.");
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string; ativo: boolean }) => {
      const { error } = await supabase.from("profiles").update({ ativo }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação da conta atualizada.");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decidir = useMutation({
    mutationFn: async ({ id, status, revogar }: { id: string; status?: string; revogar?: boolean }) => {
      const patch = revogar
        ? { revogado_em: new Date().toISOString() }
        : {
            status: status ?? "Aprovado",
            decidido_em: new Date().toISOString(),
            decidido_por: perms.userId,
            revogado_em: null,
          };
      const { error } = await supabase.from("solicitacoes_acesso").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada.");
      queryClient.invalidateQueries({ queryKey: ["solicitacoes_acesso"] });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    (rolesQuery.data ?? []).forEach((r) => {
      const list = m.get(r.user_id) ?? [];
      list.push(r.role);
      m.set(r.user_id, list);
    });
    return m;
  }, [rolesQuery.data]);

  const filtered = useMemo(() => {
    const rows = profilesQuery.data ?? [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q));
  }, [profilesQuery.data, query]);

  const alunosFiltrados = useMemo(() => {
    const rows = alunosQuery.data ?? [];
    const q = alunoQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.nome.toLowerCase().includes(q) ||
        (a.codigo_publico ?? "").toLowerCase().includes(q) ||
        (a.cpf ?? "").includes(q.replace(/\D/g, "")) ||
        a.responsaveis.toLowerCase().includes(q),
    );
  }, [alunosQuery.data, alunoQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Promova, rebaixe, bloqueie contas e decida as solicitações de acesso."
      />

      <Tabs defaultValue="contas">
        <TabsList>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="alunos">Alunos</TabsTrigger>
          <TabsTrigger value="solicitacoes">
            Solicitações
            {(solicitacoesQuery.data ?? []).some((s) => s.status === "Pendente") && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
                {(solicitacoesQuery.data ?? []).filter((s) => s.status === "Pendente").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="mt-4">
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
            {profilesQuery.data ? `${filtered.length} usuário(s)` : ""}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Conta ativa</TableHead>
              <TableHead className="text-right">Cadastrado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profilesQuery.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                </TableRow>
              ))}

            {!profilesQuery.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}

            {filtered.map((p) => {
              const roles = rolesByUser.get(p.id) ?? [];
              const currentRole = (ROLES.find((r) => roles.includes(r.value))?.value ?? "nenhum") as
                | AppRole
                | "nenhum";
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.phone ?? "—"}</TableCell>
                  <TableCell>
                    {perms.isAdmin ? (
                      <Select
                        value={currentRole}
                        onValueChange={(v) =>
                          definirPapel.mutate({ userId: p.id, role: v as AppRole | "nenhum" })
                        }
                      >
                        <SelectTrigger className="w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhum">Sem papel</SelectItem>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : currentRole === "nenhum" ? (
                      <Badge variant="secondary" className="gap-1 text-muted-foreground">
                        <ShieldOff className="h-3 w-3" /> Sem papel
                      </Badge>
                    ) : (
                      <Badge className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {ROLES.find((r) => r.value === currentRole)?.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.ativo}
                      disabled={!perms.isAdmin}
                      onCheckedChange={(v) => alternarAtivo.mutate({ userId: p.id, ativo: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
        </TabsContent>

        <TabsContent value="alunos" className="mt-4">
          <Card className="border-border/70">
            <div className="flex items-center gap-3 border-b border-border/70 p-4">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={alunoQuery}
                  onChange={(e) => setAlunoQuery(e.target.value)}
                  placeholder="Buscar por nome, código (RA), CPF ou responsável..."
                  className="pl-9"
                />
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                {alunosQuery.data ? `${alunosFiltrados.length} aluno(s)` : ""}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código / RA</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>CPF do aluno</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>CPF do responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alunosQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  )}
                  {!alunosQuery.isLoading && alunosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        Nenhum aluno encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {alunosFiltrados.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.codigo_publico ?? "—"}</TableCell>
                      <TableCell className="font-medium">{a.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{a.cpf ? maskCPF(a.cpf) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.responsaveis || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.cpf_responsavel ? maskCPF(a.cpf_responsavel) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {perms.isAdmin ? (
                          <Button size="sm" variant="ghost" title="Excluir definitivamente" onClick={() => setConfirmAluno(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4">
          <Card className="border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(solicitacoesQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma solicitação registrada.
                    </TableCell>
                  </TableRow>
                )}
                {(solicitacoesQuery.data ?? []).map((s) => {
                  const nome =
                    (profilesQuery.data ?? []).find((p) => p.id === s.user_id)?.full_name ?? "Usuário";
                  const revogado = !!s.revogado_em;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{nome}</TableCell>
                      <TableCell>{RESOURCES[s.recurso as ResourceKey] ?? s.recurso}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{s.justificativa}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "Aprovado" && !revogado ? "default" : "secondary"}>
                          {revogado ? "Revogado" : s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {perms.isAdmin && (
                          <div className="flex justify-end gap-1">
                            {s.status === "Pendente" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => decidir.mutate({ id: s.id, status: "Aprovado" })}
                                >
                                  <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => decidir.mutate({ id: s.id, status: "Recusado" })}
                                >
                                  <X className="mr-1 h-3.5 w-3.5" /> Recusar
                                </Button>
                              </>
                            )}
                            {s.status === "Aprovado" && !revogado && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => decidir.mutate({ id: s.id, revogar: true })}
                              >
                                <Ban className="mr-1 h-3.5 w-3.5" /> Revogar
                              </Button>
                            )}
                            {revogado && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => decidir.mutate({ id: s.id, status: "Aprovado" })}
                              >
                                <Undo2 className="mr-1 h-3.5 w-3.5" /> Reativar
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmAluno} onOpenChange={(v) => !v && setConfirmAluno(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir o aluno <strong>{confirmAluno?.nome}</strong>? Esta ação é
              irreversível e cancela o acesso dele ao Portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAluno && excluirAluno.mutate(confirmAluno)}>
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}