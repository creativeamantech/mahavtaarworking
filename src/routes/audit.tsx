import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/AuditLog"));

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — Mahavtaar Ledger" },
      { name: "description", content: "Audit Log view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Audit Log — Mahavtaar Ledger" },
      { property: "og:description", content: "Audit Log view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.AUDIT_LOG}><Page /></ProtectedRoute>;
}
