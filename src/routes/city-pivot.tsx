import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/LegacyApp";
import { VIEWS } from "@/constants/permissions";

const Page = lazy(() => import("@/legacy-pages/CityPivot"));

export const Route = createFileRoute("/city-pivot")({
  head: () => ({
    meta: [
      { title: "City Pivot — Mahavtaar Ledger" },
      { name: "description", content: "City Pivot view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "City Pivot — Mahavtaar Ledger" },
      { property: "og:description", content: "City Pivot view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <ProtectedRoute view={VIEWS.CITY_PIVOT}><Page /></ProtectedRoute>;
}
