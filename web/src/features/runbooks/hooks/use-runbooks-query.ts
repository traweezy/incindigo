import { useQuery } from "@tanstack/react-query";
import { fetchRunbooks, runbookQueryKey } from "@/features/runbooks/api/runbooks-api";

export const useRunbooksQuery = () => {
  return useQuery({
    queryFn: fetchRunbooks,
    queryKey: runbookQueryKey,
    refetchInterval: 30_000
  });
};

