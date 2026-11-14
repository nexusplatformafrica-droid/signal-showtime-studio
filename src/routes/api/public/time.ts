import { createFileRoute } from "@tanstack/react-router";

/** Real current time from the server, so screens never trust a wrong device clock. Public and harmless. */
export const Route = createFileRoute("/api/public/time")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ now: Date.now() }), {
          headers: { "content-type": "application/json", "cache-control": "no-store, max-age=0", "access-control-allow-origin": "*" },
        }),
    },
  },
});
