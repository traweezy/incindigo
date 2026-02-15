import {
  startMagicLinkInputSchema,
  startMagicLinkResponseSchema,
  verifyMagicLinkInputSchema,
  verifyMagicLinkResponseSchema,
  type StartMagicLinkInput,
  type StartMagicLinkResponse,
  type VerifyMagicLinkInput,
  type VerifyMagicLinkResponse
} from "@/features/auth/schemas/auth-schemas";
import { toAPIURL } from "@/shared/lib/net/api-url";
import { fetchJson } from "@/shared/lib/net/fetch-json";

export const startMagicLink = async (
  input: StartMagicLinkInput
): Promise<StartMagicLinkResponse> => {
  const request = startMagicLinkInputSchema.parse(input);
  const payload = await fetchJson<unknown>(toAPIURL("/api/v1/auth/magic-link/start"), {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  return startMagicLinkResponseSchema.parse(payload);
};

export const verifyMagicLink = async (
  input: VerifyMagicLinkInput
): Promise<VerifyMagicLinkResponse> => {
  const request = verifyMagicLinkInputSchema.parse(input);
  const payload = await fetchJson<unknown>(toAPIURL("/api/v1/auth/magic-link/verify"), {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  return verifyMagicLinkResponseSchema.parse(payload);
};
