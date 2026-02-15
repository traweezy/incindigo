import { useForm } from "@tanstack/react-form";
import { KeyRound, MailCheck } from "lucide-react";
import { memo, useCallback, useMemo, useState, type FC, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { startMagicLink } from "@/features/auth/api/auth-api";
import { Button } from "@/shared/components/primitives/button";
import { Card } from "@/shared/components/primitives/card";
import { Field } from "@/shared/components/primitives/field";
import { Input } from "@/shared/components/primitives/input";

type AuthFormValues = {
  email: string;
};

const authFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").min(5).max(320)
});

const AuthPageComponent: FC = () => {
  const [searchParams] = useSearchParams();
  const [previewLink, setPreviewLink] = useState<string | null>(null);

  const nextPath = useMemo(() => searchParams.get("next") ?? "/", [searchParams]);
  const verifyPath = useMemo(() => {
    if (!previewLink) {
      return null;
    }

    try {
      const url = new URL(previewLink);
      const token = url.searchParams.get("token");
      if (!token) {
        return null;
      }
      const next = encodeURIComponent(nextPath);
      return `/auth/verify?token=${encodeURIComponent(token)}&next=${next}`;
    } catch {
      return null;
    }
  }, [nextPath, previewLink]);

  const form = useForm({
    defaultValues: {
      email: ""
    } satisfies AuthFormValues,
    onSubmit: async ({ value }) => {
      const input = authFormSchema.parse(value);
      const result = await startMagicLink({ email: input.email });
      setPreviewLink(result.preview);
    }
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      void form.handleSubmit();
    },
    [form]
  );

  return (
    <section className="mx-auto w-full max-w-xl space-y-6 py-8">
      <Card className="space-y-3 border-indigo-300/40 bg-gradient-to-r from-indigo-950/65 via-slate-900 to-slate-900">
        <p className="font-mono text-xs tracking-[0.2em] text-indigo-300 uppercase">Authentication</p>
        <h1 className="font-display text-3xl font-semibold text-slate-50">Sign in with magic link</h1>
        <p className="text-sm text-slate-300">
          Enter your email and verify with the generated link to access the incident command deck.
        </p>
      </Card>

      <Card className="space-y-4 border-slate-700/90 bg-slate-900/70">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <form.Field
            name="email"
            validators={{
              onBlur: ({ value }) => {
                const parsed = authFormSchema.shape.email.safeParse(value);
                return parsed.success ? undefined : (parsed.error.issues[0]?.message ?? "Invalid email");
              }
            }}
          >
            {(field) => {
              const error = field.state.meta.errors[0] as string | undefined;
              return (
                <Field label="Email" htmlFor="email" error={error}>
                  <Input
                    id="email"
                    autoComplete="email"
                    name={field.name}
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                  />
                </Field>
              );
            }}
          </form.Field>

          <Button type="submit" className="w-full justify-center">
            <MailCheck className="size-4" />
            Send Magic Link
          </Button>
        </form>

        {previewLink ? (
          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs font-medium text-slate-200">Magic link preview (local/dev)</p>
            <p className="break-all text-xs text-slate-400">{previewLink}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={verifyPath ?? "/auth/verify"}>
                  <KeyRound className="size-4" />
                  Verify Now
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <a href={previewLink} target="_blank" rel="noreferrer">
                  Open Raw Link
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-slate-500">
          Protected route requested: <span className="font-mono text-slate-300">{nextPath}</span>
        </p>
      </Card>
    </section>
  );
};

export const AuthPage = memo(AuthPageComponent);
