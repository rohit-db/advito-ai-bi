import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RegistryProvider } from "./RegistryProvider";
import { useRegistry } from "./useRegistry";

function Probe() {
  const reg = useRegistry();
  return <div data-testid="keys">{Object.keys(reg.assets).join(",")}</div>;
}

describe("RegistryProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides the fetched registry when GET /api/assets succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ assets: { fromApi: { label: "X", dashboardId: "d", globalFilterPage: "g", filters: {}, pages: [] } } }),
      }))
    );
    render(
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    );
    await waitFor(() => expect(screen.getByTestId("keys")).toHaveTextContent("fromApi"));
  });

  it("falls back to the bundled seed when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    render(
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    );
    await waitFor(() => expect(screen.getByTestId("keys")).toHaveTextContent("spend"));
  });

  it("falls back to the bundled seed when GET /api/assets is non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }))
    );
    render(
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    );
    await waitFor(() => expect(screen.getByTestId("keys")).toHaveTextContent("spend"));
  });

  it("falls back to the bundled seed when the response body has no assets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    );
    render(
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    );
    await waitFor(() => expect(screen.getByTestId("keys")).toHaveTextContent("spend"));
  });

  it("honors an authoritative empty registry (does not fall back to the bundle)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ assets: {} }) }))
    );
    render(
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    );
    // Wait for the testid to exist (effect settled, provider rendered), then assert empty.
    await waitFor(() => expect(screen.getByTestId("keys")).toBeInTheDocument());
    expect(screen.getByTestId("keys")).toHaveTextContent("");
    expect(screen.getByTestId("keys")).not.toHaveTextContent("spend");
  });
});
