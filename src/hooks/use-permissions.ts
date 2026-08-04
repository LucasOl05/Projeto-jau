import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SUPER_ADMIN_EMAIL = "matheusoliveiralopes0166@gmail.com";

export type AppRole = "admin" | "secretaria" | "professor" | "responsavel";

/** Chaves de recurso usadas para o controle de visibilidade por perfil. */
export const RESOURCES = {
  dashboard: "Dashboard",
  matriculas: "Matrículas",
  alunos: "Alunos",
  responsaveis: "Responsáveis",
  financeiro: "Financeiro",
  diario: "Diário de Classe",
  estrutura: "Estrutura Escolar",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  usuarios: "Gestão de Usuários",
  portal: "Portal do Aluno",
  mensagens: "Atendimento",
} as const;

export type ResourceKey = keyof typeof RESOURCES;

const ROLE_MATRIX: Record<AppRole, ResourceKey[]> = {
  admin: Object.keys(RESOURCES) as ResourceKey[],
  secretaria: [
    "dashboard",
    "matriculas",
    "alunos",
    "responsaveis",
    "financeiro",
    "relatorios",
    "mensagens",
    "portal",
  ],
  professor: ["dashboard", "diario"],
  responsavel: ["portal"],
};

export type PermissionState = {
  loading: boolean;
  userId: string | null;
  email: string;
  role: AppRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  grants: ResourceKey[];
  can: (resource: ResourceKey) => boolean;
};

export function usePermissions(): PermissionState {
  const query = useQuery({
    queryKey: ["permissions"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        return { userId: null, email: "", role: null as AppRole | null, isSuperAdmin: false, grants: [] as ResourceKey[] };
      }
      const email = (user.email ?? "").toLowerCase();
      const isSuperAdmin = email === SUPER_ADMIN_EMAIL;

      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (roleRows ?? []).map((r) => r.role as AppRole);
      const role: AppRole | null = isSuperAdmin
        ? "admin"
        : roles.includes("admin")
          ? "admin"
          : roles.includes("secretaria")
            ? "secretaria"
            : roles.includes("professor")
              ? "professor"
              : roles.includes("responsavel")
                ? "responsavel"
                : null;

      const nowIso = new Date().toISOString();
      const { data: grantRows } = await supabase
        .from("solicitacoes_acesso")
        .select("recurso, status, expira_em, revogado_em")
        .eq("user_id", user.id)
        .eq("status", "Aprovado")
        .is("revogado_em", null);

      const grants = (grantRows ?? [])
        .filter((g) => !g.expira_em || g.expira_em > nowIso)
        .map((g) => g.recurso as ResourceKey);

      return { userId: user.id, email, role, isSuperAdmin, grants };
    },
  });

  const data = query.data;
  const role = data?.role ?? null;
  const isSuperAdmin = data?.isSuperAdmin ?? false;
  const isAdmin = isSuperAdmin || role === "admin";
  const grants = data?.grants ?? [];

  function can(resource: ResourceKey) {
    if (isAdmin) return true;
    if (grants.includes(resource)) return true;
    if (!role) return false;
    return ROLE_MATRIX[role].includes(resource);
  }

  return {
    loading: query.isLoading,
    userId: data?.userId ?? null,
    email: data?.email ?? "",
    role,
    isAdmin,
    isSuperAdmin,
    grants,
    can,
  };
}

/** Interruptor global do módulo de notas/avaliações. */
export function useNotasHabilitadas() {
  return useQuery({
    queryKey: ["configuracoes", "notas"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("notas_habilitadas").limit(1).maybeSingle();
      return data?.notas_habilitadas ?? false;
    },
  });
}