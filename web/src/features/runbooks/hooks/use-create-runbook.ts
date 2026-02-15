import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRunbook, runbookQueryKey } from "@/features/runbooks/api/runbooks-api";
import type { CreateRunbookInput, Runbook } from "@/features/runbooks/schemas/runbook-schemas";

export const useCreateRunbook = () => {
  const queryClient = useQueryClient();

  return useMutation<Runbook, Error, CreateRunbookInput>({
    mutationFn: createRunbook,
    onSuccess: (created) => {
      queryClient.setQueryData<Runbook[]>(runbookQueryKey, (current = []) => {
        return [created, ...current];
      });
      toast.success("Runbook created");
    },
    onError: () => {
      toast.error("Failed to create runbook");
    }
  });
};
