import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: sa } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
  if (!data && !sa) throw new Error("Apenas administradores podem usar a integração Asaas.");
}

/** Valida a chave salva chamando a API do Asaas. */
export const testarConexaoAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { loadAsaasConfig, asaasFetch } = await import("./asaas.server");
    const cfg = await loadAsaasConfig();
    const res = await asaasFetch<{ totalCount?: number }>(cfg, "/customers?limit=1");
    return { ok: true, ambiente: cfg.ambiente, clientes: res.totalCount ?? 0 };
  });

/** Cria (ou reaproveita) a cobrança no Asaas para uma mensalidade. */
export const gerarCobrancaAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        mensalidadeId: z.string().uuid(),
        billingType: z.enum(["PIX", "BOLETO", "UNDEFINED"]).default("UNDEFINED"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { loadAsaasConfig, asaasFetch, ensureAsaasCustomer } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = await loadAsaasConfig();

    const { data: mens, error } = await supabaseAdmin
      .from("mensalidades")
      .select(
        "id, valor, vencimento, descricao, status, aluno_id, responsavel_id, asaas_payment_id, asaas_invoice_url, alunos(nome, cpf, telefone), responsaveis(nome, cpf, telefone, email)",
      )
      .eq("id", data.mensalidadeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!mens) throw new Error("Mensalidade não encontrada.");

    const m = mens as any;
    if (m.asaas_payment_id) {
      return { paymentId: m.asaas_payment_id as string, invoiceUrl: m.asaas_invoice_url as string | null, reused: true };
    }

    const resp = m.responsaveis;
    const alu = m.alunos;
    const customerId = resp
      ? await ensureAsaasCustomer(cfg, {
          tabela: "responsaveis",
          id: m.responsavel_id,
          nome: resp.nome,
          cpf: resp.cpf,
          telefone: resp.telefone,
          email: resp.email,
        })
      : await ensureAsaasCustomer(cfg, {
          tabela: "alunos",
          id: m.aluno_id,
          nome: alu?.nome ?? "Aluno",
          cpf: alu?.cpf ?? null,
          telefone: alu?.telefone ?? null,
        });

    const payment = await asaasFetch<{
      id: string;
      invoiceUrl?: string;
      bankSlipUrl?: string;
    }>(cfg, "/payments", {
      method: "POST",
      body: {
        customer: customerId,
        billingType: data.billingType,
        value: Number(m.valor),
        dueDate: m.vencimento,
        description: m.descricao ?? "Mensalidade",
        externalReference: m.id,
      },
    });

    let pixPayload: string | null = null;
    if (data.billingType === "PIX") {
      try {
        const pix = await asaasFetch<{ payload?: string }>(cfg, `/payments/${payment.id}/pixQrCode`);
        pixPayload = pix.payload ?? null;
      } catch {
        pixPayload = null;
      }
    }

    await supabaseAdmin
      .from("mensalidades")
      .update({
        asaas_payment_id: payment.id,
        asaas_invoice_url: payment.invoiceUrl ?? null,
        asaas_bank_slip_url: payment.bankSlipUrl ?? null,
        asaas_pix_payload: pixPayload,
      } as any)
      .eq("id", m.id);

    return { paymentId: payment.id, invoiceUrl: payment.invoiceUrl ?? null, reused: false };
  });