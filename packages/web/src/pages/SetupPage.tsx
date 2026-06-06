import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, Field, InlineNotice, TextInput } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import { useBootstrapQuery, useCreatePasswordMutation } from "../lib/queries";
import { routes } from "../lib/routes";
import { Link } from "react-router-dom";

export function SetupPage() {
  const bootstrapQuery = useBootstrapQuery();
  const createPasswordMutation = useCreatePasswordMutation();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const callbackError = searchParams.get("error") ?? searchParams.get("reason");
  const setupStatus = bootstrapQuery.data?.setupStatus ?? {
    passwordSet: false,
    setupComplete: false,
    spotifyConnected: false,
  };

  const currentStep = useMemo(() => {
    if (!setupStatus.passwordSet) return 1;
    if (!setupStatus.spotifyConnected) return 2;
    return 3;
  }, [setupStatus.passwordSet, setupStatus.spotifyConnected]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createPasswordMutation.mutateAsync(password);
      setPassword("");
    } catch {
      return;
    }
  }

  const createPasswordError =
    createPasswordMutation.error instanceof ApiError
      ? createPasswordMutation.error.message
      : createPasswordMutation.error
        ? getErrorMessage(createPasswordMutation.error, "Unable to save the password right now.")
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-base) px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to={routes.home} className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--accent)">
              <span className="text-lg font-bold text-black">S</span>
            </div>
          </Link>
          <h1 className="mt-6 text-3xl font-bold">Set up Spot Hist</h1>
          <p className="mt-2 text-sm text-(--text-secondary)">
            Step {currentStep} of 3
          </p>
        </div>

        {!setupStatus.passwordSet ? (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-bold">Create the local password</h2>
              <p className="mt-1 text-sm text-(--text-secondary)">
                This protects your tracker on your local network.
              </p>
            </div>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <Field label="Password" hint="Stored as a bcrypt hash on the server.">
                <TextInput
                  required
                  type="password"
                  minLength={4}
                  value={password}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                  placeholder="Choose a password"
                />
              </Field>
              {createPasswordError ? <InlineNotice tone="error">{createPasswordError}</InlineNotice> : null}
              <Button disabled={createPasswordMutation.isPending || password.length < 4} type="submit">
                {createPasswordMutation.isPending ? "Saving..." : "Continue"}
              </Button>
            </form>
          </div>
        ) : !setupStatus.spotifyConnected ? (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-bold">Connect Spotify</h2>
              <p className="mt-1 text-sm text-(--text-secondary)">
                Authorize the tracker to read your recent listening history.
              </p>
            </div>
            <p className="text-xs text-(--text-subdued) text-center">
              Required scopes: <span className="font-medium text-(--text-primary)">user-read-recently-played</span>,{" "}
              <span className="font-medium text-(--text-primary)">user-read-email</span>
            </p>
            {callbackError ? <InlineNotice tone="error">Connection failed: {callbackError}</InlineNotice> : null}
            <Button onClick={() => api.startSpotifyLogin()}>Connect Spotify</Button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <h2 className="text-lg font-bold">Almost done</h2>
            <p className="text-sm text-(--text-secondary)">
              Spotify is connected. Complete the callback flow to finish setup.
            </p>
            <Button kind="secondary" onClick={() => void bootstrapQuery.refetch()}>
              {bootstrapQuery.isFetching ? "Checking..." : "Refresh status"}
            </Button>
          </div>
        )}

        {/* Steps indicator */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                step <= currentStep ? "bg-(--accent)" : "bg-(--bg-tinted)"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
