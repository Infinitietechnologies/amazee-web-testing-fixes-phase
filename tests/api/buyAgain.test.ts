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

import { getBuyAgain } from "@/routes/api";

beforeEach(() => {
  mockGet.mockReset();
});

describe("getBuyAgain", () => {
  it("calls GET /user/buy-again with the location and limit", async () => {
    mockGet.mockResolvedValue({ data: { success: true, message: "ok", data: [{ id: 7 }] } });
    const res = await getBuyAgain({ latitude: 13.08, longitude: 80.27, limit: 12 });
    expect(mockGet).toHaveBeenCalledWith("/user/buy-again", { params: { latitude: 13.08, longitude: 80.27, limit: 12 } });
    expect(res.data).toEqual([{ id: 7 }]);
  });

  it("returns an empty list (not a throw) when the call fails", async () => {
    mockGet.mockRejectedValue(new Error("network"));
    const res = await getBuyAgain({ latitude: 1, longitude: 2 });
    expect(res.success).toBe(false);
    expect(res.data).toEqual([]);
  });
});
