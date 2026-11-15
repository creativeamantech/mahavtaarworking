import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/city-ledger")({
  beforeLoad: () => {
    throw redirect({ to: "/city-pivot" });
  },
});
