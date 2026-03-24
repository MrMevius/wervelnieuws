import { useQuery } from "@tanstack/react-query";

import { listTopics } from "../../../../lib/api/client";

export function usePlanningData(authenticated: boolean) {
  return useQuery({
    queryKey: ["topics"],
    queryFn: listTopics,
    enabled: authenticated
  });
}
