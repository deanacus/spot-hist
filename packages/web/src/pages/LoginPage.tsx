import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { ApiError } from '../lib/api';
import { Button, Field, InlineNotice, TextInput } from '../components/Ui';
import { getErrorMessage } from '../lib/errors';
import { useBootstrapQuery, useLoginMutation } from '../lib/queries';
import { routes } from '../lib/routes';
import { Link } from 'react-router-dom';

export function LoginPage() {
  const bootstrapQuery = useBootstrapQuery();
  const loginMutation = useLoginMutation();
  const [password, setPassword] = useState('');
  const setupStatus = bootstrapQuery.data?.setupStatus ?? {
    passwordSet: false,
    setupComplete: false,
    spotifyConnected: false,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await loginMutation.mutateAsync(password);
      setPassword('');
    } catch {
      return;
    }
  }

  const error =
    loginMutation.error instanceof ApiError && loginMutation.error.status === 401
      ? 'Invalid password. Try again.'
      : loginMutation.error instanceof ApiError
        ? loginMutation.error.message
        : loginMutation.error
          ? getErrorMessage(loginMutation.error, 'Unable to create a session right now.')
          : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-base) px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link to={routes.home} className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--accent)">
              <span className="text-lg font-bold text-black">S</span>
            </div>
          </Link>
          <h1 className="mt-6 text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-(--text-secondary)">
            {setupStatus.spotifyConnected
              ? 'Enter your password to continue.'
              : 'Enter your password. Spotify needs reconnecting after login.'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Password">
            <TextInput
              required
              type="password"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              placeholder="Your password"
            />
          </Field>
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <Button disabled={loginMutation.isPending || password.length === 0} type="submit">
              {loginMutation.isPending ? 'Checking...' : 'Login'}
            </Button>
        </form>
      </div>
    </div>
  );
}
