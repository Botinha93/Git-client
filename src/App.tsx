/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GiteaService, GiteaConfig, GiteaUser, Repository } from './lib/gitea';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { RepoView } from './components/RepoView';
import { ActivitiesView } from './components/ActivitiesView';
import { EndUserPortalView } from './components/EndUserPortalView';
import { SupportInboxView } from './components/SupportInboxView';
import { Dashboard } from './components/Dashboard';
import { ExploreView } from './components/ExploreView';
import { AccountView } from './components/AccountView';
import { PackagesView } from './components/PackagesView';
import { AdminView } from './components/AdminView';

interface AuthSessionResponse {
  authenticated: boolean;
  giteaConfigured: boolean;
  baseUrl: string | null;
  user?: GiteaUser;
}

export default function App() {
  const [config, setConfig] = useState<GiteaConfig | null>(null);
  const [gitea, setGitea] = useState<GiteaService | null>(null);
  const [user, setUser] = useState<GiteaUser | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [giteaConfigured, setGiteaConfigured] = useState(false);
  const [configuredBaseUrl, setConfiguredBaseUrl] = useState<string | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (config) {
      const service = new GiteaService(config);
      setGitea(service);
      void loadInitialData(service);
    }
  }, [config]);

  const restoreSession = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/gitea/session', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const session = await response.json() as AuthSessionResponse;
      setGiteaConfigured(session.giteaConfigured);
      setConfiguredBaseUrl(session.baseUrl);

      if (session.authenticated && session.baseUrl) {
        setConfig({ baseUrl: session.baseUrl });
        setUser(session.user || null);
      } else {
        setConfig(null);
        setGitea(null);
        setUser(null);
        setRepositories([]);
      }
    } catch (error) {
      console.error('Failed to restore developer session:', error);
      setConfig(null);
      setGitea(null);
      setUser(null);
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };

  const loadInitialData = async (service: GiteaService) => {
    setLoading(true);
    try {
      const [userData, reposData] = await Promise.all([
        service.getUser(),
        service.getRepositories()
      ]);
      setUser(userData);
      setRepositories(reposData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      if ((error as any).response?.status === 401) {
        await handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (notifyServer = true) => {
    if (notifyServer) {
      try {
        await fetch('/api/auth/gitea/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch (error) {
        console.error('Failed to close developer session:', error);
      }
    }

    setConfig(null);
    setGitea(null);
    setUser(null);
    setRepositories([]);
  };

  const handleRepositoryCreated = (repository: Repository) => {
    setRepositories((current) => [repository, ...current.filter((item) => item.id !== repository.id)]);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#E4E3E0]">
        <div className="font-serif italic text-2xl animate-pulse">Loading GitForge...</div>
      </div>
    );
  }

  return (
    <Router>
      {!config ? (
        <Routes>
          <Route path="/portal" element={<EndUserPortalView />} />
          <Route path="*" element={<Auth giteaConfigured={giteaConfigured} baseUrl={configuredBaseUrl} />} />
        </Routes>
      ) : (
        <Layout repositories={repositories} onLogout={() => void handleLogout()} user={user}>
          <Routes>
            <Route path="/" element={
              <Dashboard
                gitea={gitea!}
                user={user}
                repositories={repositories}
                onRepositoryCreated={handleRepositoryCreated}
              />
            } />
            <Route path="/portal" element={<EndUserPortalView />} />
            <Route path="/activities" element={<ActivitiesView gitea={gitea!} repositories={repositories} />} />
            <Route path="/support/inbox" element={<SupportInboxView onUnauthorized={() => void handleLogout()} />} />
            <Route path="/repo/:owner/:repo" element={<RepoView gitea={gitea!} />} />
            <Route path="/explore" element={<ExploreView gitea={gitea!} />} />
            <Route path="/packages" element={
              user ? (
                <PackagesView gitea={gitea!} user={user} />
              ) : (
                <Navigate to="/" />
              )
            } />
            <Route path="/admin" element={
              user?.is_admin ? (
                <AdminView gitea={gitea!} />
              ) : (
                <Navigate to="/" />
              )
            } />
            <Route path="/account" element={
              user ? (
                <AccountView
                  gitea={gitea!}
                  user={user}
                  onUserUpdate={setUser}
                />
              ) : (
                <Navigate to="/" />
              )
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}
