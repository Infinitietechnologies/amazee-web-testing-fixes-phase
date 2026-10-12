import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Same pattern as tests/api/homeLayout.test.ts: mock the axios singleton the
// api layer builds, and share the spies through vi.hoisted.
const { mockGet, mockPut, mockIsAxiosError } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockIsAxiosError: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: vi.fn(),
      put: mockPut,
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
    isAxiosError: mockIsAxiosError,
  },
}));

import {
  getWatchAndBuyConfig,
  getWatchAndBuyProfile,
  getWatchAndBuyProfileStories,
  getWatchAndBuyReels,
  getWatchAndBuyStoryTray,
  markWatchAndBuyStoriesSeen,
  updateWatchAndBuyReelLikes,
} from "@/routes/api";

/** A minimal Axios-shaped error for the failure-metadata helper. */
const axiosError = (status?: number, url = "/watch-and-buy/reels") => ({
  isAxiosError: true,
  code: status ? "ERR_BAD_RESPONSE" : "ERR_NETWORK",
  config: { method: "get", url: `${url}?latitude=1&longitude=2` },
  ...(status ? { response: { status } } : {}),
});

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockIsAxiosError.mockReset();
  mockIsAxiosError.mockImplementation(
    (value: unknown) =>
      Boolean(value) && (value as { isAxiosError?: boolean }).isAxiosError === true,
  );
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe("Watch & Buy customer API — request contract (v3.2 URIs)", () => {
  it("GET /watch-and-buy/config", async () => {
    mockGet.mockResolvedValue({
      data: { success: true, message: "ok", data: { enabled: true, title: "Watch & Buy" } },
    });

    const res = await getWatchAndBuyConfig();

    expect(mockGet).toHaveBeenCalledWith("/watch-and-buy/config");
    expect(res.data?.enabled).toBe(true);
  });

  it("GET /watch-and-buy/reels forwards every v3.2 feed param", async () => {
    mockGet.mockResolvedValue({
      data: { success: true, message: "ok", data: { items: [], meta: { next_cursor: null, per_page: 10 } } },
    });

    await getWatchAndBuyReels({
      latitude: 12.9,
      longitude: 77.6,
      session_id: "s1",
      cursor: "c1",
      slug: "reel-slug",
      store_id: 7,
      store_slug: "fresh-mart",
      per_page: 12,
    });

    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/watch-and-buy/reels");
    expect(config.params).toEqual({
      latitude: 12.9,
      longitude: 77.6,
      session_id: "s1",
      cursor: "c1",
      slug: "reel-slug",
      store_id: 7,
      store_slug: "fresh-mart",
      per_page: 12,
    });
  });

  it("GET /watch-and-buy/profiles/{username} URL-encodes the username", async () => {
    mockGet.mockResolvedValue({ data: { success: true, message: "ok", data: null } });

    await getWatchAndBuyProfile("a b/c", { latitude: 1, longitude: 2, page: 2 });

    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/watch-and-buy/profiles/a%20b%2Fc");
    expect(config.params).toEqual({ latitude: 1, longitude: 2, page: 2 });
  });

  it("GET /watch-and-buy/statuses (story tray)", async () => {
    mockGet.mockResolvedValue({
      data: { success: true, message: "ok", data: { items: [], meta: { next_cursor: null, per_page: 10 } } },
    });

    await getWatchAndBuyStoryTray({ store_slug: "fresh-mart", per_page: 5 });

    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/watch-and-buy/statuses");
    expect(config.params).toEqual({ store_slug: "fresh-mart", per_page: 5 });
  });

  it("GET /watch-and-buy/profiles/{username}/statuses", async () => {
    mockGet.mockResolvedValue({ data: { success: true, message: "ok", data: null } });

    await getWatchAndBuyProfileStories("fresh_mart", { cursor: "n2" });

    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe("/watch-and-buy/profiles/fresh_mart/statuses");
    expect(config.params).toEqual({ cursor: "n2" });
  });

  it("PUT /watch-and-buy/reels/likes sends the batch as the body, token out of it", async () => {
    mockPut.mockResolvedValue({ data: { success: true, message: "ok", data: [] } });

    await updateWatchAndBuyReelLikes({
      latitude: 1,
      longitude: 2,
      items: [{ reel_id: 9, liked: true }],
      access_token: "tok",
    });

    const [url, body, config] = mockPut.mock.calls[0];
    expect(url).toBe("/watch-and-buy/reels/likes");
    expect(body).toEqual({ latitude: 1, longitude: 2, items: [{ reel_id: 9, liked: true }] });
    // The interceptor moves `access_token` into the Authorization header.
    expect(config.params).toEqual({ access_token: "tok" });
  });

  it("PUT /watch-and-buy/statuses/seen without an explicit token relies on the cookie", async () => {
    mockPut.mockResolvedValue({ data: { success: true, message: "ok", data: [] } });

    await markWatchAndBuyStoriesSeen({ status_ids: [3, 4] });

    const [url, body, config] = mockPut.mock.calls[0];
    expect(url).toBe("/watch-and-buy/statuses/seen");
    expect(body).toEqual({ status_ids: [3, 4] });
    expect(config.params).toBeUndefined();
  });
});

describe("Watch & Buy customer API — failures return typed fallbacks", () => {
  it("reel feed: empty page, never throws, retryable on 5xx", async () => {
    mockGet.mockRejectedValue(axiosError(503));

    const res = await getWatchAndBuyReels({ latitude: 1, longitude: 2, per_page: 6 });

    expect(res.success).toBe(false);
    expect(res.data).toEqual({ items: [], meta: { next_cursor: null, per_page: 6 } });
    expect((res as { retryable?: boolean }).retryable).toBe(true);
  });

  it("story tray: empty page; 4xx is not retryable", async () => {
    mockGet.mockRejectedValue(axiosError(422, "/watch-and-buy/statuses"));

    const res = await getWatchAndBuyStoryTray();

    expect(res.success).toBe(false);
    expect(res.data?.items).toEqual([]);
    expect((res as { retryable?: boolean }).retryable).toBe(false);
  });

  it("network error (no response) is retryable", async () => {
    mockGet.mockRejectedValue(axiosError(undefined, "/watch-and-buy/config"));

    const res = await getWatchAndBuyConfig();

    expect(res).toMatchObject({ success: false, data: null, retryable: true });
  });

  it("logs a sanitised summary: redacted path, no query string, no raw error", async () => {
    mockGet.mockRejectedValue(axiosError(404, "/watch-and-buy/profiles/123456"));

    await getWatchAndBuyProfile("123456", { latitude: 1, longitude: 2 });

    expect(warn).toHaveBeenCalledTimes(1);
    const [message, details] = warn.mock.calls[0];
    expect(message).toContain("Watch & Buy profile");
    expect(details).toEqual({
      code: "ERR_BAD_RESPONSE",
      method: "GET",
      path: "/watch-and-buy/profiles/:id",
      status: 404,
    });
  });

  it("likes and seen: null data on failure", async () => {
    mockPut.mockRejectedValue(axiosError(401, "/watch-and-buy/reels/likes"));

    const like = await updateWatchAndBuyReelLikes({ latitude: 1, longitude: 2, items: [] });
    const seen = await markWatchAndBuyStoriesSeen({ status_ids: [1] });

    expect(like).toMatchObject({ success: false, data: null });
    expect(seen).toMatchObject({ success: false, data: null });
  });
});
