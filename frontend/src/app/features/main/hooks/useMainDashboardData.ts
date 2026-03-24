import { useQuery } from "@tanstack/react-query";

import {
  getAboutContent,
  listActivityFeed,
  listNotificationFeed
} from "../../../../lib/api/client";

export function useMainDashboardData(authenticated: boolean) {
  const aboutQuery = useQuery({
    queryKey: ["about-content"],
    queryFn: getAboutContent,
    enabled: authenticated
  });

  const mainActivityQuery = useQuery({
    queryKey: ["activity-feed", "main"],
    queryFn: () => listActivityFeed({ period: "7d", limit: 5 }),
    enabled: authenticated,
    refetchInterval: 30000
  });

  const mainNotificationQuery = useQuery({
    queryKey: ["notification-feed", "main"],
    queryFn: () => listNotificationFeed({ period: "7d", limit: 5 }),
    enabled: authenticated,
    refetchInterval: 30000
  });

  return {
    aboutQuery,
    mainActivityQuery,
    mainNotificationQuery
  };
}
