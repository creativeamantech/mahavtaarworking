import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/ExecTeamPerf"));

export const Route = createFileRoute("/exec-team-perf")({
  head: () => ({
    meta: [
      { title: "Exec Team Perf — Mahavtaar Ledger" },
      { name: "description", content: "Exec Team Perf view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Exec Team Perf — Mahavtaar Ledger" },
      { property: "og:description", content: "Exec Team Perf view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.EXEC_TEAM_PERF}><Page /></ProtectedRoute>;
}
