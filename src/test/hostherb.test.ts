import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS engine shipped as a download
import { publishUrl } from "../../public/engine/movie-max-engine.mjs";
import { playbackUrl } from "@/lib/stream-url";
import { STATION_DESTINATION, STATION_PLAYBACK, isLegacyDestination, isLegacyPlaybackUrl } from "@/lib/station-destination.server";

describe("HostHerb broadcast server", () => {
  it("the engine pushes to the HostHerb RTMPS server with the stream key", () => {
    const url = publishUrl(STATION_DESTINATION);
    expect(url).toBe(`rtmps://source.hostherb.com:1936/${STATION_DESTINATION.stream_name}`);
  });

  it("viewers play the HostHerb https link directly (no relay)", () => {
    expect(playbackUrl(STATION_PLAYBACK.hls_url, "movie-max", "https://moviemax.example")).toBe("https://watch.hostherb.com/tv-257/index.m3u8");
  });

  it("replaces only the old Wowza setup, never a destination the station chose", () => {
    expect(isLegacyDestination("rtmp://www.wowzacontrol.com:1935/sykapjxrcp")).toBe(true);
    expect(isLegacyDestination(null)).toBe(true);
    expect(isLegacyDestination("rtmps://source.hostherb.com:1936")).toBe(false);
    expect(isLegacyPlaybackUrl("https://5caf24a595d94.streamlock.net:1937/sykapjxrcp/sykapjxrcp/playlist.m3u8")).toBe(true);
    expect(isLegacyPlaybackUrl(STATION_PLAYBACK.hls_url)).toBe(false);
  });
});
