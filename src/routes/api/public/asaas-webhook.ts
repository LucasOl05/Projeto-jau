import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { loadAsaasConfig } = await import("@/lib/asaas.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let cfg;
        try {
          cfg = await loadAsaasConfig();
        } catch {
          return new Response("Integração não configurada", { status: 503 });
        }

        // Token de segurança configurado no painel do Asaas (header asaas-access-token).
        const token = request.headers.get("asaas-access-token") ?? "";
        if (!cfg.webhookToken || token !== cfg.webhookToken) {
          return new Response("Invalid token", { status: 401 });
        }

        const payload = (await request.json().catch(() => null)) as
          | { event?: string; payment?: { id?: string; value?: number; paymentDate?: string; billingType?: string } }
          | null;

        const payment = payload?.payment;
        if (!payload?.event || !payment?.id) return new Response("ok");

        const pagos = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
        const estornos = ["PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED"];

        if (pagos.includes(payload.event)) {
          await supabaseAdmin
            .from("mensalidades")
            .update({
              status: "Pago",
              data_pagamento: payment.paymentDate ?? new Date().toISOString().slice(0, 10),
              valor_pago: payment.value ?? null,
              forma_pagamento: payment.billingType === "PIX" ? "PIX" : payment.billingType === "BOLETO" ? "Boleto" : "Cartão",
            } as never)
            .eq("asaas_payment_id" as never, payment.id as never);
          // B2B: baixa idempotente da fatura de empresa (só altera se ainda não está paga).
          await supabaseAdmin
            .from("faturas_empresas")
            .update({
              status: "Paga",
              data_pagamento: payment.paymentDate ?? new Date().toISOString().slice(0, 10),
            } as never)
            .eq("asaas_payment_id" as never, payment.id as never)
            .neq("status" as never, "Paga" as never);
        } else if (estornos.includes(payload.event)) {
          await supabaseAdmin
            .from("mensalidades")
            .update({ status: "Pendente", data_pagamento: null, valor_pago: null } as never)
            .eq("asaas_payment_id" as never, payment.id as never);
          await supabaseAdmin
            .from("faturas_empresas")
            .update({ status: "Pendente", data_pagamento: null } as never)
            .eq("asaas_payment_id" as never, payment.id as never);
        }

        return new Response("ok");
      },
    },
  },
});