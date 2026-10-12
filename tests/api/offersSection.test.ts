import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    }),
    isAxiosError: vi.fn(),
  },
}));

import { getOffersSection } from "@/routes/api";

beforeEach(() => {
  mockGet.mockReset();
});

describe("getOffersSection", () => {
  it("calls GET /offers/section with the location and optional category", async () => {
    mockGet.mockResolvedValue({ data: { success: true, message: "ok", data: { title: "Offers", categories: [], bogo_groups: [], discount_groups: [] } } });
    const res = await getOffersSection({ latitude: 12.9, longitude: 77.6, category: "dairy" });
    expect(mockGet).toHaveBeenCalledWith("/offers/section", { params: { latitude: 12.9, longitude: 77.6, category: "dairy" } });
    expect(res.data?.title).toBe("Offers");
  });

  it("returns a failed response without throwing", async () => {
    mockGet.mockRejectedValue(new Error("network"));
    const res = await getOffersSection({});
    expect(res.success).toBe(false);
    expect(res.data).toBeUndefined();
  });
});
