import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
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
  Search,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePermissions, type ResourceKey } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Destino = { title: string; url: string; icon: typeof LayoutDashboard; resource: ResourceKey };

const destinos: Destino[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, resource: "dashboard" },
  { title: "Matrículas", url: "/matriculas", icon: FileSignature, resource: "matriculas" },
  { title: "Alunos", url: "/alunos", icon: GraduationCap, resource: "alunos" },
  { title: "Responsáveis", url: "/responsaveis", icon: HeartHandshake, resource: "responsaveis" },
  { title: "Diário de Classe", url: "/diario", icon: ClipboardCheck, resource: "diario" },
  { title: "Cursos", url: "/cursos", icon: BookOpen, resource: "estrutura" },
  { title: "Turmas", url: "/turmas", icon: Users2, resource: "estrutura" },
  { title: "Disciplinas", url: "/disciplinas", icon: Library, resource: "estrutura" },
  { title: "Professores", url: "/professores", icon: UserCog, resource: "estrutura" },
  { title: "Financeiro", url: "/financeiro", icon: Wallet, resource: "financeiro" },
  { title: "Empresas (B2B)", url: "/empresas", icon: Building2, resource: "financeiro" },
  { title: "Relatórios", url: "/relatorios", icon: FileText, resource: "relatorios" },
  { title: "Portal do Aluno", url: "/portal", icon: Smartphone, resource: "portal" },
  { title: "Usuários", url: "/usuarios", icon: Users, resource: "usuarios" },
  { title: "Configurações", url: "/configuracoes", icon: Settings, resource: "configuracoes" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const navigate = useNavigate();
  const perms = usePermissions();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const busca = termo.trim();
  const podeAlunos = perms.can("alunos");
  const podeEmpresas = perms.can("financeiro");

  const alunosQuery = useQuery({
    queryKey: ["busca-global-alunos", busca],
    enabled: open && podeAlunos && busca.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("id, nome, codigo_publico, matricula")
        .is("deleted_at", null)
        .or(`nome.ilike.%${busca}%,codigo_publico.ilike.%${busca}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const empresasQuery = useQuery({
    queryKey: ["busca-global-empresas", busca],
    enabled: open && podeEmpresas && busca.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("id, razao_social, nome_fantasia")
        .is("deleted_at", null)
        .or(`razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%`)
        .limit(6);
      return data ?? [];
    },
  });

  function ir(url: string) {
    setOpen(false);
    setTermo("");
    navigate({ to: url });
  }

  const paginas = destinos.filter((d) => perms.loading || perms.can(d.resource));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden gap-2 text-muted-foreground sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Buscar…</span>
        <kbd className="rounded border border-border px-1.5 text-[10px] font-medium">Ctrl K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar páginas, alunos ou empresas…"
          value={termo}
          onValueChange={setTermo}
        />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Páginas">
            {paginas.map((d) => (
              <CommandItem key={d.url} value={d.title} onSelect={() => ir(d.url)}>
                <d.icon className="mr-2 h-4 w-4" />
                {d.title}
              </CommandItem>
            ))}
          </CommandGroup>

          {(alunosQuery.data ?? []).length > 0 && (
            <CommandGroup heading="Alunos">
              {(alunosQuery.data ?? []).map((a) => (
                <CommandItem key={a.id} value={`aluno-${a.id}-${a.nome}`} onSelect={() => ir("/alunos")}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  <span className="truncate">{a.nome}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {a.codigo_publico ?? a.matricula}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(empresasQuery.data ?? []).length > 0 && (
            <CommandGroup heading="Empresas">
              {(empresasQuery.data ?? []).map((e) => (
                <CommandItem
                  key={e.id}
                  value={`empresa-${e.id}-${e.razao_social}`}
                  onSelect={() => ir("/empresas")}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="truncate">{e.nome_fantasia || e.razao_social}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
