import { z } from "zod";

export const startMagicLinkInputSchema = z.object({
  email: z.string().trim().email().min(5).max(320)
});

export const startMagicLinkResponseSchema = z.object({
  message: z.string(),
  preview: z.string().url(),
  expires: z.string()
});

export const verifyMagicLinkInputSchema = z.object({
  token: z.string().min(20)
});

export const verifyMagicLinkResponseSchema = z.object({
  authenticated: z.boolean(),
  email: z.string().trim().email(),
  session_token: z.string().min(20)
});

export type StartMagicLinkInput = z.infer<typeof startMagicLinkInputSchema>;
export type StartMagicLinkResponse = z.infer<typeof startMagicLinkResponseSchema>;
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkInputSchema>;
export type VerifyMagicLinkResponse = z.infer<typeof verifyMagicLinkResponseSchema>;
