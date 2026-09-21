import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PortalEmpresaFatura = {
  id: string;
  codigo_publico: string | null;
  descricao: string | null;
  competencia: string | null;
  valor: number;
  vencimento: string;
  status: string;
  status_fiscal: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_pix_payload: string | null;
  numero_nfse: string | null;
  url_pdf_nfse: string | null;
  url_xml_nfse: string | null;
};

export type PortalEmpresaSessao = {
  empresa: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    codigo_publico: string | null;
  };
  faturas: PortalEmpresaFatura[];
};

/** Acesso da empresa parceira ao portal: CNPJ + código da empresa (EMP-000001). */
export async function autenticarEmpresaPortal(
  cnpjInput: string,
  codigoInput: string,
): Promise<PortalEmpresaSessao> {
  const digitos = cnpjInput.replace(/\D/g, "");
  const codigo = codigoInput.trim().toUpperCase();

  if (digitos.length !== 14) throw new Error("Informe um CNPJ válido com 14 dígitos.");

  const { data: candidatos, error } = await supabaseAdmin
    .from("empresas")
    .select("id, razao_social, nome_fantasia, cnpj, codigo_publico, status")
    .is("deleted_at", null);

  if (error) throw new Error("Não foi possível validar o acesso agora.");

  const empresa = (candidatos ?? []).find(
    (e) =>
      (e.cnpj ?? "").replace(/\D/g, "") === digitos &&
      (e.codigo_publico ?? "").toUpperCase() === codigo,
  );

  if (!empresa) throw new Error("Dados não conferem. Confira o CNPJ e o código da empresa.");

  const { data: faturas } = await supabaseAdmin
    .from("faturas_empresas")
    .select(
      "id, codigo_publico, descricao, competencia, valor, vencimento, status, status_fiscal, data_pagamento, forma_pagamento, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload, numero_nfse, url_pdf_nfse, url_xml_nfse",
    )
    .eq("empresa_id", empresa.id)
    .is("deleted_at", null)
    .order("vencimento", { ascending: false });

  return {
    empresa: {
      id: empresa.id,
      razao_social: empresa.razao_social,
      nome_fantasia: empresa.nome_fantasia,
      cnpj: empresa.cnpj,
      codigo_publico: empresa.codigo_publico,
    },
    faturas: (faturas ?? []) as PortalEmpresaFatura[],
  };
}
