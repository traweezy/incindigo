import { useForm } from "@tanstack/react-form";
import { CheckCircle2, KeyRound } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type FormEvent
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { verifyMagicLink } from "@/features/auth/api/auth-api";
import { setAuthSession } from "@/features/auth/lib/auth-session";
import { Button } from "@/shared/components/primitives/button";
import { Card } from "@/shared/components/primitives/card";
import { Field } from "@/shared/components/primitives/field";
import { Input } from "@/shared/components/primitives/input";

type VerifyFormValues = {
  token: string;
};

const tokenSchema = z.string().trim().min(20, "Token must be at least 20 characters.");

const AuthVerifyPageComponent: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptedTokenRef = useRef<string | null>(null);

  const tokenFromQuery = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const nextPath = useMemo(() => searchParams.get("next") ?? "/", [searchParams]);

  const verifyAndSignIn = useCallback(
    async (rawToken: string) => {
      const token = tokenSchema.parse(rawToken);
      setVerifying(true);
      setErrorMessage(null);

      try {
        const result = await verifyMagicLink({ token });
        setAuthSession({
          authenticatedAt: new Date().toISOString(),
          email: result.email,
          sessionToken: result.session_token
        });
        toast.success("Authenticated successfully.");
        void navigate(nextPath, { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Verification failed";
        setErrorMessage(message);
      } finally {
        setVerifying(false);
      }
    },
    [navigate, nextPath]
  );

  useEffect(() => {
    if (!tokenFromQuery || attemptedTokenRef.current === tokenFromQuery) {
      return;
    }

    attemptedTokenRef.current = tokenFromQuery;
    void verifyAndSignIn(tokenFromQuery);
  }, [tokenFromQuery, verifyAndSignIn]);

  const form = useForm({
    defaultValues: {
      token: tokenFromQuery
    } satisfies VerifyFormValues,
    onSubmit: async ({ value }) => {
      await verifyAndSignIn(value.token);
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
        <h1 className="font-display text-3xl font-semibold text-slate-50">Verify magic link</h1>
        <p className="text-sm text-slate-300">
          Complete verification to unlock the live board, analytics, and runbooks.
        </p>
      </Card>

      <Card className="space-y-4 border-slate-700/90 bg-slate-900/70">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <form.Field
            name="token"
            validators={{
              onBlur: ({ value }) => {
                const parsed = tokenSchema.safeParse(value);
                return parsed.success ? undefined : (parsed.error.issues[0]?.message ?? "Invalid token");
              }
            }}
          >
            {(field) => {
              const error = field.state.meta.errors[0] as string | undefined;
              return (
                <Field label="Token" htmlFor="token" error={error}>
                  <Input
                    id="token"
                    autoComplete="off"
                    name={field.name}
                    placeholder="Paste token from magic link"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                  />
                </Field>
              );
            }}
          </form.Field>

          <Button type="submit" className="w-full justify-center" disabled={isVerifying}>
            <KeyRound className="size-4" />
            {isVerifying ? "Verifying..." : "Verify and Sign In"}
          </Button>
        </form>

        {errorMessage ? (
          <p className="text-sm text-rose-300">Verification failed: {errorMessage}</p>
        ) : tokenFromQuery ? (
          <p className="inline-flex items-center gap-2 text-sm text-emerald-200">
            <CheckCircle2 className="size-4" />
            Token detected in URL. Verifying automatically...
          </p>
        ) : null}

        <Button asChild variant="secondary" size="sm">
          <Link to={`/auth?next=${encodeURIComponent(nextPath)}`}>Back to email entry</Link>
        </Button>
      </Card>
    </section>
  );
};

export const AuthVerifyPage = memo(AuthVerifyPageComponent);
