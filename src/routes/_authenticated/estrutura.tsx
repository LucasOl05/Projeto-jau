import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/estrutura")({
  beforeLoad: () => {
    throw redirect({ to: "/cursos" });
  },
  component: () => null,
});