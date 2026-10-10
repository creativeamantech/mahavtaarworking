import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/AllFeedback"));

export const Route = createFileRoute("/feedbacks")({
  head: () => ({
    meta: [
      { title: "All Feedback — Mahavtaar Ledger" },
      { name: "description", content: "All Feedback view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "All Feedback — Mahavtaar Ledger" },
      { property: "og:description", content: "All Feedback view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.FEEDBACKS}><Page /></ProtectedRoute>;
}
