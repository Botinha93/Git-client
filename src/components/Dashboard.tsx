import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Book,
  Bot,
  GitBranch,
  Layers3,
  LifeBuoy,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Unlock,
  User,
  Users,
} from 'lucide-react';
import { GiteaService, GiteaUser, Issue, Repository } from '@/src/lib/gitea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DashboardProps {
  gitea: GiteaService;
  user: any;
  repositories: Repository[];
  onRepositoryCreated: (repository: Repository) => void;
}

interface DashboardStats {
  developers: {
    total: number;
    admins: number;
    assignedIssues: number;
    unassignedIssues: number;
    topAssignees: Array<{ login: string; count: number }>;
  };
  environments: {
    configuredRepos: number;
    totalVariables: number;
    totalSecrets: number;
    uncoveredRepos: number;
  };
  issues: {
    total: number;
    open: number;
    closed: number;
    repositoriesWithOpenIssues: number;
  };
  userIssues: {
    total: number;
    open: number;
    closed: number;
    repositoriesTouched: number;
  };
}

const EMPTY_STATS: DashboardStats = {
  developers: {
    total: 0,
    admins: 0,
    assignedIssues: 0,
    unassignedIssues: 0,
    topAssignees: [],
  },
  environments: {
    configuredRepos: 0,
    totalVariables: 0,
    totalSecrets: 0,
    uncoveredRepos: 0,
  },
  issues: {
    total: 0,
    open: 0,
    closed: 0,
    repositoriesWithOpenIssues: 0,
  },
  userIssues: {
    total: 0,
    open: 0,
    closed: 0,
    repositoriesTouched: 0,
  },
};

function hasUserReportedLabel(issue: Issue) {
  return (issue.labels || []).some((label) => label.name.toLowerCase() === 'user-reported');
}

