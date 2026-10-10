import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/ConnectivityHub"));

export const Route = createFileRoute("/connectivity")({
  head: () => ({
    meta: [
      { title: "Connectivity Hub — Mahavtaar Ledger" },
      { name: "description", content: "Connectivity Hub view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Connectivity Hub — Mahavtaar Ledger" },
      { property: "og:description", content: "Connectivity Hub view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.CONNECTIVITY_HUB}><Page /></ProtectedRoute>;
}
