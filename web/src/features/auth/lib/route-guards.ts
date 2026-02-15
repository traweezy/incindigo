import { redirect, type LoaderFunctionArgs } from "react-router-dom";
import { isAuthenticated } from "@/features/auth/lib/auth-session";

export const requireAuthLoader = ({ request }: LoaderFunctionArgs) => {
  if (isAuthenticated()) {
    return null;
  }

  const current = new URL(request.url);
  const nextPath = `${current.pathname}${current.search}`;
  const redirectTo = `/auth?next=${encodeURIComponent(nextPath)}`;
  return redirect(redirectTo);
};

export const redirectAuthedLoader = ({ request }: LoaderFunctionArgs) => {
  if (!isAuthenticated()) {
    return null;
  }

  const current = new URL(request.url);
  const nextPath = current.searchParams.get("next");
  if (nextPath) {
    return redirect(nextPath);
  }

  return redirect("/");
};
