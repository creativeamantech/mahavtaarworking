import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/DataEntry"));

export const Route = createFileRoute("/data-entry")({
  head: () => ({
    meta: [
      { title: "Data Entry — Mahavtaar Ledger" },
      { name: "description", content: "Data Entry view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Data Entry — Mahavtaar Ledger" },
      { property: "og:description", content: "Data Entry view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.DATA_ENTRY}><Page /></ProtectedRoute>;
}
