import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: admin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  const { data: sa } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
  if (!admin && !sa) throw new Error("Apenas administradores podem excluir registros.");
}

/** Exclusão definitiva de um aluno e de seus vínculos dependentes. */
export const excluirAlunoDefinitivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ alunoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pagas } = await supabaseAdmin
      .from("mensalidades")
      .select("id")
      .eq("aluno_id", data.alunoId)
      .eq("status", "Pago")
      .limit(1);
    if (pagas && pagas.length > 0) {
      throw new Error(
        "Este aluno possui pagamentos já quitados. Por segurança do histórico financeiro, a exclusão foi bloqueada.",
      );
    }

    await supabaseAdmin.from("aluno_responsavel").delete().eq("aluno_id", data.alunoId);
    await supabaseAdmin.from("diario_chamada").delete().eq("aluno_id", data.alunoId);
    await supabaseAdmin.from("avaliacao_notas").delete().eq("aluno_id", data.alunoId);
    await supabaseAdmin.from("documentos").delete().eq("aluno_id", data.alunoId);
    await supabaseAdmin.from("mensalidades").delete().eq("aluno_id", data.alunoId);
    await supabaseAdmin.from("matriculas").delete().eq("aluno_id", data.alunoId);

    const { error } = await supabaseAdmin.from("alunos").delete().eq("id", data.alunoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclusão definitiva de um responsável, liberando os vínculos existentes. */
export const excluirResponsavelDefinitivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ responsavelId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pagas } = await supabaseAdmin
      .from("mensalidades")
      .select("id")
      .eq("responsavel_id", data.responsavelId)
      .eq("status", "Pago")
      .limit(1);
    if (pagas && pagas.length > 0) {
      throw new Error(
        "Este responsável possui pagamentos já quitados. Por segurança do histórico financeiro, a exclusão foi bloqueada.",
      );
    }

    await supabaseAdmin.from("aluno_responsavel").delete().eq("responsavel_id", data.responsavelId);
    await supabaseAdmin
      .from("mensalidades")
      .update({ responsavel_id: null })
      .eq("responsavel_id", data.responsavelId);

    const { error } = await supabaseAdmin.from("responsaveis").delete().eq("id", data.responsavelId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
