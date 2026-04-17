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

export default function App() {
  const [config, setConfig] = useState<GiteaConfig | null>(() => {
    const saved = localStorage.getItem('gitea_config');
    return saved ? JSON.parse(saved) : null;
  });
  const [gitea, setGitea] = useState<GiteaService | null>(null);
  const [user, setUser] = useState<GiteaUser | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (config) {
      const service = new GiteaService(config);
      setGitea(service);
      loadInitialData(service);
    } else {
      setLoading(false);
    }
  }, [config]);

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
      // If unauthorized, clear config
      if ((error as any).response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (baseUrl: string, token: string) => {
    const newConfig = { baseUrl, token };
    localStorage.setItem('gitea_config', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  const handleLogout = () => {
    localStorage.removeItem('gitea_config');
    setConfig(null);
    setGitea(null);
    setUser(null);
    setRepositories([]);
  };

  const handleRepositoryCreated = (repository: Repository) => {
    setRepositories((current) => [repository, ...current.filter((item) => item.id !== repository.id)]);
  };

  if (loading && config) {
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
          <Route path="*" element={<Auth onLogin={handleLogin} />} />
        </Routes>
      ) : (
        <Layout repositories={repositories} onLogout={handleLogout} user={user}>
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
            <Route path="/support/inbox" element={<SupportInboxView giteaBaseUrl={config.baseUrl} giteaToken={config.token} />} />
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
