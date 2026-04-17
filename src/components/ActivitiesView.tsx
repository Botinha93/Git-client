import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Circle,
  FolderKanban,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Target,
} from 'lucide-react';
import { GiteaService, Issue, Label, Repository } from '@/src/lib/gitea';
import {
  ActivityFlowStage,
  ActivityProject,
  ActivitySprint,
  FLOW_STAGE_META,
  createUniqueActivityId,
  getFlowLabelName,
  getProjectLabelName,
  getSprintLabelName,
  humanizeActivityId,
  isWorkspaceManagedLabel,
  loadActivityWorkspace,
  normalizeHexColor,
  parseWorkspaceLabel,
  saveActivityWorkspace,
} from '@/src/lib/activityWorkspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ActivitiesViewProps {
  gitea: GiteaService;
  repositories: Repository[];
}

interface WorkspaceIssueRecord {
  id: string;
  repoKey: string;
  repository: Repository;
  issue: Issue;
  flowStage: ActivityFlowStage;
  projectId: string | null;
  sprintId: string | null;
}

interface NewIssueDraft {
  repoKey: string;
  title: string;
  body: string;
  projectId: string;
  sprintId: string;
}

const INITIAL_ISSUE_DRAFT: NewIssueDraft = {
  repoKey: '',
  title: '',
  body: '',
  projectId: '',
  sprintId: '',
};

const FLOW_STAGES: ActivityFlowStage[] = ['backlog', 'in-progress', 'review', 'done'];

function getRepoKey(repo: Repository) {
  return `${repo.owner.login}/${repo.name}`;
}

function deriveIssueBoardState(issue: Issue) {
  let flowStage: ActivityFlowStage = issue.state === 'closed' ? 'done' : 'backlog';
  let projectId: string | null = null;
  let sprintId: string | null = null;

  for (const label of issue.labels || []) {
    const parsed = parseWorkspaceLabel(label.name);
    if (!parsed) {
      continue;
    }

    if (parsed.type === 'flow' && FLOW_STAGES.includes(parsed.value as ActivityFlowStage)) {
      flowStage = parsed.value as ActivityFlowStage;
    }
    if (parsed.type === 'project') {
      projectId = parsed.value;
    }
    if (parsed.type === 'sprint') {
      sprintId = parsed.value;
    }
  }

  return { flowStage, projectId, sprintId };
}

