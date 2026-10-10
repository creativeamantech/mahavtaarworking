import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/TeamPivot"));

export const Route = createFileRoute("/team-pivot")({
  head: () => ({
    meta: [
      { title: "Team Pivot — Mahavtaar Ledger" },
      { name: "description", content: "Team Pivot view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Team Pivot — Mahavtaar Ledger" },
      { property: "og:description", content: "Team Pivot view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.TEAM_PIVOT}><Page /></ProtectedRoute>;
}
