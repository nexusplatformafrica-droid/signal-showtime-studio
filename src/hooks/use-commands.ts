import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/db";
import type { Database, Json } from "@/lib/db-types";
import { useStation } from "@/components/admin/station-context";

export type CommandType = Database["public"]["Enums"]["command_type"];

export const COMMAND_LABELS: Record<CommandType, string> = {
  play: "Play",
  pause: "Pause",
  stop: "Stop",
  skip: "Skip",
  take_live: "Take live",
  end_live: "End live",
  return_to_schedule: "Return to automation",
  emergency_takeover: "Emergency takeover",
  play_standby: "Play standby",
  switch_source: "Switch source",
  reload_schedule: "Reload schedule",
};

/** Queue a command for the playout engine. The engine claims, executes and reports the result. */
export function useIssueCommand() {
  const { channel, user } = useStation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ command, payload = {} }: { command: CommandType; payload?: Record<string, Json> }) => {
      const { error } = await db.from("broadcast_commands").insert({ channel_id: channel.id, command, payload, issued_by: user.id });
      if (error) throw new Error(error.code === "permission-denied" ? "Your role is not allowed to issue this command." : error.message);
      return command;
    },
    onSuccess: (command) => {
      toast.success(`${COMMAND_LABELS[command]} sent to playout engine`, { description: "Waiting for the engine to confirm execution." });
      qc.invalidateQueries({ queryKey: ["commands", channel.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