export function ActivitiesView({ gitea, repositories }: ActivitiesViewProps) {
  const [workspace, setWorkspace] = useState(() => loadActivityWorkspace());
  const [issues, setIssues] = useState<WorkspaceIssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingIssueId, setSyncingIssueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepoKeys, setSelectedRepoKeys] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedSprintId, setSelectedSprintId] = useState('all');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [newIssue, setNewIssue] = useState<NewIssueDraft>(INITIAL_ISSUE_DRAFT);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('0ea5e9');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintColor, setNewSprintColor] = useState('f59e0b');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintProjectId, setNewSprintProjectId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const repoLabelsCache = useRef<Record<string, Label[]>>({});

  useEffect(() => {
    if (repositories.length === 0) {
      setIssues([]);
      setLoading(false);
      return;
    }

    void loadAllIssues();
  }, [repositories]);

  useEffect(() => {
    if (!newIssue.repoKey && repositories.length > 0) {
      setNewIssue((current) => ({ ...current, repoKey: getRepoKey(repositories[0]) }));
    }
  }, [repositories, newIssue.repoKey]);

  const projectMap = useMemo(() => Object.fromEntries(workspace.projects.map((project) => [project.id, project])), [workspace.projects]);
  const sprintMap = useMemo(() => Object.fromEntries(workspace.sprints.map((sprint) => [sprint.id, sprint])), [workspace.sprints]);

  const filteredIssues = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return issues.filter((item) => {
      if (selectedRepoKeys.length > 0 && !selectedRepoKeys.includes(item.repoKey)) {
        return false;
      }
      if (selectedProjectId !== 'all' && (item.projectId || '') !== selectedProjectId) {
        return false;
      }
      if (selectedSprintId !== 'all' && (item.sprintId || '') !== selectedSprintId) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        item.issue.title,
        item.issue.body,
        item.repository.name,
        item.repository.full_name,
        item.projectId,
        item.sprintId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [issues, searchQuery, selectedRepoKeys, selectedProjectId, selectedSprintId]);

  const issuesByStage = useMemo(() => {
    return FLOW_STAGES.reduce<Record<ActivityFlowStage, WorkspaceIssueRecord[]>>((accumulator, stage) => {
      accumulator[stage] = filteredIssues.filter((item) => item.flowStage === stage);
      return accumulator;
    }, {
      backlog: [],
      'in-progress': [],
      review: [],
      done: [],
    });
  }, [filteredIssues]);

  const selectedIssue = useMemo(
    () => issues.find((item) => item.id === selectedIssueId) || null,
    [issues, selectedIssueId],
  );

  const visibleRepoCount = selectedRepoKeys.length > 0 ? selectedRepoKeys.length : repositories.length;

  async function loadAllIssues() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const results = await Promise.allSettled(
        repositories.map(async (repository) => {
          const repoKey = getRepoKey(repository);
          const repoIssues = await gitea.getIssues(repository.owner.login, repository.name, { state: 'all', limit: 100 });
          return repoIssues.map((issue) => {
            const derived = deriveIssueBoardState(issue);
            return {
              id: `${repoKey}#${issue.number}`,
              repoKey,
              repository,
              issue,
              flowStage: derived.flowStage,
              projectId: derived.projectId,
              sprintId: derived.sprintId,
            } satisfies WorkspaceIssueRecord;
          });
        }),
      );

      const nextIssues = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
      setIssues(nextIssues.sort((left, right) => right.issue.number - left.issue.number));
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      if (failedCount > 0) {
        setErrorMessage(`Loaded activities with ${failedCount} repository sync failures.`);
      }
    } catch (error) {
      console.error('Failed to load workspace activities:', error);
      setErrorMessage('Failed to load cross-repository activities.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshIssues() {
    setRefreshing(true);
    await loadAllIssues();
  }

  function updateWorkspace(nextWorkspace: { projects: ActivityProject[]; sprints: ActivitySprint[] }) {
    setWorkspace(nextWorkspace);
    saveActivityWorkspace(nextWorkspace);
  }

  function getProjectDefinition(projectId: string | null) {
    if (!projectId) {
      return null;
    }
    return projectMap[projectId] || null;
  }

  function getSprintDefinition(sprintId: string | null) {
    if (!sprintId) {
      return null;
    }
    return sprintMap[sprintId] || null;
  }

  async function getRepoLabels(repository: Repository) {
    const repoKey = getRepoKey(repository);
    if (!repoLabelsCache.current[repoKey]) {
      repoLabelsCache.current[repoKey] = await gitea.getLabels(repository.owner.login, repository.name);
    }
    return repoLabelsCache.current[repoKey];
  }

  async function ensureRepoLabel(repository: Repository, name: string, color: string, description?: string) {
    const repoLabels = await getRepoLabels(repository);
    const existing = repoLabels.find((label) => label.name === name);
    if (existing) {
      return existing;
    }

    const created = await gitea.createLabel(repository.owner.login, repository.name, {
      name,
      color: normalizeHexColor(color),
      description,
    });
    repoLabelsCache.current[getRepoKey(repository)] = [...repoLabels, created];
    return created;
  }

  async function ensureWorkspaceLabels(repository: Repository, stage: ActivityFlowStage, projectId: string | null, sprintId: string | null) {
    const labels: Label[] = [];
    labels.push(await ensureRepoLabel(repository, getFlowLabelName(stage), FLOW_STAGE_META[stage].color, `Workspace flow: ${FLOW_STAGE_META[stage].label}`));

    if (projectId) {
      const project = getProjectDefinition(projectId);
      labels.push(await ensureRepoLabel(repository, getProjectLabelName(projectId), project?.color || '8b5cf6', project?.description || `Workspace project: ${project?.name || humanizeActivityId(projectId)}`));
    }

    if (sprintId) {
      const sprint = getSprintDefinition(sprintId);
      labels.push(await ensureRepoLabel(repository, getSprintLabelName(sprintId), sprint?.color || 'f59e0b', sprint?.goal || `Workspace sprint: ${sprint?.name || humanizeActivityId(sprintId)}`));
    }

    return labels;
  }

  async function syncIssueMetadata(item: WorkspaceIssueRecord, updates: Partial<Pick<WorkspaceIssueRecord, 'flowStage' | 'projectId' | 'sprintId'>>) {
    const nextFlowStage = updates.flowStage ?? item.flowStage;
    const nextProjectId = updates.projectId !== undefined ? updates.projectId : item.projectId;
    const nextSprintId = updates.sprintId !== undefined ? updates.sprintId : item.sprintId;

    setSyncingIssueId(item.id);
    setErrorMessage(null);

    try {
      const ensuredLabels = await ensureWorkspaceLabels(item.repository, nextFlowStage, nextProjectId, nextSprintId);
      const preservedLabelIds = (item.issue.labels || [])
        .filter((label) => !isWorkspaceManagedLabel(label.name))
        .map((label) => label.id)
        .filter((id): id is number => typeof id === 'number');

      const updatedIssue = await gitea.updateIssue(item.repository.owner.login, item.repository.name, item.issue.number, {
        labels: [...preservedLabelIds, ...ensuredLabels.map((label) => label.id)],
        state: nextFlowStage === 'done' ? 'closed' : 'open',
      });

      const derived = deriveIssueBoardState(updatedIssue);
      setIssues((current) => current.map((entry) => entry.id === item.id ? {
        ...entry,
        issue: updatedIssue,
        flowStage: derived.flowStage,
        projectId: derived.projectId,
        sprintId: derived.sprintId,
      } : entry));
    } catch (error) {
      console.error('Failed to sync workspace issue metadata:', error);
      setErrorMessage('Failed to update the linked issue in Gitea.');
    } finally {
      setSyncingIssueId(null);
    }
  }

  async function handleCreateIssue() {
    if (!newIssue.repoKey || !newIssue.title.trim()) {
      return;
    }

    const repository = repositories.find((item) => getRepoKey(item) === newIssue.repoKey);
    if (!repository) {
      return;
    }

    setSyncingIssueId('create');
    setErrorMessage(null);

    try {
      const workspaceLabels = await ensureWorkspaceLabels(
        repository,
        'backlog',
        newIssue.projectId || null,
        newIssue.sprintId || null,
      );

      await gitea.createIssue(repository.owner.login, repository.name, {
        title: newIssue.title.trim(),
        body: newIssue.body.trim() || undefined,
        labels: workspaceLabels.map((label) => label.id),
      });

      setIsCreateIssueOpen(false);
      setNewIssue({ ...INITIAL_ISSUE_DRAFT, repoKey: newIssue.repoKey });
      await refreshIssues();
    } catch (error) {
      console.error('Failed to create workspace issue:', error);
      setErrorMessage('Failed to create the issue in the selected repository.');
    } finally {
      setSyncingIssueId(null);
    }
  }

  function handleCreateProject() {
    if (!newProjectName.trim()) {
      return;
    }

    const project: ActivityProject = {
      id: createUniqueActivityId(newProjectName, workspace.projects.map((item) => item.id)),
      name: newProjectName.trim(),
      color: normalizeHexColor(newProjectColor),
      description: newProjectDescription.trim() || undefined,
    };

    updateWorkspace({
      ...workspace,
      projects: [...workspace.projects, project],
    });
    setNewProjectName('');
    setNewProjectColor('0ea5e9');
    setNewProjectDescription('');
    setIsCreateProjectOpen(false);
  }

  function handleCreateSprint() {
    if (!newSprintName.trim()) {
      return;
    }

    const sprint: ActivitySprint = {
      id: createUniqueActivityId(newSprintName, workspace.sprints.map((item) => item.id)),
      name: newSprintName.trim(),
      color: normalizeHexColor(newSprintColor),
      goal: newSprintGoal.trim() || undefined,
      projectId: newSprintProjectId || undefined,
    };

    updateWorkspace({
      ...workspace,
      sprints: [...workspace.sprints, sprint],
    });
    setNewSprintName('');
    setNewSprintColor('f59e0b');
    setNewSprintGoal('');
    setNewSprintProjectId('');
    setIsCreateSprintOpen(false);
  }

  function toggleRepoSelection(repoKey: string) {
    setSelectedRepoKeys((current) => current.includes(repoKey)
      ? current.filter((item) => item !== repoKey)
      : [...current, repoKey]);
  }

  function issueProjectName(projectId: string | null) {
    return getProjectDefinition(projectId)?.name || (projectId ? humanizeActivityId(projectId) : 'Unassigned');
  }

  function issueSprintName(sprintId: string | null) {
    return getSprintDefinition(sprintId)?.name || (sprintId ? humanizeActivityId(sprintId) : 'No sprint');
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden bg-slate-100">
      <div className="h-full flex flex-col p-6 gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-semibold">Workspace Delivery</div>
            <h1 className="text-3xl font-semibold text-slate-900 mt-2">Activities</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-3xl">
              Run one shared delivery board across repositories. Projects and sprints live at the workspace layer, while issue status and labels stay synchronized back to Gitea.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-slate-200 bg-white" onClick={() => void refreshIssues()} disabled={loading || refreshing}>
              <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} /> Refresh
            </Button>
            <Button className="bg-sky-600 text-white hover:bg-sky-700" onClick={() => setIsCreateIssueOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Task
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-white shadow-sm ring-slate-200/80">
            <CardHeader>
              <CardDescription>Visible repositories</CardDescription>
              <CardTitle>{visibleRepoCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white shadow-sm ring-slate-200/80">
            <CardHeader>
              <CardDescription>Tracked tasks</CardDescription>
              <CardTitle>{filteredIssues.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white shadow-sm ring-slate-200/80">
            <CardHeader>
              <CardDescription>Workspace projects</CardDescription>
              <CardTitle>{workspace.projects.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white shadow-sm ring-slate-200/80">
            <CardHeader>
              <CardDescription>Workspace sprints</CardDescription>
              <CardTitle>{workspace.sprints.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Filters</div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search tasks, repos, projects..." className="pl-9 bg-slate-50 border-slate-200" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Repositories</div>
                    {selectedRepoKeys.length > 0 && (
                      <button type="button" onClick={() => setSelectedRepoKeys([])} className="text-xs text-sky-600">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {repositories.map((repository) => {
                      const repoKey = getRepoKey(repository);
                      const active = selectedRepoKeys.includes(repoKey);
                      return (
                        <button
                          key={repoKey}
                          type="button"
                          onClick={() => toggleRepoSelection(repoKey)}
                          className={cn(
                            'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                            active ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
                          )}
                        >
                          <div className="text-sm font-medium truncate">{repository.name}</div>
                          <div className="text-xs text-slate-400 truncate">{repository.owner.login}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Projects</div>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-sky-600" onClick={() => setIsCreateProjectOpen(true)}>
                      <FolderPlus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <option value="all">All projects</option>
                    <option value="">Unassigned only</option>
                    {workspace.projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                  <div className="space-y-2">
                    {workspace.projects.length === 0 && <div className="text-sm text-slate-400">No workspace projects yet.</div>}
                    {workspace.projects.map((project) => (
                      <div key={project.id} className="rounded-xl border border-slate-200 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${project.color}` }} />
                          <span className="text-sm font-medium text-slate-800">{project.name}</span>
                        </div>
                        {project.description && <div className="mt-1 text-xs text-slate-400">{project.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Sprints</div>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-sky-600" onClick={() => setIsCreateSprintOpen(true)}>
                      <CalendarRange className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  <select value={selectedSprintId} onChange={(event) => setSelectedSprintId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <option value="all">All sprints</option>
                    <option value="">No sprint</option>
                    {workspace.sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                    ))}
                  </select>
                  <div className="space-y-2">
                    {workspace.sprints.length === 0 && <div className="text-sm text-slate-400">No sprints defined yet.</div>}
                    {workspace.sprints.map((sprint) => (
                      <div key={sprint.id} className="rounded-xl border border-slate-200 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${sprint.color}` }} />
                          <span className="text-sm font-medium text-slate-800">{sprint.name}</span>
                        </div>
                        {sprint.goal && <div className="mt-1 text-xs text-slate-400">{sprint.goal}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading activities...
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="flex min-h-full gap-4 p-4">
                  {FLOW_STAGES.map((stage) => (
                    <div
                      key={stage}
                      className="min-w-[300px] flex-1 rounded-2xl bg-slate-50 border border-slate-200"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!draggedIssueId) {
                          return;
                        }
                        const item = issues.find((issue) => issue.id === draggedIssueId);
                        if (item && item.flowStage !== stage) {
                          void syncIssueMetadata(item, { flowStage: stage });
                        }
                        setDraggedIssueId(null);
                      }}
                    >
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${FLOW_STAGE_META[stage].color}` }} />
                          <span className="font-semibold text-slate-800">{FLOW_STAGE_META[stage].label}</span>
                        </div>
                        <Badge variant="outline" className="border-slate-200 text-slate-500">{issuesByStage[stage].length}</Badge>
                      </div>
                      <div className="p-3 space-y-3 min-h-[320px]">
                        {issuesByStage[stage].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            draggable
                            onDragStart={() => setDraggedIssueId(item.id)}
                            onClick={() => setSelectedIssueId(item.id)}
                            className={cn(
                              'w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md',
                              selectedIssueId === item.id ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-200',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.repository.owner.login} / {item.repository.name}</div>
                                <div className="mt-2 font-semibold text-slate-900 line-clamp-2">{item.issue.title}</div>
                              </div>
                              <Badge variant="outline" className="border-slate-200 text-slate-500">#{item.issue.number}</Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{issueProjectName(item.projectId)}</Badge>
                              <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">{issueSprintName(item.sprintId)}</Badge>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                              <span>{item.issue.comments} comments</span>
                              <span>{item.issue.state === 'closed' ? 'Closed' : 'Open'}</span>
                            </div>
                          </button>
                        ))}
                        {issuesByStage[stage].length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                            No tasks in {FLOW_STAGE_META[stage].label.toLowerCase()}.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ScrollArea className="h-full">
              <div className="p-4">
                {!selectedIssue ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                    Select a task to edit its project, sprint, or workflow state.
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Selected task</div>
                      <h2 className="mt-2 text-xl font-semibold text-slate-900">{selectedIssue.issue.title}</h2>
                      <div className="mt-2 text-sm text-slate-500">{selectedIssue.repository.full_name} · Issue #{selectedIssue.issue.number}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link to={`/repo/${selectedIssue.repository.owner.login}/${selectedIssue.repository.name}`} className="inline-flex">
                        <Button variant="outline" className="border-slate-200 bg-white">
                          Open Repo
                        </Button>
                      </Link>
                    </div>

                    <Card className="bg-slate-50 ring-slate-200/80">
                      <CardHeader>
                        <CardTitle>Workflow</CardTitle>
                        <CardDescription>Moving the card also updates the linked issue state.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2">
                        {FLOW_STAGES.map((stage) => (
                          <Button
                            key={stage}
                            type="button"
                            variant={selectedIssue.flowStage === stage ? 'default' : 'outline'}
                            className={cn(selectedIssue.flowStage === stage ? 'bg-sky-600 text-white hover:bg-sky-700' : 'border-slate-200 bg-white')}
                            disabled={syncingIssueId === selectedIssue.id}
                            onClick={() => void syncIssueMetadata(selectedIssue, { flowStage: stage })}
                          >
                            {stage === 'done' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Circle className="w-4 h-4 mr-2" />}
                            {FLOW_STAGE_META[stage].label}
                          </Button>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50 ring-slate-200/80">
                      <CardHeader>
                        <CardTitle>Planning dimensions</CardTitle>
                        <CardDescription>Projects and sprints sync back as repository labels.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Project</label>
                          <select
                            value={selectedIssue.projectId || ''}
                            onChange={(event) => void syncIssueMetadata(selectedIssue, { projectId: event.target.value || null })}
                            disabled={syncingIssueId === selectedIssue.id}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            <option value="">Unassigned</option>
                            {workspace.projects.map((project) => (
                              <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sprint</label>
                          <select
                            value={selectedIssue.sprintId || ''}
                            onChange={(event) => void syncIssueMetadata(selectedIssue, { sprintId: event.target.value || null })}
                            disabled={syncingIssueId === selectedIssue.id}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            <option value="">No sprint</option>
                            {workspace.sprints.map((sprint) => (
                              <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                            ))}
                          </select>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50 ring-slate-200/80">
                      <CardHeader>
                        <CardTitle>Issue body</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm leading-6 text-slate-600 whitespace-pre-wrap">
                          {selectedIssue.issue.body?.trim() || 'No issue description.'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      <Dialog open={isCreateIssueOpen} onOpenChange={setIsCreateIssueOpen}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Create Cross-Repo Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Repository</label>
                <select value={newIssue.repoKey} onChange={(event) => setNewIssue((current) => ({ ...current, repoKey: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {repositories.map((repository) => (
                    <option key={getRepoKey(repository)} value={getRepoKey(repository)}>{repository.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Project</label>
                <select value={newIssue.projectId} onChange={(event) => setNewIssue((current) => ({ ...current, projectId: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <option value="">Unassigned</option>
                  {workspace.projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sprint</label>
              <select value={newIssue.sprintId} onChange={(event) => setNewIssue((current) => ({ ...current, sprintId: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <option value="">No sprint</option>
                {workspace.sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Title</label>
              <Input value={newIssue.title} onChange={(event) => setNewIssue((current) => ({ ...current, title: event.target.value }))} placeholder="Draft onboarding checklist" className="border-slate-200" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Body</label>
              <textarea value={newIssue.body} onChange={(event) => setNewIssue((current) => ({ ...current, body: event.target.value }))} placeholder="Capture acceptance criteria, risks, or references..." className="min-h-[160px] w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-300" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateIssueOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateIssue()} disabled={!newIssue.title.trim() || syncingIssueId === 'create'} className="bg-sky-600 text-white hover:bg-sky-700">
              {syncingIssueId === 'create' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Create Workspace Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Platform refresh" className="border-slate-200" />
            <Input value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} placeholder="What this project is coordinating" className="border-slate-200" />
            <Input value={newProjectColor} onChange={(event) => setNewProjectColor(event.target.value)} placeholder="0ea5e9" className="border-slate-200 font-mono" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateProjectOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="bg-sky-600 text-white hover:bg-sky-700">
              <Target className="w-4 h-4 mr-2" /> Save project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateSprintOpen} onOpenChange={setIsCreateSprintOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Create Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={newSprintName} onChange={(event) => setNewSprintName(event.target.value)} placeholder="Sprint 14" className="border-slate-200" />
            <Input value={newSprintGoal} onChange={(event) => setNewSprintGoal(event.target.value)} placeholder="Goal for this sprint" className="border-slate-200" />
            <select value={newSprintProjectId} onChange={(event) => setNewSprintProjectId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="">No linked project</option>
              {workspace.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <Input value={newSprintColor} onChange={(event) => setNewSprintColor(event.target.value)} placeholder="f59e0b" className="border-slate-200 font-mono" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSprintOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSprint} disabled={!newSprintName.trim()} className="bg-sky-600 text-white hover:bg-sky-700">
              <CalendarRange className="w-4 h-4 mr-2" /> Save sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}