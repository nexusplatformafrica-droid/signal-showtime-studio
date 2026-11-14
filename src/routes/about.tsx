import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarRange, Clapperboard, Globe2, Play, Radio, Tv } from "lucide-react";
import { publicStationQuery } from "@/components/public/station-query";
import { PublicShell } from "@/components/public/PublicChrome";
import { SITE_NAME } from "@/components/brand/Wordmark";
import { useNow } from "@/hooks/use-station";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { isEngineOnline, isOnAir } from "@/lib/broadcast";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About MOVIE MAX TV" },
      { name: "description", content: "MOVIE MAX TV is a 24/7 television channel from Kampala showing premium movies, series and entertainment." },
      { property: "og:title", content: "About MOVIE MAX TV" },
      { property: "og:description", content: "A 24/7 television channel from Kampala showing premium movies, series and entertainment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStationQuery()),
  component: About,
});

const FACTS = [
  { icon: Radio, title: "On 24 hours a day", text: "Our channel never stops — programmes run day and night, every day of the week." },
  { icon: Clapperboard, title: "Movies and series", text: "Premium movies, series, music and entertainment, chosen by our team." },
  { icon: Globe2, title: "From Kampala", text: "Broadcasting on East Africa Time, so the guide always matches your clock." },
  { icon: Tv, title: "Watch anywhere", text: "Open the website on your phone, computer or smart TV — no app needed." },
];

function About() {
  const { data } = useSuspenseQuery(publicStationQuery());
  const now = useNow(1000);
  const ch = data.channel;
  const onAir = now != null && isOnAir(data.status, now);
  const online = now != null && isEngineOnline(data.status, now);
  const { pick } = useWebPlayout(now);
  return (
    <PublicShell onAir={onAir} engineOnline={online} webLive={!onAir && !!pick} description={ch?.description}>
      <main className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
        <section className="neon-frame neon-glow rounded-2xl [--glow:var(--neon-purple)]">
          <div className="rounded-[14px] bg-panel p-6 md:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-neon-pink">About us</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-wide md:text-5xl"><span className="text-logo-gradient">{SITE_NAME}</span></h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {ch?.description ?? "Premium movies, series and entertainment, live 24 hours a day."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/watch" className="inline-flex h-10 items-center gap-2 rounded-full bg-neon-pink px-5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground hover:brightness-110"><Play className="size-4 fill-current" />Watch live</Link>
              <Link to="/guide" className="pill-gold inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-extrabold uppercase tracking-wide hover:brightness-105"><CalendarRange className="size-4" />TV guide</Link>
            </div>
          </div>
        </section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {FACTS.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/70 bg-panel p-5">
              <f.icon className="size-6 text-neon-blue" />
              <h2 className="mt-3 text-lg font-extrabold uppercase tracking-wide">{f.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </PublicShell>
  );
}
