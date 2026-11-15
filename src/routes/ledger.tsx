import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/Ledger"));

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Case Ledger — Mahavtaar Ledger" },
      { name: "description", content: "Case Ledger view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Case Ledger — Mahavtaar Ledger" },
      { property: "og:description", content: "Case Ledger view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.DATA_EXPLORER}><Page /></ProtectedRoute>;
}
