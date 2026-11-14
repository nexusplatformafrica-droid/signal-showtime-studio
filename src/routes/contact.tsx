import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Clock, Mail, MapPin, Play } from "lucide-react";
import { publicStationQuery } from "@/components/public/station-query";
import { PublicShell } from "@/components/public/PublicChrome";
import { useNow } from "@/hooks/use-station";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { formatClock, isEngineOnline, isOnAir } from "@/lib/broadcast";

const CONTACT_EMAIL = "mainplatform.nexus@gmail.com";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact MOVIE MAX TV" },
      { name: "description", content: "Get in touch with MOVIE MAX TV in Kampala for programmes, advertising and partnerships." },
      { property: "og:title", content: "Contact MOVIE MAX TV" },
      { property: "og:description", content: "Get in touch with MOVIE MAX TV for programmes, advertising and partnerships." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStationQuery()),
  component: Contact,
});

function Contact() {
  const { data } = useSuspenseQuery(publicStationQuery());
  const now = useNow(1000);
  const ch = data.channel;
  const tz = ch?.timezone ?? "Africa/Kampala";
  const onAir = now != null && isOnAir(data.status, now);
  const online = now != null && isEngineOnline(data.status, now);
  const { pick } = useWebPlayout(now);
  const cards = [
    { icon: Mail, title: "Email us", body: <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-foreground hover:text-neon-pink">{CONTACT_EMAIL}</a> },
    { icon: MapPin, title: "Where we are", body: <span>Kampala, Uganda</span> },
    { icon: Clock, title: "Station time", body: <span className="timecode">{now ? formatClock(now, tz).slice(0, 5) : "--:--"} EAT · on air 24/7</span> },
  ];
  return (
    <PublicShell onAir={onAir} engineOnline={online} webLive={!onAir && !!pick} description={ch?.description}>
      <main className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
        <section className="neon-frame neon-glow rounded-2xl [--glow:var(--neon-blue)]">
          <div className="rounded-[14px] bg-panel p-6 md:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-neon-pink">Contact</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-wide md:text-5xl">Talk to <span className="text-logo-gradient">MOVIE MAX TV</span></h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Questions about a programme, advertising on our channel or working with us? Send us a message and our team will reply.
            </p>
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Hello MOVIE MAX TV")}`} className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-neon-pink px-5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground hover:brightness-110"><Mail className="size-4" />Send an email</a>
          </div>
        </section>
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border/70 bg-panel p-5 text-sm text-muted-foreground">
              <c.icon className="size-6 text-neon-blue" />
              <h2 className="mt-3 mb-1 text-base font-extrabold uppercase tracking-wide text-foreground">{c.title}</h2>
              {c.body}
            </div>
          ))}
        </section>
        <div className="mt-6 flex justify-center">
          <Link to="/watch" className="inline-flex h-10 items-center gap-2 rounded-full bg-neon-blue px-5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground hover:brightness-110"><Play className="size-4 fill-current" />Watch live now</Link>
        </div>
      </main>
    </PublicShell>
  );
}
