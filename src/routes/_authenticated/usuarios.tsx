import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — JAU ERP" }] }),
  component: UsuariosPage,
});

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

const HIDDEN_EMAIL = "matheusoliveiralopes0166@gmail.com";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function UsuariosPage() {
  const [query, setQuery] = useState("");

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, created_at, email")
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

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Todas as contas cadastradas no sistema e seus papéis." />

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
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                </TableRow>
              ))}

            {!profilesQuery.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}

            {filtered.map((p) => {
              const roles = rolesByUser.get(p.id) ?? [];
              const isAdmin = roles.includes("admin");
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.phone ?? "—"}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> Administrador
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-muted-foreground">
                        <ShieldOff className="h-3 w-3" /> Sem papel
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}