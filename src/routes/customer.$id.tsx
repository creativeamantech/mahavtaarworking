import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";

const Page = lazy(() => import("@/legacy-pages/CustomerDetail"));

export const Route = createFileRoute("/customer/$id")({
  head: () => ({
    meta: [
      { title: "Customer Detail — Mahavtaar Ledger" },
      { name: "description", content: "Customer Detail view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Customer Detail — Mahavtaar Ledger" },
      { property: "og:description", content: "Customer Detail view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute><Page /></ProtectedRoute>;
}
