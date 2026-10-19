import React from "react";
import { Navigate } from "@/lib/router-compat";

/**
 * ConnectivityHub decommissioned: The system is now permanently online
 * with Google Sheets Multi-Spreadsheet Architecture managed under Settings.
 */
export default function ConnectivityHub() {
  return <Navigate to="/settings?tab=spreadsheets" replace />;
}
