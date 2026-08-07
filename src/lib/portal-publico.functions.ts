import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Acesso público do aluno/responsável ao extrato: CPF ou RA + data de nascimento. */
export const acessarPortalPublico = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        identificador: z.string().trim().min(3).max(40),
        nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida."),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { autenticarAlunoPortal } = await import("./portal-publico.server");
    return await autenticarAlunoPortal(data.identificador, data.nascimento);
  });