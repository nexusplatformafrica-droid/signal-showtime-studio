import { createFileRoute } from "@tanstack/react-router";
import { ScheduledPlayer } from "@/components/broadcast/ScheduledPlayer";
import { LiveGraphics } from "@/components/broadcast/LiveGraphics";
import { useWebPlayout } from "@/hooks/use-web-playout";
import slate from "@/assets/standby-slate.jpg";

/**
 * Clean programme output (picture + graphics, sound on, no buttons) for OBS "Browser" source.
 * OBS sends this to Wowza, so the Wowza stream carries exactly what the website shows.
 */
export const Route = createFileRoute("/output")({
  head: () => ({
    meta: [
      { title: "MOVIE MAX — Programme output" },
      { name: "description", content: "Full-screen MOVIE MAX programme output with on-screen graphics, for broadcasting software." },
      { property: "og:title", content: "MOVIE MAX — Programme output" },
      { property: "og:description", content: "Full-screen MOVIE MAX programme output with on-screen graphics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Output,
});

function Output() {
  const { web } = useWebPlayout(null);
  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-inset">
      <div className="relative aspect-video w-[min(100vw,calc(100vh*16/9))]">
        <ScheduledPlayer
          bundle={web?.bundle}
          skewMs={web?.skewMs ?? 0}
          poster={slate}
          controls={false}
          muted={false}
          clickForSound
          offlineLabel={<div className="wordmark text-[4cqw]">MOVIE MAX</div>}
        >
          <LiveGraphics bundle={web?.bundle} skewMs={web?.skewMs ?? 0} />
        </ScheduledPlayer>
      </div>
    </div>
  );
}
