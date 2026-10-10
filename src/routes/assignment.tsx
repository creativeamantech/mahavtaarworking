import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/Assignment"));

export const Route = createFileRoute("/assignment")({
  head: () => ({
    meta: [
      { title: "Assignment — Mahavtaar Ledger" },
      { name: "description", content: "Assignment view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Assignment — Mahavtaar Ledger" },
      { property: "og:description", content: "Assignment view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.ASSIGNMENT}><Page /></ProtectedRoute>;
}
