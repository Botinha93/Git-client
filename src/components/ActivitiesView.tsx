import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Circle,
  Edit3,
  FolderPlus,
  LayoutGrid,
  Lock,
  LockOpen,
  Loader2,
  List,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Target,
  UserCircle2,
} from 'lucide-react';
import { GiteaService, Issue, Label, Repository } from '@/src/lib/gitea';
import {
  ActivityFlowStage,
  ActivityProject,
  ActivitySprintClosureMode,
  ActivitySprint,
  FLOW_STAGE_META,
  createUniqueActivityId,
  getFlowLabelName,
  getProjectLabelName,
  getSprintLabelName,
  humanizeActivityId,
  isActivityProjectClosed,
  isActivitySprintClosed,
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
import { MarkdownRenderer } from './MarkdownRenderer';

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
type ActivitiesViewMode = 'board' | 'list';

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
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [draggedIssueIds, setDraggedIssueIds] = useState<string[]>([]);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isPlanningDialogOpen, setIsPlanningDialogOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isEditSprintOpen, setIsEditSprintOpen] = useState(false);
  const [newIssue, setNewIssue] = useState<NewIssueDraft>(INITIAL_ISSUE_DRAFT);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('0ea5e9');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintColor, setNewSprintColor] = useState('f59e0b');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintProjectId, setNewSprintProjectId] = useState('');
  const [newSprintClosureMode, setNewSprintClosureMode] = useState<ActivitySprintClosureMode>('manual');
  const [newSprintEndDate, setNewSprintEndDate] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingProjectColor, setEditingProjectColor] = useState('0ea5e9');
  const [editingProjectDescription, setEditingProjectDescription] = useState('');
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [editingSprintName, setEditingSprintName] = useState('');
  const [editingSprintColor, setEditingSprintColor] = useState('f59e0b');
  const [editingSprintGoal, setEditingSprintGoal] = useState('');
  const [editingSprintProjectId, setEditingSprintProjectId] = useState('');
  const [editingSprintClosureMode, setEditingSprintClosureMode] = useState<ActivitySprintClosureMode>('manual');
  const [editingSprintEndDate, setEditingSprintEndDate] = useState('');
  const [viewMode, setViewMode] = useState<ActivitiesViewMode>('board');
  const [bulkStageTarget, setBulkStageTarget] = useState<ActivityFlowStage | ''>('');
  const [bulkAssigneeTarget, setBulkAssigneeTarget] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const repoLabelsCache = useRef<Record<string, Label[]>>({});
  const repoAssigneesCache = useRef<Record<string, Awaited<ReturnType<GiteaService['getRepoAssignees']>>>>({});
  const listHeaderCheckboxRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (selectedProjectId !== 'all' && selectedProjectId !== '' && selectedSprintId !== 'all' && selectedSprintId !== '') {
      const sprint = workspace.sprints.find((item) => item.id === selectedSprintId);
      if (sprint && sprint.projectId !== selectedProjectId) {
        setSelectedSprintId('all');
      }
    }
  }, [selectedProjectId, selectedSprintId, workspace.sprints]);

  useEffect(() => {
    if (newIssue.projectId && newIssue.sprintId) {
      const sprint = workspace.sprints.find((item) => item.id === newIssue.sprintId);
      if (sprint && sprint.projectId !== newIssue.projectId) {
        setNewIssue((current) => ({ ...current, sprintId: '' }));
      }
    }
  }, [newIssue.projectId, newIssue.sprintId, workspace.sprints]);

  const projectMap = useMemo(() => Object.fromEntries(workspace.projects.map((project) => [project.id, project])), [workspace.projects]);
  const sprintMap = useMemo(() => Object.fromEntries(workspace.sprints.map((sprint) => [sprint.id, sprint])), [workspace.sprints]);
  const activeProjects = useMemo(() => workspace.projects.filter((project) => !isActivityProjectClosed(project)), [workspace.projects]);
  const closedProjects = useMemo(() => workspace.projects.filter((project) => isActivityProjectClosed(project)), [workspace.projects]);
  const activeSprints = useMemo(() => workspace.sprints.filter((sprint) => !isActivitySprintClosed(sprint)), [workspace.sprints]);
  const closedSprints = useMemo(() => workspace.sprints.filter((sprint) => isActivitySprintClosed(sprint)), [workspace.sprints]);
  const availableFilterSprints = useMemo(
    () => selectedProjectId !== 'all' && selectedProjectId !== ''
      ? workspace.sprints.filter((sprint) => sprint.projectId === selectedProjectId)
      : workspace.sprints,
    [workspace.sprints, selectedProjectId],
  );
  const availableNewIssueSprints = useMemo(
    () => newIssue.projectId
      ? workspace.sprints.filter((sprint) => sprint.projectId === newIssue.projectId)
      : [],
    [workspace.sprints, newIssue.projectId],
  );

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
  const selectedListIssues = useMemo(
    () => issues.filter((item) => selectedIssueIds.includes(item.id)),
    [issues, selectedIssueIds],
  );
  const selectedIssueIdSet = useMemo(() => new Set(selectedIssueIds), [selectedIssueIds]);
  const availableSelectedIssueSprints = useMemo(
    () => selectedIssue?.projectId
      ? workspace.sprints.filter((sprint) => sprint.projectId === selectedIssue.projectId)
      : [],
    [workspace.sprints, selectedIssue?.projectId],
  );
  const visibleIssueIds = useMemo(() => filteredIssues.map((item) => item.id), [filteredIssues]);
  const selectedVisibleIssueCount = useMemo(
    () => selectedIssueIds.filter((issueId) => visibleIssueIds.includes(issueId)).length,
    [selectedIssueIds, visibleIssueIds],
  );
  const selectedListRepoKey = useMemo(() => {
    if (selectedListIssues.length === 0) {
      return null;
    }

    const [first, ...rest] = selectedListIssues;
    return rest.every((item) => item.repoKey === first.repoKey) ? first.repoKey : null;
  }, [selectedListIssues]);
  const selectedListRepo = useMemo(
    () => repositories.find((repository) => getRepoKey(repository) === selectedListRepoKey) || null,
    [repositories, selectedListRepoKey],
  );
  const [availableBulkAssignees, setAvailableBulkAssignees] = useState<Awaited<ReturnType<GiteaService['getRepoAssignees']>>>([]);

  const visibleRepoCount = selectedRepoKeys.length > 0 ? selectedRepoKeys.length : repositories.length;

  useEffect(() => {
    if (!selectedIssueId) {
      return;
    }

    const stillExists = issues.some((item) => item.id === selectedIssueId);
    if (!stillExists) {
      setSelectedIssueId(null);
      setIsTaskDialogOpen(false);
    }
  }, [issues, selectedIssueId]);

  useEffect(() => {
    setSelectedIssueIds((current) => current.filter((issueId) => issues.some((item) => item.id === issueId)));
  }, [issues]);

  useEffect(() => {
    if (listHeaderCheckboxRef.current) {
      listHeaderCheckboxRef.current.indeterminate =
        selectedVisibleIssueCount > 0 && selectedVisibleIssueCount < visibleIssueIds.length;
    }
  }, [selectedVisibleIssueCount, visibleIssueIds.length]);

  useEffect(() => {
    if (!selectedListRepo) {
      setAvailableBulkAssignees([]);
      setBulkAssigneeTarget('');
      return;
    }

    let cancelled = false;

    void (async () => {
      const repoKey = getRepoKey(selectedListRepo);
      if (repoAssigneesCache.current[repoKey]) {
        if (!cancelled) {
          setAvailableBulkAssignees(repoAssigneesCache.current[repoKey]);
        }
        return;
      }

      try {
        const assignees = await gitea.getRepoAssignees(selectedListRepo.owner.login, selectedListRepo.name);
        repoAssigneesCache.current[repoKey] = assignees;
        if (!cancelled) {
          setAvailableBulkAssignees(assignees);
        }
      } catch (error) {
        console.error('Failed to load repository assignees:', error);
        if (!cancelled) {
          setAvailableBulkAssignees([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gitea, selectedListRepo]);

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

      setIssues((current) => current.map((entry) => entry.id === item.id ? {
        ...entry,
        issue: updatedIssue,
        flowStage: nextFlowStage,
        projectId: nextProjectId,
        sprintId: nextSprintId,
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
    if (!newSprintName.trim() || !newSprintProjectId || (newSprintClosureMode === 'automatic' && !newSprintEndDate)) {
      return;
    }

    const sprint: ActivitySprint = {
      id: createUniqueActivityId(newSprintName, workspace.sprints.map((item) => item.id)),
      name: newSprintName.trim(),
      color: normalizeHexColor(newSprintColor),
      goal: newSprintGoal.trim() || undefined,
      projectId: newSprintProjectId,
      closureMode: newSprintClosureMode,
      endDate: newSprintClosureMode === 'automatic' ? newSprintEndDate : undefined,
    };

    updateWorkspace({
      ...workspace,
      sprints: [...workspace.sprints, sprint],
    });
    setNewSprintName('');
    setNewSprintColor('f59e0b');
    setNewSprintGoal('');
    setNewSprintProjectId('');
    setNewSprintClosureMode('manual');
    setNewSprintEndDate('');
    setIsCreateSprintOpen(false);
  }

  function openEditProject(project: ActivityProject) {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
    setEditingProjectColor(project.color);
    setEditingProjectDescription(project.description || '');
    setIsEditProjectOpen(true);
  }

  function handleEditProject() {
    if (!editingProjectId || !editingProjectName.trim()) {
      return;
    }

    updateWorkspace({
      ...workspace,
      projects: workspace.projects.map((project) => project.id === editingProjectId
        ? {
            ...project,
            name: editingProjectName.trim(),
            color: normalizeHexColor(editingProjectColor),
            description: editingProjectDescription.trim() || undefined,
          }
        : project),
    });
    setIsEditProjectOpen(false);
    setEditingProjectId(null);
  }

  function openEditSprint(sprint: ActivitySprint) {
    setEditingSprintId(sprint.id);
    setEditingSprintName(sprint.name);
    setEditingSprintColor(sprint.color);
    setEditingSprintGoal(sprint.goal || '');
    setEditingSprintProjectId(sprint.projectId);
    setEditingSprintClosureMode(sprint.closureMode);
    setEditingSprintEndDate(sprint.endDate || '');
    setIsEditSprintOpen(true);
  }

  function handleEditSprint() {
    if (!editingSprintId || !editingSprintName.trim() || !editingSprintProjectId || (editingSprintClosureMode === 'automatic' && !editingSprintEndDate)) {
      return;
    }

    updateWorkspace({
      ...workspace,
      sprints: workspace.sprints.map((sprint) => sprint.id === editingSprintId
        ? {
            ...sprint,
            name: editingSprintName.trim(),
            color: normalizeHexColor(editingSprintColor),
            goal: editingSprintGoal.trim() || undefined,
            projectId: editingSprintProjectId,
            closureMode: editingSprintClosureMode,
            endDate: editingSprintClosureMode === 'automatic' ? editingSprintEndDate : undefined,
          }
        : sprint),
    });
    setIsEditSprintOpen(false);
    setEditingSprintId(null);
  }

  function toggleProjectClosed(projectId: string) {
    updateWorkspace({
      ...workspace,
      projects: workspace.projects.map((project) => project.id === projectId
        ? { ...project, closedAt: isActivityProjectClosed(project) ? undefined : new Date().toISOString() }
        : project),
    });
  }

  function toggleSprintClosed(sprintId: string) {
    updateWorkspace({
      ...workspace,
      sprints: workspace.sprints.map((sprint) => sprint.id === sprintId
        ? { ...sprint, closedAt: isActivitySprintClosed(sprint) ? undefined : new Date().toISOString() }
        : sprint),
    });
  }

  function toggleRepoSelection(repoKey: string) {
    setSelectedRepoKeys((current) => current.includes(repoKey)
      ? current.filter((item) => item !== repoKey)
      : [...current, repoKey]);
  }

  function issueProjectName(projectId: string | null) {
    const project = getProjectDefinition(projectId);
    if (project) {
      return `${project.name}${isActivityProjectClosed(project) ? ' (Closed)' : ''}`;
    }
    return projectId ? humanizeActivityId(projectId) : 'Unassigned';
  }

  function issueSprintName(sprintId: string | null) {
    const sprint = getSprintDefinition(sprintId);
    if (sprint) {
      return `${sprint.name}${isActivitySprintClosed(sprint) ? ' (Closed)' : ''}`;
    }
    return sprintId ? humanizeActivityId(sprintId) : 'No sprint';
  }

  function issueAssignee(issue: Issue) {
    return issue.assignee?.login || 'Unassigned';
  }

  function openTaskDialog(issueId: string) {
    setSelectedIssueId(issueId);
    setIsTaskDialogOpen(true);
  }

  function handleDragStart(event: React.DragEvent<HTMLElement>, issueId: string) {
    const nextDraggedIssueIds = selectedIssueIdSet.has(issueId) && selectedIssueIds.length > 1
      ? selectedIssueIds
      : [issueId];

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', issueId);
    event.dataTransfer.setData('application/x-gitflow-task', issueId);
    event.dataTransfer.setData('application/x-gitflow-task-ids', JSON.stringify(nextDraggedIssueIds));
    setDraggedIssueId(issueId);
    setDraggedIssueIds(nextDraggedIssueIds);
  }

  function handleStageDrop(event: React.DragEvent<HTMLElement>, stage: ActivityFlowStage) {
    event.preventDefault();
    event.stopPropagation();

    let parsedIssueIds: string[] = [];
    const transferredIssueIds = event.dataTransfer.getData('application/x-gitflow-task-ids');
    if (transferredIssueIds) {
      try {
        const candidate = JSON.parse(transferredIssueIds) as unknown;
        if (Array.isArray(candidate)) {
          parsedIssueIds = candidate.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
        }
      } catch {
        parsedIssueIds = [];
      }
    }

    const fallbackIssueId =
      event.dataTransfer.getData('application/x-gitflow-task') ||
      event.dataTransfer.getData('text/plain') ||
      draggedIssueId;
    const nextIssueIds = parsedIssueIds.length > 0
      ? parsedIssueIds
      : draggedIssueIds.length > 0
        ? draggedIssueIds
        : fallbackIssueId
          ? [fallbackIssueId]
          : [];

    if (nextIssueIds.length === 0) {
      return;
    }

    void runBulkStageChange(nextIssueIds, stage);
    setDraggedIssueId(null);
    setDraggedIssueIds([]);
  }

  function selectIssue(issueId: string, checked: boolean) {
    setSelectedIssueIds((current) => checked
      ? Array.from(new Set([...current, issueId]))
      : current.filter((item) => item !== issueId));
  }

  function toggleVisibleIssueSelection() {
    if (visibleIssueIds.length === 0) {
      return;
    }

    setSelectedIssueIds((current) => {
      const allVisibleSelected = visibleIssueIds.every((issueId) => current.includes(issueId));
      if (allVisibleSelected) {
        return current.filter((issueId) => !visibleIssueIds.includes(issueId));
      }
      return Array.from(new Set([...current, ...visibleIssueIds]));
    });
  }

  async function updateIssueAssignee(item: WorkspaceIssueRecord, assigneeLogin: string | null) {
    setSyncingIssueId(item.id);
    setErrorMessage(null);

    try {
      const updatedIssue = await gitea.updateIssue(item.repository.owner.login, item.repository.name, item.issue.number, {
        assignees: assigneeLogin ? [assigneeLogin] : [],
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
      console.error('Failed to update issue assignee:', error);
      setErrorMessage('Failed to update assignee in Gitea.');
      throw error;
    } finally {
      setSyncingIssueId(null);
    }
  }

  async function runBulkStageChange(issueIds: string[], stage: ActivityFlowStage) {
    const targetItems = issues.filter((item) => issueIds.includes(item.id) && item.flowStage !== stage);
    if (targetItems.length === 0) {
      return;
    }

    const results = await Promise.allSettled(targetItems.map((item) => syncIssueMetadata(item, { flowStage: stage })));
    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
      setErrorMessage(`Moved ${targetItems.length - failedCount} task(s), but ${failedCount} failed to update.`);
    } else {
      setErrorMessage(null);
    }
  }

  async function runBulkAssigneeChange(issueIds: string[], assigneeLogin: string | null) {
    const targetItems = issues.filter((item) => issueIds.includes(item.id));
    if (targetItems.length === 0) {
      return;
    }

    const results = await Promise.allSettled(targetItems.map((item) => updateIssueAssignee(item, assigneeLogin)));
    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
      setErrorMessage(`Updated ${targetItems.length - failedCount} assignee(s), but ${failedCount} failed to sync.`);
    } else {
      setErrorMessage(null);
    }
  }

  async function applyBulkStageChange() {
    if (!bulkStageTarget || selectedIssueIds.length === 0) {
      return;
    }

    await runBulkStageChange(selectedIssueIds, bulkStageTarget);
    setBulkStageTarget('');
  }

  async function applyBulkAssigneeChange() {
    if (selectedIssueIds.length === 0 || !selectedListRepoKey) {
      return;
    }

    await runBulkAssigneeChange(selectedIssueIds, bulkAssigneeTarget || null);
    setBulkAssigneeTarget('');
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden bg-slate-100">
      <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-semibold">Workspace Delivery</div>
            <h1 className="text-3xl font-semibold text-slate-900 mt-2">Activities</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-slate-200 bg-white" onClick={() => void refreshIssues()} disabled={loading || refreshing}>
              <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} /> Refresh
            </Button>
            <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setIsPlanningDialogOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" /> Planning
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

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <div className="space-y-3">
                  <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Filters</div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search tasks, repos, projects..." className="pl-9 bg-slate-50 border-slate-200" />
                  </div>
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
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Projects</div>
                  <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <option value="all">All projects</option>
                    <option value="">Unassigned only</option>
                    {workspace.projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}{isActivityProjectClosed(project) ? ' (Closed)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Sprints</div>
                  <select value={selectedSprintId} onChange={(event) => setSelectedSprintId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <option value="all">All sprints</option>
                    <option value="">No sprint</option>
                    {availableFilterSprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>{sprint.name}{isActivitySprintClosed(sprint) ? ' (Closed)' : ''}</option>
                    ))}
                  </select>
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
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Workspace view</div>
                    <div className="mt-1 text-sm text-slate-500">Switch between delivery board and grouped task list.</div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={viewMode === 'board' ? 'default' : 'ghost'}
                      className={cn('h-8', viewMode === 'board' ? 'bg-sky-600 text-white hover:bg-sky-700' : 'text-slate-600')}
                      onClick={() => setViewMode('board')}
                    >
                      <LayoutGrid className="mr-2 h-4 w-4" /> Board
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      className={cn('h-8', viewMode === 'list' ? 'bg-sky-600 text-white hover:bg-sky-700' : 'text-slate-600')}
                      onClick={() => setViewMode('list')}
                    >
                      <List className="mr-2 h-4 w-4" /> List
                    </Button>
                  </div>
                </div>

                {viewMode === 'board' ? (
                  <ScrollArea className="h-full">
                    <div className="flex min-h-full w-max min-w-full gap-4 p-4 pb-6">
                      {FLOW_STAGES.map((stage) => (
                        <div
                          key={stage}
                          className="w-[320px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 xl:w-[340px]"
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleStageDrop(event, stage);
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
                                onDragStart={(event) => handleDragStart(event, item.id)}
                                onDragEnd={() => {
                                  setDraggedIssueId(null);
                                  setDraggedIssueIds([]);
                                }}
                                onClick={() => setSelectedIssueId(item.id)}
                                onDoubleClick={() => openTaskDialog(item.id)}
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
                                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                  {item.issue.assignee?.avatar_url ? (
                                    <img
                                      src={item.issue.assignee.avatar_url}
                                      alt={item.issue.assignee.login}
                                      className="h-5 w-5 rounded-full border border-slate-200"
                                    />
                                  ) : (
                                    <UserCircle2 className="h-4 w-4 text-slate-400" />
                                  )}
                                  <span className="truncate">Assigned to {issueAssignee(item.issue)}</span>
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
                ) : (
                  <ScrollArea className="h-full">
                    <div className="space-y-6 p-4 pb-6">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">List actions</div>
                            <div className="mt-1 text-sm text-slate-600">
                              {selectedIssueIds.length > 0 ? `${selectedIssueIds.length} selected` : 'Select tasks to move or reassign them in bulk.'}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" variant="outline" className="border-slate-200 bg-white" onClick={toggleVisibleIssueSelection}>
                              {selectedVisibleIssueCount === visibleIssueIds.length && visibleIssueIds.length > 0 ? <Minus className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              {selectedVisibleIssueCount === visibleIssueIds.length && visibleIssueIds.length > 0 ? 'Clear visible' : 'Select visible'}
                            </Button>
                            {selectedIssueIds.length > 0 && (
                              <Button type="button" size="sm" variant="outline" className="border-slate-200 bg-white" onClick={() => setSelectedIssueIds([])}>
                                Clear selection
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <select
                            value={bulkStageTarget}
                            onChange={(event) => setBulkStageTarget(event.target.value as ActivityFlowStage | '')}
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                          >
                            <option value="">Move to stage</option>
                            {FLOW_STAGES.map((stage) => (
                              <option key={stage} value={stage}>{FLOW_STAGE_META[stage].label}</option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-sky-600 text-white hover:bg-sky-700"
                            disabled={!bulkStageTarget || selectedIssueIds.length === 0}
                            onClick={() => void applyBulkStageChange()}
                          >
                            Apply status
                          </Button>

                          <select
                            value={bulkAssigneeTarget}
                            onChange={(event) => setBulkAssigneeTarget(event.target.value)}
                            disabled={!selectedListRepoKey || selectedIssueIds.length === 0}
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="">{selectedListRepoKey ? 'Unassign selected' : 'Assign requires one repository'}</option>
                            {availableBulkAssignees.map((assignee) => (
                              <option key={assignee.login} value={assignee.login}>{assignee.full_name || assignee.login}</option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-slate-200 bg-white"
                            disabled={!selectedListRepoKey || selectedIssueIds.length === 0}
                            onClick={() => void applyBulkAssigneeChange()}
                          >
                            Apply assignee
                          </Button>
                        </div>
                      </div>

                      {FLOW_STAGES.map((stage) => (
                        <section
                          key={stage}
                          className="space-y-3"
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleStageDrop(event, stage);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${FLOW_STAGE_META[stage].color}` }} />
                              <h3 className="text-base font-semibold text-slate-900">{FLOW_STAGE_META[stage].label}</h3>
                            </div>
                            <Badge variant="outline" className="border-slate-200 text-slate-500">
                              {issuesByStage[stage].length}
                            </Badge>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            {issuesByStage[stage].length > 0 && (
                              <div className="grid grid-cols-[40px_minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_72px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                <div className="flex items-center justify-center">
                                  <input
                                    ref={listHeaderCheckboxRef}
                                    type="checkbox"
                                    checked={visibleIssueIds.length > 0 && selectedVisibleIssueCount === visibleIssueIds.length}
                                    onChange={toggleVisibleIssueSelection}
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                                  />
                                </div>
                                <div>Task</div>
                                <div>Repository</div>
                                <div>Project</div>
                                <div>Sprint</div>
                                <div>Assigned To</div>
                                <div className="text-right">Notes</div>
                              </div>
                            )}

                            {issuesByStage[stage].map((item) => (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={(event) => handleDragStart(event, item.id)}
                                onDragEnd={() => {
                                  setDraggedIssueId(null);
                                  setDraggedIssueIds([]);
                                }}
                                onClick={() => setSelectedIssueId(item.id)}
                                onDoubleClick={() => openTaskDialog(item.id)}
                                className={cn(
                                  'grid grid-cols-[40px_minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_72px] items-center gap-3 border-b border-slate-200 px-3 py-2 text-left transition last:border-b-0 hover:bg-sky-50/60',
                                  selectedIssueId === item.id ? 'bg-sky-50' : 'bg-white',
                                  selectedIssueIdSet.has(item.id) && 'bg-sky-50/80',
                                )}
                              >
                                <div className="flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedIssueIdSet.has(item.id)}
                                    onChange={(event) => selectIssue(item.id, event.target.checked)}
                                    onClick={(event) => event.stopPropagation()}
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium text-slate-900">{item.issue.title}</span>
                                    <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">#{item.issue.number}</span>
                                  </div>
                                  <div className="mt-1 truncate text-xs text-slate-400">{item.issue.state === 'closed' ? 'Closed' : 'Open'} task</div>
                                </div>
                                <div className="truncate text-sm text-slate-600">{item.repository.full_name}</div>
                                <div className="truncate text-sm text-slate-600">{issueProjectName(item.projectId)}</div>
                                <div className="truncate text-sm text-slate-600">{issueSprintName(item.sprintId)}</div>
                                <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                                  {item.issue.assignee?.avatar_url ? (
                                    <img
                                      src={item.issue.assignee.avatar_url}
                                      alt={item.issue.assignee.login}
                                      className="h-5 w-5 rounded-full border border-slate-200"
                                    />
                                  ) : (
                                    <UserCircle2 className="h-4 w-4 text-slate-400" />
                                  )}
                                  <span className="truncate">{issueAssignee(item.issue)}</span>
                                </div>
                                <div className="text-right text-xs text-slate-400">{item.issue.comments}</div>
                              </div>
                            ))}

                            {issuesByStage[stage].length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                                No tasks in {FLOW_STAGE_META[stage].label.toLowerCase()}.
                              </div>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
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
                {availableNewIssueSprints.map((sprint) => (
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
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Color</label>
              <input type="color" value={`#${normalizeHexColor(newProjectColor)}`} onChange={(event) => setNewProjectColor(event.target.value.replace('#', ''))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 py-1" />
            </div>
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
              <option value="">Select project</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <select value={newSprintClosureMode} onChange={(event) => setNewSprintClosureMode(event.target.value as ActivitySprintClosureMode)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="manual">Close manually</option>
              <option value="automatic">Close automatically by date</option>
            </select>
            {newSprintClosureMode === 'automatic' && (
              <Input type="date" value={newSprintEndDate} onChange={(event) => setNewSprintEndDate(event.target.value)} className="border-slate-200" />
            )}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Color</label>
              <input type="color" value={`#${normalizeHexColor(newSprintColor)}`} onChange={(event) => setNewSprintColor(event.target.value.replace('#', ''))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 py-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSprintOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSprint} disabled={!newSprintName.trim() || !newSprintProjectId || (newSprintClosureMode === 'automatic' && !newSprintEndDate)} className="bg-sky-600 text-white hover:bg-sky-700">
              <CalendarRange className="w-4 h-4 mr-2" /> Save sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlanningDialogOpen} onOpenChange={setIsPlanningDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden bg-white sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Planning Workspace</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(88vh-8rem)] pr-4">
            <div className="space-y-8 pb-1">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Projects</h3>
                    <p className="text-sm text-slate-500">Create project buckets and close them when the initiative is done.</p>
                  </div>
                  <Button type="button" className="bg-sky-600 text-white hover:bg-sky-700" onClick={() => setIsCreateProjectOpen(true)}>
                    <FolderPlus className="mr-2 h-4 w-4" /> New project
                  </Button>
                </div>

                <div className="grid gap-3">
                  {workspace.projects.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                      No projects created yet.
                    </div>
                  )}
                  {activeProjects.map((project) => (
                    <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${project.color}` }} />
                          <span className="text-sm font-semibold text-slate-900">{project.name}</span>
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Open</Badge>
                        </div>
                        {project.description && <div className="mt-1 text-xs text-slate-500">{project.description}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => openEditProject(project)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => toggleProjectClosed(project.id)}>
                          <Lock className="mr-2 h-4 w-4" /> Close project
                        </Button>
                      </div>
                    </div>
                  ))}
                  {closedProjects.map((project) => (
                    <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 opacity-80">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${project.color}` }} />
                          <span className="text-sm font-semibold text-slate-900">{project.name}</span>
                          <Badge variant="outline" className="border-slate-300 text-slate-500">Closed</Badge>
                        </div>
                        {project.description && <div className="mt-1 text-xs text-slate-500">{project.description}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => openEditProject(project)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => toggleProjectClosed(project.id)}>
                          <LockOpen className="mr-2 h-4 w-4" /> Reopen project
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Sprints</h3>
                    <p className="text-sm text-slate-500">Every sprint belongs to a project and can close manually or by time.</p>
                  </div>
                  <Button type="button" className="bg-sky-600 text-white hover:bg-sky-700" onClick={() => setIsCreateSprintOpen(true)} disabled={activeProjects.length === 0}>
                    <CalendarRange className="mr-2 h-4 w-4" /> New sprint
                  </Button>
                </div>

                {activeProjects.length === 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Create at least one open project before creating a sprint.
                  </div>
                )}

                <div className="grid gap-3">
                  {workspace.sprints.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                      No sprints created yet.
                    </div>
                  )}
                  {activeSprints.map((sprint) => (
                    <div key={sprint.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${sprint.color}` }} />
                          <span className="text-sm font-semibold text-slate-900">{sprint.name}</span>
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Open</Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Project: {getProjectDefinition(sprint.projectId)?.name || humanizeActivityId(sprint.projectId)}
                          {sprint.closureMode === 'automatic' && sprint.endDate ? ` · Auto closes on ${sprint.endDate}` : ' · Manual close'}
                        </div>
                        {sprint.goal && <div className="mt-1 text-xs text-slate-500">{sprint.goal}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => openEditSprint(sprint)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => toggleSprintClosed(sprint.id)}>
                          <Lock className="mr-2 h-4 w-4" /> Close sprint
                        </Button>
                      </div>
                    </div>
                  ))}
                  {closedSprints.map((sprint) => (
                    <div key={sprint.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 opacity-80">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${sprint.color}` }} />
                          <span className="text-sm font-semibold text-slate-900">{sprint.name}</span>
                          <Badge variant="outline" className="border-slate-300 text-slate-500">Closed</Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Project: {getProjectDefinition(sprint.projectId)?.name || humanizeActivityId(sprint.projectId)}
                          {sprint.closureMode === 'automatic' && sprint.endDate ? ` · Auto close date ${sprint.endDate}` : ' · Manual close'}
                        </div>
                        {sprint.goal && <div className="mt-1 text-xs text-slate-500">{sprint.goal}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => openEditSprint(sprint)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => toggleSprintClosed(sprint.id)}>
                          <LockOpen className="mr-2 h-4 w-4" /> Reopen sprint
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={editingProjectName} onChange={(event) => setEditingProjectName(event.target.value)} placeholder="Platform refresh" className="border-slate-200" />
            <Input value={editingProjectDescription} onChange={(event) => setEditingProjectDescription(event.target.value)} placeholder="What this project is coordinating" className="border-slate-200" />
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Color</label>
              <input type="color" value={`#${normalizeHexColor(editingProjectColor)}`} onChange={(event) => setEditingProjectColor(event.target.value.replace('#', ''))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 py-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProjectOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProject} disabled={!editingProjectName.trim()} className="bg-sky-600 text-white hover:bg-sky-700">
              <Edit3 className="w-4 h-4 mr-2" /> Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditSprintOpen} onOpenChange={setIsEditSprintOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Edit Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={editingSprintName} onChange={(event) => setEditingSprintName(event.target.value)} placeholder="Sprint 14" className="border-slate-200" />
            <Input value={editingSprintGoal} onChange={(event) => setEditingSprintGoal(event.target.value)} placeholder="Goal for this sprint" className="border-slate-200" />
            <select value={editingSprintProjectId} onChange={(event) => setEditingSprintProjectId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="">Select project</option>
              {workspace.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <select value={editingSprintClosureMode} onChange={(event) => setEditingSprintClosureMode(event.target.value as ActivitySprintClosureMode)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="manual">Close manually</option>
              <option value="automatic">Close automatically by date</option>
            </select>
            {editingSprintClosureMode === 'automatic' && (
              <Input type="date" value={editingSprintEndDate} onChange={(event) => setEditingSprintEndDate(event.target.value)} className="border-slate-200" />
            )}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Color</label>
              <input type="color" value={`#${normalizeHexColor(editingSprintColor)}`} onChange={(event) => setEditingSprintColor(event.target.value.replace('#', ''))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 py-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSprintOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSprint} disabled={!editingSprintName.trim() || !editingSprintProjectId || (editingSprintClosureMode === 'automatic' && !editingSprintEndDate)} className="bg-sky-600 text-white hover:bg-sky-700">
              <Edit3 className="w-4 h-4 mr-2" /> Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTaskDialogOpen && !!selectedIssue} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden bg-white sm:max-w-3xl">
          {selectedIssue && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedIssue.issue.title}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(88vh-8rem)] pr-4">
                <div className="space-y-5 pb-1">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Selected task</div>
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
                      <CardTitle>Assignment</CardTitle>
                      <CardDescription>Current developer responsible in Gitea.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                        {selectedIssue.issue.assignee?.avatar_url ? (
                          <img
                            src={selectedIssue.issue.assignee.avatar_url}
                            alt={selectedIssue.issue.assignee.login}
                            className="h-10 w-10 rounded-full border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                            <UserCircle2 className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-slate-900">{issueAssignee(selectedIssue.issue)}</div>
                          <div className="text-xs text-slate-500">
                            {selectedIssue.issue.assignee ? 'Assignee synced from the repository issue.' : 'No developer assigned yet.'}
                          </div>
                        </div>
                      </div>
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
                          {availableSelectedIssueSprints.map((sprint) => (
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
                      <MarkdownRenderer
                        content={selectedIssue.issue.body}
                        emptyFallback="_No issue description._"
                        className="text-sm"
                      />
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
