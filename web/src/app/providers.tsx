import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { memo, useMemo, type FC, type PropsWithChildren } from "react";
import { Toaster } from "sonner";

const AppProvidersComponent: FC<PropsWithChildren> = ({ children }) => {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 1
          }
        }
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-xl border border-indigo-300/40 bg-slate-900 text-slate-100"
          }
        }}
      />
    </QueryClientProvider>
  );
};

export const AppProviders = memo(AppProvidersComponent);
