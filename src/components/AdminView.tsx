import React, { useEffect, useMemo, useState } from 'react';
import { Award, Building2, Clock, FolderGit2, KeyRound, Mail, Pencil, Play, Plus, Search, Server, Shield, ShieldCheck, Trash2, UserCog, Webhook, Workflow } from 'lucide-react';
import { AdminActionJob, AdminActionRun, AdminActionRunner, AdminCronTask, EmailAddress, GiteaService, GiteaUser, Hook, Organization, ServerVersion, UserBadge } from '@/src/lib/gitea';
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

interface AdminViewProps {
  gitea: GiteaService;
}

export function AdminView({ gitea }: AdminViewProps) {
  const [users, setUsers] = useState<GiteaUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [unadoptedRepos, setUnadoptedRepos] = useState<string[]>([]);
  const [cronTasks, setCronTasks] = useState<AdminCronTask[]>([]);
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [adminHooks, setAdminHooks] = useState<Hook[]>([]);
  const [runners, setRunners] = useState<AdminActionRunner[]>([]);
  const [jobs, setJobs] = useState<AdminActionJob[]>([]);
  const [runs, setRuns] = useState<AdminActionRun[]>([]);
  const [serverVersion, setServerVersion] = useState<ServerVersion | null>(null);
  const [signingKey, setSigningKey] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [unadoptedSearchQuery, setUnadoptedSearchQuery] = useState('');
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false);
  const [isHookDialogOpen, setIsHookDialogOpen] = useState(false);
  const [isBadgeDialogOpen, setIsBadgeDialogOpen] = useState(false);
  const [editingHook, setEditingHook] = useState<Hook | null>(null);
  const [selectedBadgeUser, setSelectedBadgeUser] = useState<GiteaUser | null>(null);
  const [selectedUserBadges, setSelectedUserBadges] = useState<UserBadge[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [orgOwner, setOrgOwner] = useState('');
  const [orgUsername, setOrgUsername] = useState('');
  const [orgFullName, setOrgFullName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgLocation, setOrgLocation] = useState('');
  const [hookType, setHookType] = useState('gitea');
  const [hookUrl, setHookUrl] = useState('');
  const [hookContentType, setHookContentType] = useState('json');
  const [hookSecret, setHookSecret] = useState('');
  const [hookEvents, setHookEvents] = useState('push,pull_request');
  const [hookBranchFilter, setHookBranchFilter] = useState('');
  const [hookAuthorizationHeader, setHookAuthorizationHeader] = useState('');
  const [hookActive, setHookActive] = useState(true);
  const [badgeSlugInput, setBadgeSlugInput] = useState('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    const [usersResult, orgsResult, unadoptedResult, cronResult, versionResult, signingKeyResult, hooksResult] = await Promise.allSettled([
      gitea.getAdminUsers({ limit: 100 }),
      gitea.getAdminOrganizations({ limit: 100 }),
      gitea.getAdminUnadoptedRepositories({ limit: 100 }),
      gitea.getAdminCronTasks({ limit: 100 }),
      gitea.getServerVersion(),
      gitea.getSigningKey(),
      gitea.getAdminHooks({ limit: 100, type: 'all' }),
    ]);
    const [runnerResult, jobResult, runResult] = await Promise.allSettled([
      gitea.getAdminActionRunners(),
      gitea.getAdminActionJobs({ limit: 50 }),
      gitea.getAdminActionRuns({ limit: 50 }),
    ]);
    if (usersResult.status === 'fulfilled') setUsers(usersResult.value);
    if (orgsResult.status === 'fulfilled') setOrganizations(orgsResult.value);
    if (unadoptedResult.status === 'fulfilled') setUnadoptedRepos(unadoptedResult.value);
    if (cronResult.status === 'fulfilled') setCronTasks(cronResult.value);
    if (versionResult.status === 'fulfilled') setServerVersion(versionResult.value);
    if (signingKeyResult.status === 'fulfilled') setSigningKey(signingKeyResult.value);
    if (hooksResult.status === 'fulfilled') setAdminHooks(hooksResult.value);
    if (runnerResult.status === 'fulfilled') setRunners(runnerResult.value.runners || []);
    if (jobResult.status === 'fulfilled') setJobs(jobResult.value.jobs || []);
    if (runResult.status === 'fulfilled') setRuns(runResult.value.workflow_runs || []);
    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter((user) => [user.login, user.username, user.full_name, user.email].join(' ').toLowerCase().includes(query));
  }, [users, searchQuery]);

  const filteredOrganizations = useMemo(() => {
    const query = orgSearchQuery.toLowerCase();
    return organizations.filter((organization) =>
      [organization.username, organization.full_name, organization.description, organization.website]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [organizations, orgSearchQuery]);

  const filteredUnadoptedRepos = useMemo(() => {
    const query = unadoptedSearchQuery.toLowerCase();
    return unadoptedRepos.filter((entry) => entry.toLowerCase().includes(query));
  }, [unadoptedRepos, unadoptedSearchQuery]);

  const filteredEmails = useMemo(() => {
    const query = emailSearchQuery.toLowerCase();
    return emails.filter((email) => [email.email, email.username].join(' ').toLowerCase().includes(query));
  }, [emails, emailSearchQuery]);

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newEmail.trim() || !newPassword) return;
    setSaving(true);
    try {
      const user = await gitea.createAdminUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        full_name: newFullName.trim() || undefined,
      });
      setUsers([user, ...users]);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setIsUserDialogOpen(false);
    } catch (error) {
      console.error('Failed to create admin user:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetOrganizationForm = () => {
    setOrgOwner('');
    setOrgUsername('');
    setOrgFullName('');
    setOrgDescription('');
    setOrgWebsite('');
    setOrgLocation('');
  };

  const handleCreateOrganization = async () => {
    if (!orgOwner.trim() || !orgUsername.trim()) return;
    setSaving(true);
    try {
      const organization = await gitea.createAdminOrganization(orgOwner.trim(), {
        username: orgUsername.trim(),
        full_name: orgFullName.trim() || undefined,
        description: orgDescription.trim() || undefined,
        website: orgWebsite.trim() || undefined,
        location: orgLocation.trim() || undefined,
      });
      setOrganizations([organization, ...organizations]);
      resetOrganizationForm();
      setIsOrganizationDialogOpen(false);
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetHookForm = () => {
    setEditingHook(null);
    setHookType('gitea');
    setHookUrl('');
    setHookContentType('json');
    setHookSecret('');
    setHookEvents('push,pull_request');
    setHookBranchFilter('');
    setHookAuthorizationHeader('');
    setHookActive(true);
  };

  const openHookEditor = (hook?: Hook) => {
    if (!hook) {
      resetHookForm();
      setIsHookDialogOpen(true);
      return;
    }
    setEditingHook(hook);
    setHookType(hook.type || 'gitea');
    setHookUrl(hook.config?.url || '');
    setHookContentType(hook.config?.content_type || 'json');
    setHookSecret(hook.config?.secret || '');
    setHookEvents((hook.events || []).join(','));
    setHookBranchFilter(hook.branch_filter || '');
    setHookAuthorizationHeader(hook.authorization_header || '');
    setHookActive(hook.active !== false);
    setIsHookDialogOpen(true);
  };

  const handleSearchEmails = async () => {
    setSaving(true);
    try {
      const results = await gitea.searchAdminEmails({ q: emailSearchQuery.trim() || undefined, limit: 100 });
      setEmails(results);
    } catch (error) {
      console.error('Failed to search admin emails:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHook = async () => {
    if (!hookUrl.trim()) return;
    setSaving(true);
    try {
      const payload = {
        type: hookType,
        active: hookActive,
        branch_filter: hookBranchFilter.trim() || undefined,
        authorization_header: hookAuthorizationHeader.trim() || undefined,
        events: hookEvents
          .split(',')
          .map((event) => event.trim())
          .filter(Boolean),
        config: {
          url: hookUrl.trim(),
          content_type: hookContentType.trim() || 'json',
          ...(hookSecret.trim() ? { secret: hookSecret.trim() } : {}),
        },
      };
      const saved = editingHook
        ? await gitea.updateAdminHook(editingHook.id, payload)
        : await gitea.createAdminHook(payload);
      setAdminHooks(
        editingHook
          ? adminHooks.map((hook) => (hook.id === saved.id ? saved : hook))
          : [saved, ...adminHooks],
      );
      resetHookForm();
      setIsHookDialogOpen(false);
    } catch (error) {
      console.error('Failed to save admin hook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHook = async (hook: Hook) => {
    setSaving(true);
    try {
      await gitea.deleteAdminHook(hook.id);
      setAdminHooks(adminHooks.filter((item) => item.id !== hook.id));
    } catch (error) {
      console.error('Failed to delete admin hook:', error);
    } finally {
      setSaving(false);
    }
  };

  const openBadgeManager = async (user: GiteaUser) => {
    const login = user.login || user.username || '';
    if (!login) return;
    setSaving(true);
    try {
      const badges = await gitea.getAdminUserBadges(login);
      setSelectedBadgeUser(user);
      setSelectedUserBadges(badges);
      setBadgeSlugInput('');
      setIsBadgeDialogOpen(true);
    } catch (error) {
      console.error('Failed to load user badges:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBadges = async () => {
    const login = selectedBadgeUser?.login || selectedBadgeUser?.username || '';
    const slugs = badgeSlugInput.split(',').map((slug) => slug.trim()).filter(Boolean);
    if (!login || slugs.length === 0) return;
    setSaving(true);
    try {
      await gitea.addAdminUserBadges(login, slugs);
      const badges = await gitea.getAdminUserBadges(login);
      setSelectedUserBadges(badges);
      setBadgeSlugInput('');
    } catch (error) {
      console.error('Failed to add user badges:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBadge = async (slug: string) => {
    const login = selectedBadgeUser?.login || selectedBadgeUser?.username || '';
    if (!login) return;
    setSaving(true);
    try {
      await gitea.removeAdminUserBadges(login, [slug]);
      setSelectedUserBadges(selectedUserBadges.filter((badge) => badge.slug !== slug));
    } catch (error) {
      console.error('Failed to remove user badge:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUser = async (user: GiteaUser, field: 'active' | 'admin' | 'restricted' | 'prohibit_login') => {
    const login = user.login || user.username || '';
    if (!login) return;
    setSaving(true);
    try {
      const updated = await gitea.updateAdminUser(login, {
        [field]: !(field === 'admin' ? user.is_admin : user[field]),
      });
      setUsers(users.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      console.error('Failed to update admin user:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: GiteaUser) => {
    const login = user.login || user.username || '';
    if (!login) return;
    setSaving(true);
    try {
      await gitea.deleteAdminUser(login);
      setUsers(users.filter((item) => item.id !== user.id));
    } catch (error) {
      console.error('Failed to delete admin user:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRunCron = async (task: AdminCronTask) => {
    setSaving(true);
    try {
      await gitea.runAdminCronTask(task.name);
      const tasks = await gitea.getAdminCronTasks({ limit: 100 });
      setCronTasks(tasks);
    } catch (error) {
      console.error('Failed to run cron task:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRunnerToken = async () => {
    setSaving(true);
    try {
      const response = await gitea.createAdminActionRunnerRegistrationToken();
      setRegistrationToken(response.token);
    } catch (error) {
      console.error('Failed to create runner registration token:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRunner = async (runner: AdminActionRunner) => {
    setSaving(true);
    try {
      await gitea.deleteAdminActionRunner(runner.id);
      setRunners(runners.filter((item) => String(item.id) !== String(runner.id)));
    } catch (error) {
      console.error('Failed to delete runner:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAdoptUnadoptedRepo = async (entry: string) => {
    const [owner, repo] = entry.split('/');
    if (!owner || !repo) return;
    setSaving(true);
    try {
      await gitea.adoptAdminUnadoptedRepository(owner, repo);
      setUnadoptedRepos(unadoptedRepos.filter((item) => item !== entry));
    } catch (error) {
      console.error('Failed to adopt unadopted repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUnadoptedRepo = async (entry: string) => {
    const [owner, repo] = entry.split('/');
    if (!owner || !repo) return;
    setSaving(true);
    try {
      await gitea.deleteAdminUnadoptedRepository(owner, repo);
      setUnadoptedRepos(unadoptedRepos.filter((item) => item !== entry));
    } catch (error) {
      console.error('Failed to delete unadopted repository:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Administration</h1>
            <div className="text-xs text-slate-500">Instance users and scheduled tasks</div>
          </div>
        </div>
        <Button variant="outline" onClick={loadAdminData} className="h-10 border-slate-200 text-slate-600">Refresh</Button>
      </div>

      <Tabs defaultValue="users" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 border-b border-slate-200">
          <TabsList className="bg-transparent h-12 p-0 gap-8">
            <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <UserCog className="w-3.5 h-3.5 mr-2" /> Users
            </TabsTrigger>
            <TabsTrigger value="cron" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Clock className="w-3.5 h-3.5 mr-2" /> Cron
            </TabsTrigger>
            <TabsTrigger value="organizations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Building2 className="w-3.5 h-3.5 mr-2" /> Organizations
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <FolderGit2 className="w-3.5 h-3.5 mr-2" /> Maintenance
            </TabsTrigger>
            <TabsTrigger value="instance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Server className="w-3.5 h-3.5 mr-2" /> Instance
            </TabsTrigger>
            <TabsTrigger value="hooks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Webhook className="w-3.5 h-3.5 mr-2" /> Hooks
            </TabsTrigger>
            <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Workflow className="w-3.5 h-3.5 mr-2" /> Actions
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search users" className="h-10 pl-10 border-slate-200" />
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={isBadgeDialogOpen} onOpenChange={setIsBadgeDialogOpen}>
                  <DialogContent className="sm:max-w-xl bg-white">
                    <DialogHeader><DialogTitle>User Badges</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="text-sm text-slate-500">{selectedBadgeUser?.login || selectedBadgeUser?.username || 'No user selected'}</div>
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <Input value={badgeSlugInput} onChange={(event) => setBadgeSlugInput(event.target.value)} placeholder="badge-slug or comma,separated,slugs" className="h-10 border-slate-200" />
                        <Button onClick={handleAddBadges} disabled={!badgeSlugInput.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">Add</Button>
                      </div>
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {selectedUserBadges.map((badge) => (
                          <div key={badge.slug} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-3">
                              {badge.image_url ? <img src={badge.image_url} alt="" className="w-8 h-8 rounded border border-slate-200" /> : <Award className="w-4 h-4 text-slate-400" />}
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">{badge.slug}</div>
                                <div className="text-xs text-slate-400 truncate">{badge.description || 'No description'}</div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleRemoveBadge(badge.slug)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        {selectedUserBadges.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No badges assigned</div>}
                      </div>
                    </div>
                    <DialogFooter className="bg-white border-slate-100">
                      <Button variant="outline" onClick={() => setIsBadgeDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                  <DialogTrigger render={<Button className="h-10 bg-sky-600 text-white hover:bg-sky-700"><Plus className="w-4 h-4 mr-2" /> New User</Button>} />
                  <DialogContent className="sm:max-w-xl bg-white">
                    <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="Username" className="h-10 border-slate-200" />
                      <Input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Email" className="h-10 border-slate-200" />
                      <Input value={newFullName} onChange={(event) => setNewFullName(event.target.value)} placeholder="Full name" className="h-10 border-slate-200" />
                      <Input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Password" type="password" className="h-10 border-slate-200" />
                    </div>
                    <DialogFooter className="bg-white border-slate-100">
                      <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreateUser} disabled={!newUsername.trim() || !newEmail.trim() || !newPassword || saving} className="bg-sky-600 text-white hover:bg-sky-700">Create User</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full border border-slate-200" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{user.full_name || user.login || user.username}</div>
                        <div className="text-xs text-slate-400 truncate">{user.email || `@${user.login || user.username}`}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => openBadgeManager(user)} className="h-8 border-slate-200 text-xs">
                        <Award className="w-3.5 h-3.5 mr-2" /> Badges
                      </Button>
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => handleToggleUser(user, 'active')} className="h-8 border-slate-200 text-xs">
                        {user.active === false ? 'Inactive' : 'Active'}
                      </Button>
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => handleToggleUser(user, 'admin')} className="h-8 border-slate-200 text-xs">
                        {user.is_admin ? 'Admin' : 'User'}
                      </Button>
                      {user.restricted && <Badge className="bg-amber-500 text-white text-[10px]">Restricted</Badge>}
                      {user.prohibit_login && <Badge className="bg-red-600 text-white text-[10px]">Blocked</Badge>}
                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteUser(user)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No users found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="cron" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-5xl mx-auto space-y-3">
              {cronTasks.map((task) => (
                <div key={task.name} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{task.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {task.schedule || 'manual'} · {task.status || 'ready'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Previous {task.prev || 'never'} · Next {task.next || 'unknown'}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => handleRunCron(task)} className="h-8 border-slate-200 text-slate-600">
                    <Play className="w-3.5 h-3.5 mr-2" /> Run
                  </Button>
                </div>
              ))}
              {cronTasks.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No cron tasks visible</div>}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="organizations" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={orgSearchQuery} onChange={(event) => setOrgSearchQuery(event.target.value)} placeholder="Search organizations" className="h-10 pl-10 border-slate-200" />
              </div>
              <Dialog open={isOrganizationDialogOpen} onOpenChange={setIsOrganizationDialogOpen}>
                <DialogTrigger render={<Button className="h-10 bg-sky-600 text-white hover:bg-sky-700"><Plus className="w-4 h-4 mr-2" /> New Organization</Button>} />
                <DialogContent className="sm:max-w-xl bg-white">
                  <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={orgOwner} onChange={(event) => setOrgOwner(event.target.value)} placeholder="Owner username" className="h-10 border-slate-200" />
                    <Input value={orgUsername} onChange={(event) => setOrgUsername(event.target.value)} placeholder="Organization username" className="h-10 border-slate-200" />
                    <Input value={orgFullName} onChange={(event) => setOrgFullName(event.target.value)} placeholder="Display name" className="h-10 border-slate-200" />
                    <Input value={orgLocation} onChange={(event) => setOrgLocation(event.target.value)} placeholder="Location" className="h-10 border-slate-200" />
                    <Input value={orgWebsite} onChange={(event) => setOrgWebsite(event.target.value)} placeholder="Website" className="h-10 border-slate-200 col-span-2" />
                    <Input value={orgDescription} onChange={(event) => setOrgDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200 col-span-2" />
                  </div>
                  <DialogFooter className="bg-white border-slate-100">
                    <Button variant="outline" onClick={() => setIsOrganizationDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateOrganization} disabled={!orgOwner.trim() || !orgUsername.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">Create Organization</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y divide-slate-100">
                {filteredOrganizations.map((organization) => (
                  <div key={organization.id} className="p-4 flex items-center gap-3">
                    <img src={organization.avatar_url} alt="" className="w-10 h-10 rounded-full border border-slate-200" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{organization.full_name || organization.username}</div>
                      <div className="text-xs text-slate-500 truncate">@{organization.username}{organization.website ? ` · ${organization.website}` : ''}</div>
                      {organization.description && <div className="text-xs text-slate-400 truncate mt-1">{organization.description}</div>}
                    </div>
                  </div>
                ))}
                {filteredOrganizations.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No organizations found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={unadoptedSearchQuery} onChange={(event) => setUnadoptedSearchQuery(event.target.value)} placeholder="Filter unadopted repositories" className="h-10 pl-10 border-slate-200" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-5xl mx-auto space-y-3">
                {filteredUnadoptedRepos.map((entry) => (
                  <div key={entry} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{entry}</div>
                      <div className="text-xs text-slate-500 mt-1">Repository files found on disk but not yet adopted into the instance.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => handleAdoptUnadoptedRepo(entry)} className="h-8 border-slate-200 text-slate-600">
                        Adopt
                      </Button>
                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteUnadoptedRepo(entry)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredUnadoptedRepos.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No unadopted repositories found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="instance" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-6xl mx-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Server className="w-4 h-4 text-slate-500" /> Version
                  </div>
                  <div className="mt-3 text-2xl font-bold text-slate-900">{serverVersion?.version || 'Unknown'}</div>
                  <div className="mt-2 text-xs text-slate-500">Live instance version reported by the API.</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <KeyRound className="w-4 h-4 text-slate-500" /> Signing key
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-700 max-h-60 overflow-auto whitespace-pre-wrap">
                    {signingKey || 'No signing key returned'}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Mail className="w-4 h-4 text-slate-500" /> Email search
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input value={emailSearchQuery} onChange={(event) => setEmailSearchQuery(event.target.value)} placeholder="Search emails or usernames" className="h-10 pl-10 border-slate-200" />
                    </div>
                    <Button variant="outline" onClick={handleSearchEmails} disabled={saving} className="h-10 border-slate-200 text-slate-600">Search</Button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredEmails.map((email) => (
                    <div key={`${email.email}-${email.username || 'unknown'}`} className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{email.email}</div>
                        <div className="mt-1 text-xs text-slate-500 truncate">{email.username ? `@${email.username}` : 'Unassigned email record'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {email.primary && <Badge className="bg-slate-900 text-white text-[10px]">Primary</Badge>}
                        <Badge className={email.verified ? 'bg-emerald-600 text-white text-[10px]' : 'bg-amber-500 text-white text-[10px]'}>
                          {email.verified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {filteredEmails.length === 0 && <div className="p-12 text-center text-sm text-slate-400">Run a search to inspect email records</div>}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="hooks" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="text-sm text-slate-500">System and default hooks configured at the instance level.</div>
              <Dialog open={isHookDialogOpen} onOpenChange={setIsHookDialogOpen}>
                <DialogTrigger render={<Button className="h-10 bg-sky-600 text-white hover:bg-sky-700" onClick={() => openHookEditor()}><Plus className="w-4 h-4 mr-2" /> New Hook</Button>} />
                <DialogContent className="sm:max-w-2xl bg-white">
                  <DialogHeader><DialogTitle>{editingHook ? 'Edit Hook' : 'Create Hook'}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={hookType} onChange={(event) => setHookType(event.target.value)} placeholder="Hook type" className="h-10 border-slate-200" />
                    <Input value={hookContentType} onChange={(event) => setHookContentType(event.target.value)} placeholder="Content type" className="h-10 border-slate-200" />
                    <Input value={hookUrl} onChange={(event) => setHookUrl(event.target.value)} placeholder="Target URL" className="h-10 border-slate-200 col-span-2" />
                    <Input value={hookSecret} onChange={(event) => setHookSecret(event.target.value)} placeholder="Secret" className="h-10 border-slate-200" />
                    <Input value={hookAuthorizationHeader} onChange={(event) => setHookAuthorizationHeader(event.target.value)} placeholder="Authorization header" className="h-10 border-slate-200" />
                    <Input value={hookEvents} onChange={(event) => setHookEvents(event.target.value)} placeholder="Events, comma separated" className="h-10 border-slate-200 col-span-2" />
                    <Input value={hookBranchFilter} onChange={(event) => setHookBranchFilter(event.target.value)} placeholder="Branch filter" className="h-10 border-slate-200" />
                    <Button type="button" variant={hookActive ? 'default' : 'outline'} onClick={() => setHookActive(!hookActive)} className={hookActive ? 'h-10 bg-slate-900 text-white hover:bg-slate-800' : 'h-10 border-slate-200 text-slate-600'}>
                      {hookActive ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                  <DialogFooter className="bg-white border-slate-100">
                    <Button variant="outline" onClick={() => setIsHookDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveHook} disabled={!hookUrl.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">{editingHook ? 'Save Hook' : 'Create Hook'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-6xl mx-auto space-y-3">
                {adminHooks.map((hook) => (
                  <div key={hook.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{hook.type} hook #{hook.id}</div>
                      <div className="mt-1 text-xs text-slate-500 truncate">{hook.config?.url || 'No target URL'}{hook.branch_filter ? ` · ${hook.branch_filter}` : ''}</div>
                      <div className="mt-1 text-[10px] text-slate-400 truncate">{(hook.events || []).join(', ') || 'No events configured'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={hook.active ? 'bg-emerald-600 text-white text-[10px]' : 'bg-slate-400 text-white text-[10px]'}>{hook.active ? 'Active' : 'Inactive'}</Badge>
                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => openHookEditor(hook)} className="h-8 w-8 text-slate-400 hover:text-sky-600 hover:bg-sky-50">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteHook(hook)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {adminHooks.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No system hooks configured</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-6xl mx-auto space-y-6">
              <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-slate-500" /> Runner registration
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Generate a token for enrolling a new instance runner.</div>
                  {registrationToken && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 font-mono text-xs text-green-900 break-all">{registrationToken}</div>}
                </div>
                <Button onClick={handleCreateRunnerToken} disabled={saving} className="h-10 bg-sky-600 text-white hover:bg-sky-700">
                  <Plus className="w-4 h-4 mr-2" /> New Token
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">Runners</div>
                  <div className="divide-y divide-slate-100">
                    {runners.map((runner) => (
                      <div key={String(runner.id)} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{runner.name || `Runner ${runner.id}`}</div>
                          <div className="text-xs text-slate-500 truncate">{runner.os || 'unknown'} / {runner.arch || 'unknown'} · {runner.status || 'idle'}</div>
                        </div>
                        <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteRunner(runner)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {runners.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No runners found</div>}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">Jobs</div>
                  <div className="divide-y divide-slate-100">
                    {jobs.map((job) => (
                      <div key={job.id} className="p-4">
                        <div className="text-sm font-bold text-slate-900 truncate">{job.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{job.status || 'unknown'} {job.runner_name ? `· ${job.runner_name}` : ''}</div>
                        <div className="mt-1 text-[10px] text-slate-400 truncate">{job.head_branch || 'no branch'} · {job.head_sha?.slice(0, 12) || 'no sha'}</div>
                      </div>
                    ))}
                    {jobs.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No jobs found</div>}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">Runs</div>
                  <div className="divide-y divide-slate-100">
                    {runs.map((run) => (
                      <div key={run.id} className="p-4">
                        <div className="text-sm font-bold text-slate-900 truncate">{run.display_title || `Run #${run.id}`}</div>
                        <div className="mt-1 text-xs text-slate-500">{run.status || 'unknown'} {run.event ? `· ${run.event}` : ''}</div>
                        <div className="mt-1 text-[10px] text-slate-400 truncate">{run.head_branch || 'no branch'} · {run.head_sha?.slice(0, 12) || 'no sha'}</div>
                      </div>
                    ))}
                    {runs.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No runs found</div>}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
