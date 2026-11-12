import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS engine shipped as a download
import { ffmpegArgs, pickProgramme, publishUrl } from "../../public/engine/movie-max-engine.mjs";

const film = { id: "m1", title: "Film", duration_seconds: 3600, playable: true, url: "https://pub-x.r2.dev/film.mp4" };
const slot = { id: "e1", title: "Evening Film", media_id: "m1", playlist_id: null, starts_at: "2026-11-12T11:00:00Z", ends_at: "2026-11-12T18:00:00Z", priority: 0 };

describe("playout engine schedule", () => {
  it("plays the scheduled film from the right point in time", () => {
    const p = pickProgramme({ entries: [slot], media: [film], playlists: [] }, new Date("2026-11-12T11:30:00Z"));
    expect(p.media.id).toBe("m1");
    expect(p.offset).toBe(1800);
  });
  it("repeats a short film to fill a long slot", () => {
    const p = pickProgramme({ entries: [slot], media: [film], playlists: [] }, new Date("2026-11-12T13:15:00Z"));
    expect(p.offset).toBe(900);
  });
  it("plays nothing outside the slot and when the file is missing", () => {
    expect(pickProgramme({ entries: [slot], media: [film], playlists: [] }, new Date("2026-11-12T18:00:00Z")).media).toBeNull();
    expect(pickProgramme({ entries: [slot], media: [{ ...film, playable: false }], playlists: [] }, new Date("2026-11-12T12:00:00Z")).media).toBeNull();
  });
  it("walks through playlist items in order", () => {
    const a = { ...film, id: "a", duration_seconds: 600 }, b = { ...film, id: "b", duration_seconds: 600 };
    const entry = { ...slot, media_id: null, playlist_id: "p1" };
    const s = { entries: [entry], media: [a, b], playlists: [{ id: "p1", repeat: true, items: [{ media_id: "a" }, { media_id: "b" }] }] };
    const p = pickProgramme(s, new Date("2026-11-12T11:15:00Z"));
    expect([p.media.id, p.offset]).toEqual(["b", 300]);
  });
  it("skips the current item when an operator presses skip", () => {
    const s = { entries: [slot], media: [film], playlists: [] };
    const now = new Date("2026-11-12T11:30:00Z");
    expect(pickProgramme(s, now, pickProgramme(s, now).key).media).toBeNull();
  });
});

describe("playout engine output", () => {
  it("pushes to the Wowza application + stream name", () => {
    expect(publishUrl({ rtmp_url: "rtmp://www.wowzacontrol.com:1935/sykapjxrcp", stream_name: "sykapjxrcp" })).toBe("rtmp://www.wowzacontrol.com:1935/sykapjxrcp/sykapjxrcp");
  });
  it("encodes in real time at the channel settings", () => {
    const args = ffmpegArgs({ input: film.url, offset: 90, out: "rtmp://x/app/s", resolution: "1280x720", fps: 25, vKbps: 2500, aKbps: 128 });
    expect(args).toContain("-re");
    expect(args.slice(args.indexOf("-ss"), args.indexOf("-ss") + 2)).toEqual(["-ss", "90.00"]);
    expect(args.slice(args.indexOf("-b:v"), args.indexOf("-b:v") + 2)).toEqual(["-b:v", "2500k"]);
  });
});
