import { useState } from "react";
import { ApiError } from "../lib/api";
import { Shell, Button, InlineNotice } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  useBootstrapQuery,
  useDisconnectAccountMutation,
  useLogoutMutation,
} from "../lib/queries";

export function SettingsPage() {
  const bootstrapQuery = useBootstrapQuery();
  const logoutMutation = useLogoutMutation();
  const disconnectMutation = useDisconnectAccountMutation();
  const [busyAction, setBusyAction] = useState<"logout" | "disconnect" | null>(null);
  const status = bootstrapQuery.data?.appStatus ?? null;

  async function handleLogout() {
    setBusyAction("logout");

    try {
      await logoutMutation.mutateAsync();
    } catch {
      return;
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "Disconnect the Spotify account and return the app to reconnect-required state?",
    );

    if (!confirmed) {
      return;
    }

    setBusyAction("disconnect");

    try {
      await disconnectMutation.mutateAsync();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        return;
      }
    } finally {
      setBusyAction(null);
    }
  }

  const error =
    logoutMutation.error || disconnectMutation.error
      ? getErrorMessage(logoutMutation.error ?? disconnectMutation.error, "Unable to update session state.")
      : null;

  return (
    <Shell title="Settings" subtitle="Manage your tracker">
      <div className="max-w-3xl space-y-8">
        {/* Account section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Connected account</h2>
            <p className="text-sm text-(--text-secondary)">
              {status?.account
                ? "This account is the source for polling and all local analytics."
                : "No Spotify account connected. Reconnect to resume polling."}
            </p>
          </div>

          {status?.account ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Display name</p>
                <p className="mt-1 text-sm font-medium">{status.account.displayName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Spotify ID</p>
                <p className="mt-1 text-sm font-medium">{status.account.spotifyId}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Email</p>
                <p className="mt-1 text-sm font-medium">{status.account.email ?? "Not provided"}</p>
              </div>
            </div>
          ) : null}
        </section>

        {/* System state */}
        <section className="space-y-4 border-t border-(--border-subtle) pt-6">
          <h2 className="text-lg font-bold">System state</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Poller</p>
              <p className="mt-1 text-sm font-medium">{status?.poller.state ?? "idle"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Last poll</p>
              <p className="mt-1 text-sm font-medium">
                {status?.poller.lastPollAt ? new Date(status.poller.lastPollAt).toLocaleString() : "Never"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Last result</p>
              <p className="mt-1 text-sm text-(--text-secondary)">
                {status?.poller.lastPollResult ?? "No result recorded"}
              </p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="space-y-4 border-t border-(--border-subtle) pt-6">
          <div>
            <h2 className="text-lg font-bold">Session</h2>
            <p className="text-sm text-(--text-secondary)">
              End your session or disconnect Spotify entirely.
            </p>
          </div>

          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

          <div className="flex flex-wrap gap-3">
            <Button
              kind="secondary"
              disabled={busyAction !== null}
              onClick={() => void handleLogout()}
            >
              {busyAction === "logout" ? "Logging out..." : "Logout"}
            </Button>
            <Button
              kind="danger"
              disabled={busyAction !== null}
              onClick={() => void handleDisconnect()}
            >
              {busyAction === "disconnect" ? "Disconnecting..." : "Disconnect Spotify"}
            </Button>
          </div>

          <div className="space-y-2 text-sm text-(--text-subdued)">
            <p>Disconnecting stops future polling until Spotify is reconnected.</p>
            <p>Your local password remains in place.</p>
            <p>Previously collected listening history remains in the database.</p>
          </div>
        </section>
      </div>
    </Shell>
  );
}
