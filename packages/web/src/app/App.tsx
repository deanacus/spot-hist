import type { ReactNode } from "react";
import { useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LoadingView } from "../components/Ui";
import type { BootstrapData } from "../lib/queries";
import { getHomeRoute, useBootstrapQuery } from "../lib/queries";
import { pagedRouteSuffix, routes } from "../lib/routes";
import { AlbumDetailPage } from "../pages/AlbumDetailPage";
import { ArtistDetailPage } from "../pages/ArtistDetailPage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ReportsPage } from "../pages/ReportsPage";
import { ScrobblesPage } from "../pages/ScrobblesPage";
import {
  AlbumScrobblesPage,
  ArtistScrobblesPage,
  TrackScrobblesPage,
} from "../pages/ScopedScrobblesPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SetupCompletePage } from "../pages/SetupCompletePage";
import { SetupPage } from "../pages/SetupPage";
import { TrackDetailPage } from "../pages/TrackDetailPage";
import { TopAlbumsPage } from "../pages/TopAlbumsPage";
import { TopArtistsPage } from "../pages/TopArtistsPage";
import { TopTracksPage } from "../pages/TopTracksPage";

function ProtectedRoute({
  bootstrap,
  children,
}: {
  bootstrap: BootstrapData;
  children: ReactNode;
}) {
  const location = useLocation();

  if (!bootstrap.setupStatus.passwordSet || !bootstrap.setupStatus.spotifyConnected || !bootstrap.setupStatus.setupComplete) {
    return <Navigate replace to={routes.setup} state={{ from: location.pathname }} />;
  }

  if (!bootstrap.appStatus) {
    return <Navigate replace to={routes.login} state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function SetupRoute({
  bootstrap,
  children,
}: {
  bootstrap: BootstrapData;
  children: ReactNode;
}) {
  if (
    bootstrap.setupStatus.passwordSet &&
    bootstrap.setupStatus.spotifyConnected &&
    bootstrap.setupStatus.setupComplete
  ) {
    return <Navigate replace to={bootstrap.appStatus ? routes.home : routes.login} />;
  }

  return <>{children}</>;
}

function LoginRoute({
  bootstrap,
  children,
}: {
  bootstrap: BootstrapData;
  children: ReactNode;
}) {
  if (
    !bootstrap.setupStatus.passwordSet ||
    !bootstrap.setupStatus.spotifyConnected ||
    !bootstrap.setupStatus.setupComplete
  ) {
    return <Navigate replace to={routes.setup} />;
  }

  if (bootstrap.appStatus) {
    return <Navigate replace to={routes.home} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const bootstrapQuery = useBootstrapQuery();
  const bootstrap = bootstrapQuery.data;
  const home = useMemo(() => (bootstrap ? getHomeRoute(bootstrap) : routes.setup), [bootstrap]);

  if (bootstrapQuery.isPending || !bootstrap) {
    return <LoadingView label="Checking setup and session state..." />;
  }

  return (
    <Routes>
      <Route
        path={routes.root}
        element={<Navigate replace to={home} />}
      />
      <Route
        path={routes.setup}
        element={
          <SetupRoute bootstrap={bootstrap}>
            <SetupPage />
          </SetupRoute>
        }
      />
      <Route path={routes.setupComplete} element={<SetupCompletePage />} />
      <Route
        path={routes.login}
        element={
          <LoginRoute bootstrap={bootstrap}>
            <LoginPage />
          </LoginRoute>
        }
      />
      <Route
        path={routes.home}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.scrobbles}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <ScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.reports}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.scrobbles}/${pagedRouteSuffix}`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <ScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.settings}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.artists}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TopArtistsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.artists}/${pagedRouteSuffix}`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TopArtistsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.albums}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TopAlbumsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.albums}/${pagedRouteSuffix}`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TopAlbumsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.tracks}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TopTracksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.tracks}/${pagedRouteSuffix}`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TopTracksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.artists}/:id`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <ArtistDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.artists}/:id/scrobbles`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <ArtistScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.artists}/:id/scrobbles/${pagedRouteSuffix}`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <ArtistScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.albums}/:id`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <AlbumDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.albums}/:id/scrobbles`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <AlbumScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.albums}/:id/scrobbles/${pagedRouteSuffix}`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <AlbumScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.tracks}/:id`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TrackDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.tracks}/:id/scrobbles`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TrackScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${routes.tracks}/:id/scrobbles/${pagedRouteSuffix}`}
        element={
          <ProtectedRoute bootstrap={bootstrap}>
            <TrackScrobblesPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate replace to={home} />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
