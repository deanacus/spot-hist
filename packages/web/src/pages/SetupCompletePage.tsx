import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, InlineNotice } from "../components/Ui";
import { getHomeRoute, useBootstrapQuery } from "../lib/queries";
import { routes } from "../lib/routes";

export function SetupCompletePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bootstrapQuery = useBootstrapQuery();
  const { refetch, isFetching } = bootstrapQuery;
  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!success) {
      return;
    }

    let active = true;

    void (async () => {
      setChecking(true);
      const nextState = await refetch();
      if (!active) {
        return;
      }

      setChecking(false);

      if (nextState.data) {
        navigate(getHomeRoute(nextState.data), { replace: true });
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate, refetch, success]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-base) px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <Link to={routes.home} className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--accent)">
              <span className="text-lg font-bold text-black">S</span>
            </div>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">Connection confirmation</h1>
          <p className="mt-2 text-sm text-(--text-secondary)">
            Validating the callback result.
          </p>
        </div>

        <div className="space-y-4">
          {success ? (
            <InlineNotice tone="success">
              Spotify connected. {checking ? "Checking state..." : "Ready to proceed."}
            </InlineNotice>
          ) : null}
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          {!success && !error ? (
            <InlineNotice>Return here after the OAuth callback to verify setup.</InlineNotice>
          ) : null}

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => { void refetch(); }}>
              {isFetching ? "Refreshing..." : "Refresh status"}
            </Button>
            <Link
              to={routes.login}
              className="inline-flex items-center justify-center rounded-full border border-(--border-strong) px-5 py-3 text-sm font-semibold text-(--text-primary) transition hover:bg-(--bg-hover)"
            >
              Go to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
