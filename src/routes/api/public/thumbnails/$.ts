import { createFileRoute } from "@tanstack/react-router";

// Serves programme thumbnails and channel logos from private storage. Paths are random UUIDs.
const SAFE = /^(?:(?:logos|brand)\/)?[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const Route = createFileRoute("/api/public/thumbnails/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!SAFE.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("media-thumbnails").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const type = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
        return new Response(data, { headers: { "content-type": type, "cache-control": "public, max-age=86400" } });
      },
    },
  },
});
