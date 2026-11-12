import { describe, expect, it } from "vitest";
import { pickWebProgramme, type PlayoutBundle } from "@/lib/web-playout";

const film = { id: "m1", title: "Film", duration_seconds: 3254.4, playable: true, url: "https://pub-x.r2.dev/film.mp4" };
const slot = { id: "e1", title: "SPIRITUAL PART 5 A", media_id: "m1", playlist_id: null, starts_at: "2026-11-12T11:02:00Z", ends_at: "2026-11-12T17:55:00Z", priority: 0 };
const bundle: PlayoutBundle = { entries: [slot], media: [film], playlists: [] };
const at = (iso: string) => Date.parse(iso);

describe("website playout", () => {
  it("starts the scheduled video at its start time", () => {
    const p = pickWebProgramme(bundle, at("2026-11-12T11:02:00Z"));
    expect(p?.media.id).toBe("m1");
    expect(p?.offset).toBe(0);
  });
  it("joins mid-programme at the same point for every viewer", () => {
    expect(pickWebProgramme(bundle, at("2026-11-12T11:12:00Z"))?.offset).toBe(600);
  });
  it("repeats the video when the slot is longer than the file", () => {
    const p = pickWebProgramme(bundle, at("2026-11-12T12:06:14.4Z"));
    expect(p?.offset).toBeCloseTo(600, 3);
    expect(p?.key).toBe("e1:m1:1");
  });
  it("plays nothing before the start, after the end, or without a playable file", () => {
    expect(pickWebProgramme(bundle, at("2026-11-12T11:01:59Z"))).toBeNull();
    expect(pickWebProgramme(bundle, at("2026-11-12T17:55:00Z"))).toBeNull();
    expect(pickWebProgramme({ ...bundle, media: [{ ...film, playable: false, url: null }] }, at("2026-11-12T12:00:00Z"))).toBeNull();
  });
  it("walks a playlist in order", () => {
    const a = { ...film, id: "a", duration_seconds: 600 }, b = { ...film, id: "b", duration_seconds: 600 };
    const p = pickWebProgramme({ entries: [{ ...slot, media_id: null, playlist_id: "p1" }], media: [a, b], playlists: [{ id: "p1", repeat: true, items: [{ media_id: "a" }, { media_id: "b" }] }] }, at("2026-11-12T11:17:00Z"));
    expect([p?.media.id, p?.offset]).toEqual(["b", 300]);
  });
});
