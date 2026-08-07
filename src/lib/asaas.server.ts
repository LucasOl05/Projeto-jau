import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AsaasConfig = {
  id: string;
  school_id: string;
  apiKey: string;
  ambiente: string;
  webhookToken: string | null;
  baseUrl: string;
};

/** Lê as credenciais salvas em public.configuracoes (nunca hardcoded / nunca no cliente). */
export async function loadAsaasConfig(): Promise<AsaasConfig> {
  const { data, error } = await supabaseAdmin
    .from("configuracoes")
    .select("id, school_id, asaas_api_key, asaas_ambiente, asaas_webhook_token")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Configuração da escola não encontrada.");

  const apiKey = (data.asaas_api_key ?? "").trim();
  if (!apiKey) throw new Error("Chave de API do Asaas não configurada em Configurações → Asaas.");

  const ambiente = data.asaas_ambiente ?? "sandbox";
  return {
    id: data.id,
    school_id: data.school_id,
    apiKey,
    ambiente,
    webhookToken: (data as { asaas_webhook_token?: string | null }).asaas_webhook_token ?? null,
    baseUrl:
      ambiente === "producao"
        ? "https://api.asaas.com/v3"
        : "https://api-sandbox.asaas.com/v3",
  };
}

export async function asaasFetch<T>(
  cfg: AsaasConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      access_token: cfg.apiKey,
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : {};
  if (!res.ok) {
    const errs = (json as { errors?: { description?: string }[] }).errors;
    const msg = errs?.[0]?.description ?? `Erro Asaas (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return json as T;
}

type AsaasCustomer = { id: string };

/** Garante um cliente no Asaas para o responsável (ou aluno) e persiste o id. */
export async function ensureAsaasCustomer(
  cfg: AsaasConfig,
  pagador: { tabela: "responsaveis" | "alunos"; id: string; nome: string; cpf: string | null; telefone: string | null; email?: string | null },
): Promise<string> {
  const { data: row } = await supabaseAdmin
    .from(pagador.tabela)
    .select("asaas_customer_id")
    .eq("id", pagador.id)
    .maybeSingle();

  const existing = (row as { asaas_customer_id?: string | null } | null)?.asaas_customer_id;
  if (existing) return existing;

  const cpf = (pagador.cpf ?? "").replace(/\D/g, "");
  if (!cpf) throw new Error(`Informe o CPF de ${pagador.nome} antes de gerar a cobrança no Asaas.`);

  const customer = await asaasFetch<AsaasCustomer>(cfg, "/customers", {
    method: "POST",
    body: {
      name: pagador.nome,
      cpfCnpj: cpf,
      mobilePhone: (pagador.telefone ?? "").replace(/\D/g, "") || undefined,
      email: pagador.email || undefined,
      externalReference: `${pagador.tabela}:${pagador.id}`,
    },
  });

  await supabaseAdmin.from(pagador.tabela).update({ asaas_customer_id: customer.id }).eq("id", pagador.id);
  return customer.id;
}