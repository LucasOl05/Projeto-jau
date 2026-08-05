import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2, Trash2, Upload, Check, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const CATEGORIAS = [
  "Contrato",
  "Documento pessoal",
  "Comprovante de residência",
  "Atestado",
  "Declaração",
  "Boletim",
  "Outros",
] as const;

export type Documento = {
  id: string;
  aluno_id: string;
  titulo: string;
  categoria: string;
  storage_path: string;
  mime_type: string | null;
  tamanho: number | null;
  origem: string;
  visivel_portal: boolean;
  status: string;
  observacoes: string | null;
  created_at: string;
};

const formatSize = (b: number | null) => {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "Aprovado") return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">Aprovado</Badge>;
  if (status === "Recusado") return <Badge variant="destructive">Recusado</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">Pendente</Badge>;
}

/**
 * Repositório de documentos de mão dupla.
 * - `mode="escola"`: visão da secretaria (vê tudo, aprova/recusa, controla visibilidade).
 * - `mode="portal"`: visão do responsável (vê apenas aprovados e visíveis, pode enviar).
 */
export function DocumentosPanel({
  alunoId,
  mode,
  canManage = false,
}: {
  alunoId: string;
  mode: "escola" | "portal";
  canManage?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<string>("Outros");
  const [file, setFile] = useState<File | null>(null);
  const [visivel, setVisivel] = useState(true);

  const docsQuery = useQuery({
    queryKey: ["documentos", alunoId, mode],
    queryFn: async () => {
      let q = supabase
        .from("documentos")
        .select("id, aluno_id, titulo, categoria, storage_path, mime_type, tamanho, origem, visivel_portal, status, observacoes, created_at")
        .eq("aluno_id", alunoId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (mode === "portal") q = q.eq("visivel_portal", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo.");
      if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo maior que 20 MB.");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada.");

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${alunoId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
      if (upErr) throw upErr;

      const { error } = await supabase.from("documentos").insert({
        aluno_id: alunoId,
        titulo: titulo.trim() || file.name,
        categoria,
        storage_path: path,
        mime_type: file.type || null,
        tamanho: file.size,
        origem: mode === "portal" ? "Responsável" : "Escola",
        visivel_portal: mode === "portal" ? true : visivel,
        status: mode === "portal" ? "Pendente" : "Aprovado",
        uploaded_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(mode === "portal" ? "Documento enviado para análise da escola." : "Documento publicado.");
      setTitulo("");
      setFile(null);
      setCategoria("Outros");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Documento> }) => {
      const { error } = await supabase.from("documentos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento atualizado.");
      qc.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("documentos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function baixar(doc: Documento) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 60);
    if (error || !data) return toast.error("Não foi possível gerar o link do arquivo.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const docs = docsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3 border-border/70 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doc-titulo">Título</Label>
            <Input
              id="doc-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Comprovante de residência 2026"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-file">Arquivo (até 20 MB)</Label>
          <Input
            id="doc-file"
            ref={fileRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {mode === "escola" && (
          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <div>
              <Label className="text-sm">Visível no Portal do Aluno</Label>
              <p className="text-xs text-muted-foreground">Desligue para manter o arquivo apenas no uso interno.</p>
            </div>
            <Switch checked={visivel} onCheckedChange={setVisivel} />
          </div>
        )}
        <Button onClick={() => upload.mutate()} disabled={upload.isPending || !file}>
          {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {mode === "portal" ? "Enviar para a escola" : "Publicar documento"}
        </Button>
      </Card>

      {docsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : docs.length === 0 ? (
        <Card className="border-border/70 p-6 text-center text-sm text-muted-foreground">
          Nenhum documento por aqui ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center gap-3 border-border/70 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.titulo}</div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{d.categoria}</span>
                  <span>•</span>
                  <span>{d.origem}</span>
                  <span>•</span>
                  <span>{formatSize(d.tamanho)}</span>
                  <span>•</span>
                  <span>{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
              <StatusBadge status={d.status} />
              {mode === "escola" && !d.visivel_portal && <Badge variant="secondary">Interno</Badge>}
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => baixar(d)} title="Baixar">
                  <Download className="h-4 w-4" />
                </Button>
                {mode === "escola" && canManage && (
                  <>
                    {d.status !== "Aprovado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Aprovar"
                        onClick={() => atualizar.mutate({ id: d.id, patch: { status: "Aprovado" } })}
                      >
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    {d.status !== "Recusado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Recusar"
                        onClick={() => atualizar.mutate({ id: d.id, patch: { status: "Recusado" } })}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      title={d.visivel_portal ? "Tornar interno" : "Publicar no portal"}
                      onClick={() => atualizar.mutate({ id: d.id, patch: { visivel_portal: !d.visivel_portal } })}
                    >
                      <span className="text-[11px]">{d.visivel_portal ? "Ocultar" : "Publicar"}</span>
                    </Button>
                    <Button size="sm" variant="ghost" title="Excluir" onClick={() => excluir.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}