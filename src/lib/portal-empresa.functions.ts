import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Acesso público da empresa parceira ao portal: CNPJ + código da empresa. */
export const acessarPortalEmpresa = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        cnpj: z.string().trim().min(11).max(20),
        codigo: z.string().trim().min(3).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { autenticarEmpresaPortal } = await import("./portal-empresa.server");
    return await autenticarEmpresaPortal(data.cnpj, data.codigo);
  });
