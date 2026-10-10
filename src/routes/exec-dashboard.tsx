import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/ExecDashboard"));

export const Route = createFileRoute("/exec-dashboard")({
  head: () => ({
    meta: [
      { title: "Exec Dashboard — Mahavtaar Ledger" },
      { name: "description", content: "Exec Dashboard view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Exec Dashboard — Mahavtaar Ledger" },
      { property: "og:description", content: "Exec Dashboard view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.EXEC_DASHBOARD}><Page /></ProtectedRoute>;
}
