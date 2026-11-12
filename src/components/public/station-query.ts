import { queryOptions } from "@tanstack/react-query";
import { getPublicStation } from "@/lib/public.functions";

export const publicStationQuery = () =>
  queryOptions({
    queryKey: ["public-station"],
    queryFn: () => getPublicStation(),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

export type PublicStation = Awaited<ReturnType<typeof getPublicStation>>;
export type PublicProgramme = PublicStation["schedule"][number];
