import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { LoginGate } from "@/components/LegacyApp";

const Page = lazy(() => import("@/legacy-pages/Login"));

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Mahavtaar Ledger" },
      { name: "description", content: "Login view of the Mahavtaar Ledger collection portfolio." },
      { property: "og:title", content: "Login — Mahavtaar Ledger" },
      { property: "og:description", content: "Login view of the Mahavtaar Ledger collection portfolio." },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  return <LoginGate><Page /></LoginGate>;
}
