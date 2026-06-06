import type { ReactNode } from "react";
import { Component, createElement, Fragment } from "react";
import { render, waitFor } from "@testing-library/react";
import { App } from "../app/App";
import { AppQueryProvider, createAppQueryClient } from "../lib/query-client";

type MockResponse = {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
};

type MockHandler =
  | MockResponse
  | MockResponse[]
  | ((request: MockRequest) => MockResponse | Promise<MockResponse>);

type QueryClientInstance = {
  clear?: () => void;
};

export type MockRequest = {
  method: string;
  url: string;
  key: string;
  bodyText: string | null;
};

const activeQueryClients = new Set<QueryClientInstance>();

class TestErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div data-testid="test-harness-error">{this.state.error.message}</div>;
    }

    return this.props.children;
  }
}

function jsonResponse({ status = 200, body, headers = {} }: MockResponse): Response {
  const normalizedHeaders = new Headers(headers);

  if (body !== undefined && !normalizedHeaders.has("content-type")) {
    normalizedHeaders.set("content-type", "application/json");
  }

  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: normalizedHeaders,
  });
}

async function renderWithProviders(route: string) {
  window.history.pushState({}, "", route);
  const appElement = (
    <TestErrorBoundary>
      <App />
    </TestErrorBoundary>
  );
  const queryClient = createAppQueryClient();

  activeQueryClients.add(queryClient);

  return render(
    <AppQueryProvider client={queryClient}>
      <Fragment>{appElement}</Fragment>
    </AppQueryProvider>,
  );
}

async function readBodyText(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.body == null) {
    return null;
  }

  if (typeof init.body === "string") {
    return init.body;
  }

  if (init.body instanceof URLSearchParams) {
    return init.body.toString();
  }

  if (init.body instanceof Blob) {
    return await init.body.text();
  }

  if (init.body instanceof FormData) {
    const fields = Array.from(init.body.entries()).map(([key, value]) => [
      key,
      typeof value === "string" ? value : value.name,
    ]);

    return JSON.stringify(fields);
  }

  if (input instanceof Request) {
    return input.clone().text();
  }

  return null;
}

export function installFetchMock(routes: Record<string, MockHandler>) {
  const counters = new Map<string, number>();
  const calls: MockRequest[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const key = `${method} ${url.pathname}${url.search}`;
      const handler = routes[key];

      if (!handler) {
        throw new Error(`No mock response configured for ${key}`);
      }

      const request = {
        method,
        url: `${url.pathname}${url.search}`,
        key,
        bodyText: await readBodyText(input, init),
      };
      calls.push(request);

      if (typeof handler === "function") {
        return jsonResponse(await handler(request));
      }

      const queue = Array.isArray(handler) ? handler : [handler];
      const index = counters.get(key) ?? 0;
      counters.set(key, index + 1);

      return jsonResponse(queue[Math.min(index, queue.length - 1)]);
    }),
  );

  return {
    calls,
    count(key: string) {
      return calls.filter((call) => call.key === key).length;
    },
  };
}

export async function renderApp(route = "/") {
  return renderWithProviders(route);
}

export async function waitForPathname(pathname: string) {
  await waitFor(() => {
    expect(window.location.pathname).toBe(pathname);
  });
}

export function clearTestHarnessState() {
  for (const queryClient of activeQueryClients) {
    queryClient.clear?.();
  }

  activeQueryClients.clear();
  window.history.pushState({}, "", "/");
}
