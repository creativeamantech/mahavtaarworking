import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/team-ledger")({
  beforeLoad: () => {
    throw redirect({ to: "/team-pivot" });
  },
});
