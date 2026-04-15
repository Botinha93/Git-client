import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Book, Building2, Folder, Globe, Plus, Search, Star, Users } from 'lucide-react';
import { GiteaService, GiteaUser, Organization, Repository } from '@/src/lib/gitea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationManager } from './OrganizationManager';

interface ExploreViewProps {
  gitea: GiteaService;
}

export function ExploreView({ gitea }: ExploreViewProps) {
  const [query, setQuery] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [users, setUsers] = useState<GiteaUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgRepos, setOrgRepos] = useState<Repository[]>([]);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgFullName, setNewOrgFullName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  useEffect(() => {
    loadOrganizations();
    runSearch('');
  }, []);

  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const data = await gitea.getOrganizations();
      setOrganizations(data);
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const runSearch = async (value = query) => {
    setLoading(true);
    try {
      const [repoResult, userResult] = await Promise.all([
        gitea.searchRepositories({ q: value, limit: 30 }),
        gitea.searchUsers({ q: value, limit: 30 }),
      ]);
      setRepositories(repoResult.data || []);
      setUsers(userResult.data || []);
    } catch (error) {
      console.error('Failed to search instance:', error);
    } finally {
      setLoading(false);
    }
  };

  const openOrganization = async (org: Organization) => {
    setSelectedOrg(org);
    setLoadingOrgs(true);
    try {
      const repos = await gitea.getOrganizationRepositories(org.username);
      setOrgRepos(repos);
    } catch (error) {
      console.error('Failed to load organization repositories:', error);
      setOrgRepos([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;
    setLoadingOrgs(true);
    try {
      const org = await gitea.createOrganization({
        username: newOrgName.trim(),
        full_name: newOrgFullName,
        description: newOrgDescription,
      });
      setOrganizations([org, ...organizations.filter((item) => item.id !== org.id)]);
      setIsCreateOrgOpen(false);
      setNewOrgName('');
      setNewOrgFullName('');
      setNewOrgDescription('');
      openOrganization(org);
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const filteredOrganizations = useMemo(() => {
    const normalized = query.toLowerCase();
    return organizations.filter((org) => {
      const haystack = [org.username, org.full_name, org.description].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [organizations, query]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="p-6 border-b border-slate-200 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Explore</h1>
            <p className="text-xs text-slate-500 mt-1">Search repositories, people, and organizations on this Gitea instance.</p>
          </div>
          <Dialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="h-9 border-slate-200 bg-white text-slate-600">
                <Plus className="w-4 h-4 mr-2" /> New Organization
              </Button>
            } />
            <DialogContent className="sm:max-w-xl bg-white">
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input value={newOrgName} onChange={(event) => setNewOrgName(event.target.value)} placeholder="organization-name" className="h-10 border-slate-200 font-mono" />
                <Input value={newOrgFullName} onChange={(event) => setNewOrgFullName(event.target.value)} placeholder="Full name" className="h-10 border-slate-200" />
                <Input value={newOrgDescription} onChange={(event) => setNewOrgDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200" />
              </div>
              <DialogFooter className="bg-white border-slate-100">
                <Button variant="outline" onClick={() => setIsCreateOrgOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateOrganization} disabled={!newOrgName.trim() || loadingOrgs} className="bg-sky-600 text-white hover:bg-sky-700">
                  Create Organization
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch();
              }}
              placeholder="Search the instance..."
              className="h-11 pl-10 bg-white border-slate-200 focus-visible:ring-sky-400"
            />
          </div>
          <Button onClick={() => runSearch()} disabled={loading} className="h-11 bg-slate-900 text-white hover:bg-slate-800">
            <Search className="w-4 h-4 mr-2" /> Search
          </Button>
        </div>
      </div>

      <Tabs defaultValue="repositories" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 border-b border-slate-200">
          <TabsList className="bg-transparent h-12 p-0 gap-8">
            <TabsTrigger value="repositories" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Book className="w-3.5 h-3.5 mr-2" /> Repositories
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Users className="w-3.5 h-3.5 mr-2" /> Users
            </TabsTrigger>
            <TabsTrigger value="organizations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Building2 className="w-3.5 h-3.5 mr-2" /> Organizations
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="repositories" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-5xl mx-auto space-y-3">
              {loading ? (
                [1, 2, 3].map((item) => <Skeleton key={item} className="h-24 bg-slate-200" />)
              ) : repositories.length > 0 ? (
                repositories.map((repo) => (
                  <Link
                    key={repo.id}
                    to={`/repo/${repo.owner.login}/${repo.name}`}
                    className="block bg-white border border-slate-200 rounded-xl shadow-sm hover:border-sky-200 hover:shadow-md transition-all p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-sky-500" />
                          <span className="text-sm font-bold text-slate-900 truncate">{repo.full_name}</span>
                          <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">{repo.private ? 'Private' : 'Public'}</Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{repo.description || 'No description provided.'}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                        <Star className="w-3.5 h-3.5" /> {repo.stars_count}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-12 text-center text-sm text-slate-400">No repositories found</div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="users" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-5xl mx-auto grid grid-cols-2 gap-4">
              {loading ? (
                [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 bg-slate-200" />)
              ) : users.length > 0 ? (
                users.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center gap-4">
                    <img src={item.avatar_url} alt="" className="w-12 h-12 rounded-full border border-slate-200" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{item.full_name || item.login || item.username}</div>
                      <div className="text-xs text-slate-400 truncate">@{item.login || item.username}</div>
                      {item.website && (
                        <a href={item.website} className="mt-1 text-xs text-sky-600 hover:underline flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Website
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-12 text-center text-sm text-slate-400">No users found</div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="organizations" className="flex-1 overflow-hidden m-0">
          <div className="h-full grid grid-cols-[340px_1fr]">
            <ScrollArea className="border-r border-slate-200">
              <div className="p-4 space-y-2">
                {loadingOrgs && organizations.length === 0 ? (
                  [1, 2, 3].map((item) => <Skeleton key={item} className="h-20 bg-slate-200" />)
                ) : filteredOrganizations.length > 0 ? (
                  filteredOrganizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => openOrganization(org)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-sky-200 transition-colors flex items-center gap-3"
                    >
                      <img src={org.avatar_url} alt="" className="w-10 h-10 rounded-lg border border-slate-200" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{org.full_name || org.username}</div>
                        <div className="text-xs text-slate-400 truncate">@{org.username}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400">No organizations found</div>
                )}
              </div>
            </ScrollArea>
            <ScrollArea>
              <OrganizationManager
                gitea={gitea}
                organization={selectedOrg}
                repositories={orgRepos}
                loading={loadingOrgs && !!selectedOrg}
                onOrganizationUpdate={(org) => {
                  setSelectedOrg(org);
                  setOrganizations(organizations.map((item) => item.id === org.id ? org : item));
                }}
                onOrganizationDelete={(org) => {
                  setSelectedOrg(null);
                  setOrgRepos([]);
                  setOrganizations(organizations.filter((item) => item.id !== org.id));
                }}
                onRepositoriesUpdate={setOrgRepos}
              />
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
