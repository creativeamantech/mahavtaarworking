import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/BandExplorer"));

export const Route = createFileRoute("/band-explorer")({
  head: () => ({
    meta: [
      { title: "Band Explorer — Mahavtaar Ledger" },
      { name: "description", content: "Band Explorer view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Band Explorer — Mahavtaar Ledger" },
      { property: "og:description", content: "Band Explorer view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.CITY_TEAM_MATRIX}><Page /></ProtectedRoute>;
}
