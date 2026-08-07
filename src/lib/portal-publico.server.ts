import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PortalMensalidade = {
  id: string;
  codigo_publico: string | null;
  descricao: string | null;
  competencia: string | null;
  valor: number;
  vencimento: string;
  status: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_pix_payload: string | null;
};

export type PortalSessao = {
  aluno: { id: string; nome: string; codigo_publico: string | null; matricula: number | null };
  mensalidades: PortalMensalidade[];
  frequencia: { total: number; presencas: number; percentual: number | null };
};

/** Localiza o aluno por CPF ou RA (código público / matrícula) + data de nascimento. */
export async function autenticarAlunoPortal(
  identificador: string,
  nascimentoISO: string,
): Promise<PortalSessao> {
  const digitos = identificador.replace(/\D/g, "");
  const codigo = identificador.trim().toUpperCase();

  const { data: candidatos, error } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, codigo_publico, matricula, cpf, data_nascimento")
    .eq("data_nascimento", nascimentoISO)
    .is("deleted_at", null);

  if (error) throw new Error("Não foi possível validar o acesso agora.");

  const aluno = (candidatos ?? []).find((a) => {
    const cpf = (a.cpf ?? "").replace(/\D/g, "");
    if (digitos.length === 11 && cpf && cpf === digitos) return true;
    if ((a.codigo_publico ?? "").toUpperCase() === codigo) return true;
    if (digitos.length > 0 && String(a.matricula) === String(Number(digitos))) return true;
    return false;
  });

  if (!aluno) throw new Error("Dados não conferem. Confira o CPF/RA e a data de nascimento.");

  const { data: mensalidades } = await supabaseAdmin
    .from("mensalidades")
    .select(
      "id, codigo_publico, descricao, competencia, valor, vencimento, status, data_pagamento, valor_pago, asaas_invoice_url, asaas_bank_slip_url, asaas_pix_payload",
    )
    .eq("aluno_id", aluno.id)
    .is("deleted_at", null)
    .order("vencimento", { ascending: true });

  const { data: chamadas } = await supabaseAdmin
    .from("diario_chamada")
    .select("situacao, presente")
    .eq("aluno_id", aluno.id);

  const total = (chamadas ?? []).length;
  const presencas = (chamadas ?? []).filter((c) =>
    (c.situacao ?? (c.presente ? "Presente" : "Falta")).toLowerCase().includes("presen"),
  ).length;

  return {
    aluno: {
      id: aluno.id,
      nome: aluno.nome,
      codigo_publico: aluno.codigo_publico,
      matricula: aluno.matricula ?? null,
    },
    mensalidades: (mensalidades ?? []) as PortalMensalidade[],
    frequencia: { total, presencas, percentual: total > 0 ? (presencas / total) * 100 : null },
  };
}