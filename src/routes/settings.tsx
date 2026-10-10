import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/Settings"));

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Mahavtaar Ledger" },
      { name: "description", content: "Settings view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Settings — Mahavtaar Ledger" },
      { property: "og:description", content: "Settings view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.SETTINGS}><Page /></ProtectedRoute>;
}