export function Dashboard({ gitea, user, repositories, onRepositoryCreated }: DashboardProps) {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoInit, setAutoInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardStats() {
      setLoadingStats(true);
      try {
        const repoResults = await Promise.allSettled(
          repositories.map(async (repository) => {
            const [issues, collaborators, variables, secrets] = await Promise.allSettled([
              gitea.getIssues(repository.owner.login, repository.name, { state: 'all', limit: 100 }),
              gitea.getCollaborators(repository.owner.login, repository.name),
              gitea.getRepositoryActionVariables(repository.owner.login, repository.name, { limit: 100 }),
              gitea.getRepositoryActionSecrets(repository.owner.login, repository.name, { limit: 100 }),
            ]);

            return {
              repository,
              issues: issues.status === 'fulfilled' ? issues.value : [],
              collaborators: collaborators.status === 'fulfilled' ? collaborators.value : [],
              variables: variables.status === 'fulfilled' ? variables.value : [],
              secrets: secrets.status === 'fulfilled' ? secrets.value : [],
            };
          }),
        );

        let adminUsers: GiteaUser[] = [];
        if (user?.is_admin) {
          try {
            adminUsers = await gitea.getAdminUsers({ limit: 100 });
          } catch (error) {
            console.error('Failed to load admin users for dashboard:', error);
          }
        }

        const fulfilledRepoResults = repoResults
          .filter((result): result is PromiseFulfilledResult<{
            repository: Repository;
            issues: Issue[];
            collaborators: GiteaUser[];
            variables: Array<{ name: string }>;
            secrets: Array<{ name: string }>;
          }> => result.status === 'fulfilled')
          .map((result) => result.value);

        const allIssues = fulfilledRepoResults.flatMap((entry) => entry.issues);
        const userIssues = allIssues.filter(hasUserReportedLabel);
        const developerLogins = new Set<string>();
        const assigneeCounts = new Map<string, number>();

        adminUsers.forEach((adminUser) => developerLogins.add(adminUser.login));
        fulfilledRepoResults.forEach((entry) => {
          entry.collaborators.forEach((collaborator) => developerLogins.add(collaborator.login));
          entry.issues.forEach((issue) => {
            if (issue.assignee?.login) {
              developerLogins.add(issue.assignee.login);
              assigneeCounts.set(issue.assignee.login, (assigneeCounts.get(issue.assignee.login) || 0) + 1);
            }
          });
        });

        const configuredRepos = fulfilledRepoResults.filter((entry) => entry.variables.length > 0 || entry.secrets.length > 0).length;

        const nextStats: DashboardStats = {
          developers: {
            total: developerLogins.size,
            admins: adminUsers.filter((adminUser) => adminUser.is_admin).length || (user?.is_admin ? 1 : 0),
            assignedIssues: allIssues.filter((issue) => Boolean(issue.assignee?.login)).length,
            unassignedIssues: allIssues.filter((issue) => !issue.assignee?.login).length,
            topAssignees: [...assigneeCounts.entries()]
              .sort((left, right) => right[1] - left[1])
              .slice(0, 5)
              .map(([login, count]) => ({ login, count })),
          },
          environments: {
            configuredRepos,
            totalVariables: fulfilledRepoResults.reduce((total, entry) => total + entry.variables.length, 0),
            totalSecrets: fulfilledRepoResults.reduce((total, entry) => total + entry.secrets.length, 0),
            uncoveredRepos: Math.max(0, repositories.length - configuredRepos),
          },
          issues: {
            total: allIssues.length,
            open: allIssues.filter((issue) => issue.state === 'open').length,
            closed: allIssues.filter((issue) => issue.state === 'closed').length,
            repositoriesWithOpenIssues: fulfilledRepoResults.filter((entry) => entry.issues.some((issue) => issue.state === 'open')).length,
          },
          userIssues: {
            total: userIssues.length,
            open: userIssues.filter((issue) => issue.state === 'open').length,
            closed: userIssues.filter((issue) => issue.state === 'closed').length,
            repositoriesTouched: new Set(
              fulfilledRepoResults
                .filter((entry) => entry.issues.some(hasUserReportedLabel))
                .map((entry) => entry.repository.full_name),
            ).size,
          },
        };

        if (!cancelled) {
          setStats(nextStats);
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    void loadDashboardStats();

    return () => {
      cancelled = true;
    };
  }, [gitea, repositories, user?.is_admin]);

  const repoMix = useMemo(() => ({
    privateCount: repositories.filter((repository) => repository.private).length,
    publicCount: repositories.filter((repository) => !repository.private).length,
  }), [repositories]);

  const handleCreateRepository = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const repository = await gitea.createRepository({
        name: name.trim(),
        description,
        private: isPrivate,
        auto_init: autoInit,
        default_branch: defaultBranch || 'main',
        readme: autoInit ? 'Default' : undefined,
      });
      onRepositoryCreated(repository);
      setIsCreateOpen(false);
      setName('');
      setDescription('');
      setDefaultBranch('main');
      setIsPrivate(false);
      setAutoInit(true);
      navigate(`/repo/${repository.owner.login}/${repository.name}`);
    } catch (error) {
      console.error('Failed to create repository:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_22%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Operational Overview</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Delivery Dashboard</h1>
            <p className="mt-3 text-sm text-slate-500">
              Track developer capacity, issue pressure, repository readiness, and user-reported work from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-slate-200 bg-white" onClick={() => navigate('/activities')}>
              <Layers3 className="mr-2 h-4 w-4" /> Activities
            </Button>
            <Button variant="outline" className="border-slate-200 bg-white" onClick={() => navigate('/support/inbox')}>
              <LifeBuoy className="mr-2 h-4 w-4" /> Support Inbox
            </Button>
            <Button className="bg-sky-600 text-white hover:bg-sky-700" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Repository
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Developers</div>
              <Users className="h-4 w-4 text-sky-500" />
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{loadingStats ? '...' : stats.developers.total}</div>
            <div className="mt-2 text-sm text-slate-500">
              {loadingStats ? 'Loading developer coverage...' : `${stats.developers.assignedIssues} assigned issues, ${stats.developers.unassignedIssues} unassigned`}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Environments</div>
              <Bot className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{loadingStats ? '...' : stats.environments.configuredRepos}</div>
            <div className="mt-2 text-sm text-slate-500">
              {loadingStats ? 'Loading repository config...' : `${stats.environments.totalVariables} vars, ${stats.environments.totalSecrets} secrets across repos`}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Issues</div>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{loadingStats ? '...' : stats.issues.open}</div>
            <div className="mt-2 text-sm text-slate-500">
              {loadingStats ? 'Loading issue inventory...' : `${stats.issues.total} total, ${stats.issues.closed} closed`}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">User Issues</div>
              <Sparkles className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{loadingStats ? '...' : stats.userIssues.open}</div>
            <div className="mt-2 text-sm text-slate-500">
              {loadingStats ? 'Loading user-reported issues...' : `${stats.userIssues.total} total across ${stats.userIssues.repositoriesTouched} repositories`}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Developer Health</h2>
                    <p className="mt-1 text-sm text-slate-500">Who is carrying the current issue load.</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin developers</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{loadingStats ? '...' : stats.developers.admins}</div>
                  </div>
                  <div className="space-y-2">
                    {loadingStats && <div className="text-sm text-slate-400">Loading assignee distribution...</div>}
                    {!loadingStats && stats.developers.topAssignees.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
                        No assigned issues yet.
                      </div>
                    )}
                    {!loadingStats && stats.developers.topAssignees.map((assignee) => (
                      <div key={assignee.login} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <User className="h-4 w-4 text-slate-400" />
                          {assignee.login}
                        </div>
                        <div className="text-sm font-semibold text-slate-900">{assignee.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Environment Readiness</h2>
                    <p className="mt-1 text-sm text-slate-500">Action configuration as a proxy for deployed environments.</p>
                  </div>
                  <Bot className="h-5 w-5 text-slate-400" />
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Configured repos</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{loadingStats ? '...' : stats.environments.configuredRepos}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Variables</span>
                      <span className="font-semibold text-slate-900">{loadingStats ? '...' : stats.environments.totalVariables}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Secrets</span>
                      <span className="font-semibold text-slate-900">{loadingStats ? '...' : stats.environments.totalSecrets}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Repos without config</span>
                      <span className="font-semibold text-slate-900">{loadingStats ? '...' : stats.environments.uncoveredRepos}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Issue Pressure</h2>
                  <p className="mt-1 text-sm text-slate-500">Repository-wide issue volume and user-reported work.</p>
                </div>
                <Button variant="outline" className="border-slate-200 bg-white" onClick={() => navigate('/support/inbox')}>
                  <LifeBuoy className="mr-2 h-4 w-4" /> Review support
                </Button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Open issues</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingStats ? '...' : stats.issues.open}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {loadingStats ? 'Loading...' : `${stats.issues.repositoriesWithOpenIssues} repositories currently carry open work`}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-rose-50/50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-rose-400">User-reported issues</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingStats ? '...' : stats.userIssues.total}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {loadingStats ? 'Loading...' : `${stats.userIssues.open} open, ${stats.userIssues.closed} resolved`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Repository Footprint</h2>
                  <p className="mt-1 text-sm text-slate-500">Current codebase surface available to the team.</p>
                </div>
                <Book className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-5 grid gap-3">
                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Total repositories</span>
                    <span className="font-semibold text-slate-900">{repositories.length}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Private repos</span>
                    <span className="font-semibold text-slate-900">{repoMix.privateCount}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Public repos</span>
                    <span className="font-semibold text-slate-900">{repoMix.publicCount}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                  <p className="mt-1 text-sm text-slate-500">Jump into the operational surfaces your team uses most.</p>
                </div>
                <GitBranch className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/activities')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-sky-200 hover:bg-white"
                >
                  <div className="text-sm font-semibold text-slate-900">Activities board</div>
                  <div className="mt-1 text-xs text-slate-500">Coordinate work across repositories and sprints.</div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/support/inbox')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-sky-200 hover:bg-white"
                >
                  <div className="text-sm font-semibold text-slate-900">User issue inbox</div>
                  <div className="mt-1 text-xs text-slate-500">Triage reports before they become repository issues.</div>
                </button>
                {user?.is_admin && (
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-sky-200 hover:bg-white"
                  >
                    <div className="text-sm font-semibold text-slate-900">Admin workspace</div>
                    <div className="mt-1 text-xs text-slate-500">Inspect users, runners, hooks, and system operations.</div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Create Repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="new-project" className="h-10 border-slate-200 font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className="h-10 border-slate-200" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default branch</label>
              <Input value={defaultBranch} onChange={(event) => setDefaultBranch(event.target.value)} className="h-10 border-slate-200 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPrivate(!isPrivate)}
                className={cn('h-10 justify-start border-slate-200', isPrivate && 'bg-slate-900 text-white hover:bg-slate-800')}
              >
                {isPrivate ? <Lock className="w-3.5 h-3.5 mr-2" /> : <Unlock className="w-3.5 h-3.5 mr-2" />}
                {isPrivate ? 'Private' : 'Public'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAutoInit(!autoInit)}
                className={cn('h-10 justify-start border-slate-200', autoInit && 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100')}
              >
                <GitBranch className="w-3.5 h-3.5 mr-2" />
                Initialize
              </Button>
            </div>
          </div>
          <DialogFooter className="bg-white border-slate-100">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRepository} disabled={!name.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">
              <Book className="w-3.5 h-3.5 mr-2" /> {saving ? 'Creating...' : 'Create Repository'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
