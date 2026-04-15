/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GiteaService, GiteaConfig, Repository } from './lib/gitea';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { RepoView } from './components/RepoView';

export default function App() {
  const [config, setConfig] = useState<GiteaConfig | null>(() => {
    const saved = localStorage.getItem('gitea_config');
    return saved ? JSON.parse(saved) : null;
  });
  const [gitea, setGitea] = useState<GiteaService | null>(null);
  const [user, setUser] = useState<any>(null);
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

  if (loading && config) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#E4E3E0]">
        <div className="font-serif italic text-2xl animate-pulse">Loading GitForge...</div>
      </div>
    );
  }

  if (!config) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout repositories={repositories} onLogout={handleLogout} user={user}>
        <Routes>
          <Route path="/" element={
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <h2 className="font-serif italic text-3xl mb-4">Welcome to GitForge</h2>
                <p className="text-sm opacity-60 mb-8">Select a repository from the sidebar to start exploring and editing your code.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 border-2 border-[#141414] bg-white text-left">
                    <div className="font-mono text-[10px] uppercase opacity-50 mb-2">Total Repos</div>
                    <div className="text-2xl font-bold">{repositories.length}</div>
                  </div>
                  <div className="p-6 border-2 border-[#141414] bg-white text-left">
                    <div className="font-mono text-[10px] uppercase opacity-50 mb-2">User</div>
                    <div className="text-sm font-bold truncate">{user?.login}</div>
                  </div>
                </div>
              </div>
            </div>
          } />
          <Route path="/repo/:owner/:repo" element={<RepoView gitea={gitea!} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

