import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Cursos", url: "/cursos" },
  { label: "Turmas", url: "/turmas" },
  { label: "Disciplinas", url: "/disciplinas" },
  { label: "Professores", url: "/professores" },
] as const;

export function EstruturaTabs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/40 p-1">
      {tabs.map((t) => {
        const active = pathname === t.url;
        return (
          <Link
            key={t.url}
            to={t.url}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}