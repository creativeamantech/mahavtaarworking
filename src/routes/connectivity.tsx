import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/connectivity")({
  component: RoutePage,
});

function RoutePage() {
  return <Navigate to="/settings?tab=spreadsheets" replace />;
}

