import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  station_manager: "Station Manager",
  broadcast_operator: "Broadcast Operator",
  media_manager: "Media Manager",
  graphics_designer: "Graphics Designer",
  advertising_manager: "Advertising Manager",
  analyst: "Analyst",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

/**
 * UI capability map. The database policies enforce the same rules server-side;
 * this map only decides which controls are shown as enabled.
 */
export const CAPABILITIES = {
  control: ["super_admin", "station_manager", "broadcast_operator"],
  emergency: ["super_admin", "station_manager"],
  media: ["super_admin", "station_manager", "media_manager", "advertising_manager"],
  schedule: ["super_admin", "station_manager", "advertising_manager"],
  playlists: ["super_admin", "station_manager", "media_manager", "advertising_manager"],
  graphics: ["super_admin", "station_manager", "graphics_designer"],
  live: ["super_admin", "station_manager", "broadcast_operator"],
  settings: ["super_admin", "station_manager"],
  users: ["super_admin"],
  engine: ["super_admin"],
  audit: ["super_admin", "station_manager"],
  endpoints: ["super_admin", "station_manager", "broadcast_operator"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(roles: readonly AppRole[] | null | undefined, cap: Capability) {
  if (!roles?.length) return false;
  return roles.some((r) => (CAPABILITIES[cap] as readonly AppRole[]).includes(r));
}
