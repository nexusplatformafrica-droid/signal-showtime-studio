import { describe, expect, it } from "vitest";
import { playbackUrl, resolveRelayTarget, rewritePlaylist } from "@/lib/stream-url";

const WOWZA = "http://www.wowzacontrol.com:1935/sykapjxrcp/sykapjxrcp/playlist.m3u8";

describe("public playback URL", () => {
  it("routes an http Wowza origin through the same-site relay", () => {
    expect(playbackUrl(WOWZA, "movie-max")).toBe("/api/public/hls/movie-max/playlist.m3u8");
  });
  it("uses an https origin directly", () => {
    expect(playbackUrl("https://cdn.example.com/live/master.m3u8", "movie-max")).toBe("https://cdn.example.com/live/master.m3u8");
  });
});

describe("relay safety", () => {
  it("allows files inside the playlist folder", () => {
    expect(resolveRelayTarget(WOWZA, "chunklist_w123.m3u8")?.toString()).toBe("http://www.wowzacontrol.com:1935/sykapjxrcp/sykapjxrcp/chunklist_w123.m3u8");
  });
  it("refuses paths that escape the folder", () => {
    expect(resolveRelayTarget(WOWZA, "../../other/x.m3u8")).toBeNull();
    expect(resolveRelayTarget(WOWZA, "//evil.example.com/x.ts")).toBeNull();
  });
  it("refuses non-stream files", () => {
    expect(resolveRelayTarget(WOWZA, "admin.html")).toBeNull();
  });
  it("makes absolute origin URIs relative", () => {
    const out = rewritePlaylist("#EXTM3U\nhttp://www.wowzacontrol.com:1935/sykapjxrcp/sykapjxrcp/media_1.ts", WOWZA);
    expect(out).toBe("#EXTM3U\nmedia_1.ts");
  });
});
