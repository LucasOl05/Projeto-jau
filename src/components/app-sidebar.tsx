import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Users2,
  UserCog,
  GraduationCap,
  HeartHandshake,
  ClipboardCheck,
  Library,
  FileSignature,
  Wallet,
  FileText,
  Smartphone,
  Settings,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { usePermissions, type ResourceKey } from "@/hooks/use-permissions";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; resource: ResourceKey };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Início",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, resource: "dashboard" }],
  },
  {
    label: "Secretaria",
    items: [
      { title: "Matrículas", url: "/matriculas", icon: FileSignature, resource: "matriculas" },
      { title: "Alunos", url: "/alunos", icon: GraduationCap, resource: "alunos" },
      { title: "Responsáveis", url: "/responsaveis", icon: HeartHandshake, resource: "responsaveis" },
    ],
  },
  {
    label: "Pedagógico",
    items: [{ title: "Diário de Classe", url: "/diario", icon: ClipboardCheck, resource: "diario" }],
  },
  {
    label: "Estrutura Escolar",
    items: [
      { title: "Cursos", url: "/cursos", icon: BookOpen, resource: "estrutura" },
      { title: "Turmas", url: "/turmas", icon: Users2, resource: "estrutura" },
      { title: "Disciplinas", url: "/disciplinas", icon: Library, resource: "estrutura" },
      { title: "Professores", url: "/professores", icon: UserCog, resource: "estrutura" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: Wallet, resource: "financeiro" },
      { title: "Empresas (B2B)", url: "/empresas", icon: Building2, resource: "financeiro" },
      { title: "Relatórios", url: "/relatorios", icon: FileText, resource: "relatorios" },
      { title: "Portal do Aluno", url: "/portal", icon: Smartphone, resource: "portal" },
      { title: "Usuários", url: "/usuarios", icon: Users, resource: "usuarios" },
      { title: "Configurações", url: "/configuracoes", icon: Settings, resource: "configuracoes" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const perms = usePermissions();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center gap-3 px-2 py-3">
          <BrandLogo size={36} rounded="rounded-lg" className="shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">JAU ERP</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">Jovem Aprendiz UDI</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => {
          const visible = group.items.filter((i) => perms.loading || perms.can(i.resource));
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => {
                    const active = currentPath === item.url || currentPath.startsWith(item.url + "/");
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link to={item.url} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}