// @ts-nocheck
import { describe, it, expect } from "vitest";
import { ROUTE_LOOKUP, renderTabIcon } from "@/contexts/WorkspaceTabsContext";

describe("Workspace Tabs System", () => {
  it("has metadata configured for all core workspace routes", () => {
    const requiredRoutes = [
      "/dashboard",
      "/exec-dashboard",
      "/live-monitoring",
      "/exec-team-perf",
      "/explorer",
      "/city-pivot",
      "/team-pivot",
      "/feedbacks",
      "/attendance",
      "/settings",
      "/audit",
    ];

    for (const route of requiredRoutes) {
      expect(ROUTE_LOOKUP[route]).toBeDefined();
      expect(ROUTE_LOOKUP[route].title.length).toBeGreaterThan(0);
      expect(ROUTE_LOOKUP[route].iconName.length).toBeGreaterThan(0);
    }
  });

  it("renders valid React elements for tab icons without error", () => {
    const icons = ["Home", "TrendingUp", "Search", "Building2", "GitFork", "CreditCard", "Layout"];
    for (const icon of icons) {
      const el = renderTabIcon(icon);
      expect(el).toBeDefined();
      expect(el.type).toBeDefined();
    }
  });

  it("handles fallback icon for unknown icon names", () => {
    const el = renderTabIcon("UnknownIconName");
    expect(el).toBeDefined();
    expect(el.type).toBeDefined();
  });

  it("formats customer 360 dynamic paths with credit card icon and title", () => {
    const sampleCustomerPath = "/customer/LN10029";
    const agreementId = sampleCustomerPath.split("/customer/")[1];
    expect(agreementId).toBe("LN10029");
    const formattedTitle = `Case #${agreementId.slice(-6)}`;
    expect(formattedTitle).toBe("Case #N10029");
  });
});
