/**
 * The station's broadcast server (where the playout engine / OBS pushes the channel).
 * Server-only on purpose: the stream key must never ship in the browser bundle. It is
 * built in so every remix of the project broadcasts to the same server without setup.
 */
export const STATION_DESTINATION = {
  provider: "HostHerb",
  rtmp_url: "rtmps://source.hostherb.com:1936",
  stream_name: "hhv_4940993731b415ba65489e4018a80e8783294972c5930d40",
  username: null as string | null,
};

/** Where viewers watch the channel on HostHerb (public links, safe to show anywhere). */
export const STATION_PLAYBACK = {
  hls_url: "https://watch.hostherb.com/tv-257/index.m3u8",
  player_url: "https://watch.hostherb.com/player/tv-257/",
};

/** Destinations written by older versions of the app that should be replaced by the station server. */
export function isLegacyDestination(rtmpUrl: string | null | undefined) {
  return !rtmpUrl || /wowzacontrol\.com/i.test(rtmpUrl);
}

/** The old Wowza viewer link — it stops receiving video once the channel is sent to HostHerb. */
export function isLegacyPlaybackUrl(hlsUrl: string | null | undefined) {
  return !!hlsUrl && /streamlock\.net/i.test(hlsUrl);
}
