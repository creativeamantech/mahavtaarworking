import { createFileRoute } from "@tanstack/react-router";
import { HomeRedirect } from "@/components/LegacyApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mahavtaar Ledger — Collection Portfolio" },
      { name: "description", content: "Collection portfolio, recovery tracking and data explorer." },
      { property: "og:title", content: "Mahavtaar Ledger — Collection Portfolio" },
      { property: "og:description", content: "Collection portfolio, recovery tracking and data explorer." },
    ],
  }),
  component: HomeRedirect,
});
