import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";

const Page = lazy(() => import("@/legacy-pages/Profile"));

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Mahavtaar Ledger" },
      { name: "description", content: "Profile view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Profile — Mahavtaar Ledger" },
      { property: "og:description", content: "Profile view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute><Page /></ProtectedRoute>;
}
