import { describe, expect, it } from "vitest";
import { parseMediaLink } from "@/lib/media-link";

const R2 = { accountId: "abc123", bucket: "moviemax" };

describe("pasted R2 media links", () => {
  it("accepts a public r2.dev link as-is", () => {
    const r = parseMediaLink("https://pub-9f8e.r2.dev/movies/The%20Big%20Day.mp4");
    expect(r).toMatchObject({ ok: true, kind: "public", url: "https://pub-9f8e.r2.dev/movies/The%20Big%20Day.mp4", title: "The Big Day" });
  });
  it("turns a link into the connected bucket into an object key", () => {
    const r = parseMediaLink("https://abc123.r2.cloudflarestorage.com/moviemax/films/action/hero.mkv", R2);
    expect(r).toMatchObject({ ok: true, kind: "bucket", key: "films/action/hero.mkv" });
  });
  it("understands bucket-in-hostname links and drops expiring signatures", () => {
    const r = parseMediaLink("https://moviemax.abc123.r2.cloudflarestorage.com/ads/promo.mp4?X-Amz-Signature=zz&X-Amz-Expires=60", R2);
    expect(r).toMatchObject({ ok: true, kind: "bucket", key: "ads/promo.mp4", url: "https://moviemax.abc123.r2.cloudflarestorage.com/ads/promo.mp4" });
  });
  it("refuses private links when R2 is not connected or the bucket differs", () => {
    expect(parseMediaLink("https://abc123.r2.cloudflarestorage.com/moviemax/a.mp4").ok).toBe(false);
    expect(parseMediaLink("https://abc123.r2.cloudflarestorage.com/other/a.mp4", R2).ok).toBe(false);
  });
  it("refuses expiring signed public links, non-video files and non-web links", () => {
    expect(parseMediaLink("https://cdn.example.com/a.mp4?X-Amz-Signature=1").ok).toBe(false);
    expect(parseMediaLink("https://pub-1.r2.dev/poster.jpg").ok).toBe(false);
    expect(parseMediaLink("ftp://pub-1.r2.dev/a.mp4").ok).toBe(false);
  });
});
