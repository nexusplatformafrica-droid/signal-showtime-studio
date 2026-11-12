import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { AppRole, Capability } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import type { Channel } from "@/hooks/use-station";

export interface StationContextValue {
  user: User;
  roles: AppRole[];
  channel: Channel;
  can: (cap: Capability) => boolean;
}

const Ctx = createContext<StationContextValue | null>(null);

export function StationProvider({ value, children }: { value: Omit<StationContextValue, "can">; children: React.ReactNode }) {
  return <Ctx.Provider value={{ ...value, can: (cap) => can(value.roles, cap) }}>{children}</Ctx.Provider>;
}

export function useStation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStation must be used inside the admin layout");
  return v;
}
