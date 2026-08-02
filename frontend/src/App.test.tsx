import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";
import App from "./App";

/**
 * Regression guard for the admin-context sidebar builder (Phase-4 deferred).
 *
 * When an operator navigates to /admin/*, App.tsx builds sidebarSections with:
 *   - an unlabelled section containing "Back to APEX"
 *   - an "Administration" section containing ADMIN_SECTIONS entries (Assets, etc.)
 *
 * This test asserts the admin-context nav renders correctly against the current
 * correct code. A future regression in the inAdmin/isOperator branching will
 * cause this test to fail.
 */

function renderAppAtAdmin() {
  // Stub fetch: /api/auth/me returns an authenticated operator user.
  // All other calls (e.g. /api/me, registry) return 401 / empty registry.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/auth/me") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            display_name: "Admin User",
            email: "admin@example.com",
            role: "operator",
            tenant: "Acme Corp",
          }),
        };
      }
      // Fallback — 401 for everything else (registry loader, /api/me, etc.)
      return { ok: false, status: 401, json: async () => ({}) };
    })
  );

  const registry: Registry = { assets: {} };

  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter initialEntries={["/admin/assets"]}>
        <App />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

describe("App — admin-context sidebar builder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders 'Back to APEX' in the sidebar when operator is at /admin/*", async () => {
    renderAppAtAdmin();
    // useUser is async; wait for the operator user to load and sidebar to rebuild.
    await waitFor(() => {
      expect(screen.getByText(/back to apex/i)).toBeInTheDocument();
    });
  });

  it("renders ADMIN_SECTIONS entries (Assets) in the sidebar for admin context", async () => {
    renderAppAtAdmin();
    await waitFor(() => {
      // ADMIN_SECTIONS has label "Assets" — should appear as a nav item.
      expect(screen.getByText("Assets")).toBeInTheDocument();
    });
  });
});
