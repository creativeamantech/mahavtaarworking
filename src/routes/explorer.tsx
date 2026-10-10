import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/DataExplorer"));

export const Route = createFileRoute("/explorer")({
  head: () => ({
    meta: [
      { title: "Data Explorer — Mahavtaar Ledger" },
      { name: "description", content: "Data Explorer view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Data Explorer — Mahavtaar Ledger" },
      { property: "og:description", content: "Data Explorer view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.DATA_EXPLORER}><Page /></ProtectedRoute>;
}
