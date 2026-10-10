import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/LiveMonitoring"));

export const Route = createFileRoute("/live-monitoring")({
  head: () => ({
    meta: [
      { title: "Live Monitoring — Mahavtaar Ledger" },
      { name: "description", content: "Live Monitoring view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Live Monitoring — Mahavtaar Ledger" },
      { property: "og:description", content: "Live Monitoring view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.LIVE_MONITORING}><Page /></ProtectedRoute>;
}
