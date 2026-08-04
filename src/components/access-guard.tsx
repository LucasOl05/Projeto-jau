import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RESOURCES, usePermissions, type ResourceKey } from "@/hooks/use-permissions";

export function AccessGuard({ resource, children }: { resource: ResourceKey; children: ReactNode }) {
  const perms = usePermissions();

  if (perms.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (perms.can(resource)) return <>{children}</>;

  return <AccessDenied resource={resource} userId={perms.userId} />;
}

function AccessDenied({ resource, userId }: { resource: ResourceKey; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ["minha-solicitacao", resource, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("solicitacoes_acesso")
        .select("id, status")
        .eq("user_id", userId!)
        .eq("recurso", resource)
        .eq("status", "Pendente")
        .maybeSingle();
      return data;
    },
  });

  const solicitar = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada.");
      if (justificativa.trim().length < 10) throw new Error("Descreva a justificativa (mínimo 10 caracteres).");
      const { error } = await supabase.from("solicitacoes_acesso").insert({
        user_id: userId,
        recurso: resource,
        justificativa: justificativa.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação enviada para a administração.");
      setOpen(false);
      setJustificativa("");
      queryClient.invalidateQueries({ queryKey: ["minha-solicitacao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const jaSolicitado = !!pendingQuery.data;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md border-border/70 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu perfil não tem permissão para acessar <strong>{RESOURCES[resource]}</strong>. Você pode pedir
          liberação para a administração.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => setOpen(true)} disabled={jaSolicitado}>
            <Send className="mr-2 h-4 w-4" />
            {jaSolicitado ? "Solicitação em análise" : "Solicitar acesso"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar acesso — {RESOURCES[resource]}</DialogTitle>
            <DialogDescription>
              Explique por que precisa dessa tela. Um administrador irá aprovar ou recusar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: preciso consultar o financeiro para atender os responsáveis no balcão."
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => solicitar.mutate()} disabled={solicitar.isPending}>
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}