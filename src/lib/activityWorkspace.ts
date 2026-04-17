export type ActivityFlowStage = 'backlog' | 'in-progress' | 'review' | 'done';

export interface ActivityProject {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface ActivitySprint {
  id: string;
  name: string;
  color: string;
  goal?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ActivityWorkspace {
  projects: ActivityProject[];
  sprints: ActivitySprint[];
}

export const FLOW_LABEL_PREFIX = 'flow:';
export const PROJECT_LABEL_PREFIX = 'project:';
export const SPRINT_LABEL_PREFIX = 'sprint:';
const STORAGE_KEY = 'gitforge_activity_workspace_v1';

export const FLOW_STAGE_META: Record<ActivityFlowStage, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: '94a3b8' },
  'in-progress': { label: 'In Progress', color: '38bdf8' },
  review: { label: 'Review', color: 'f59e0b' },
  done: { label: 'Done', color: '22c55e' },
};

const EMPTY_WORKSPACE: ActivityWorkspace = {
  projects: [],
  sprints: [],
};

export function loadActivityWorkspace(): ActivityWorkspace {
  if (typeof window === 'undefined') {
    return EMPTY_WORKSPACE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_WORKSPACE;
    }

    const parsed = JSON.parse(raw) as Partial<ActivityWorkspace>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      sprints: Array.isArray(parsed.sprints) ? parsed.sprints : [],
    };
  } catch {
    return EMPTY_WORKSPACE;
  }
}

export function saveActivityWorkspace(workspace: ActivityWorkspace) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export function slugifyActivityName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function createUniqueActivityId(name: string, existingIds: string[]) {
  const base = slugifyActivityName(name);
  let candidate = base;
  let counter = 2;

  while (existingIds.includes(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

export function normalizeHexColor(color: string) {
  return color.replace(/[^a-fA-F0-9]/g, '').slice(0, 6).padEnd(6, '0');
}

export function getFlowLabelName(stage: ActivityFlowStage) {
  return `${FLOW_LABEL_PREFIX}${stage}`;
}

export function getProjectLabelName(projectId: string) {
  return `${PROJECT_LABEL_PREFIX}${projectId}`;
}

export function getSprintLabelName(sprintId: string) {
  return `${SPRINT_LABEL_PREFIX}${sprintId}`;
}

export function parseWorkspaceLabel(name: string) {
  if (name.startsWith(FLOW_LABEL_PREFIX)) {
    return { type: 'flow' as const, value: name.slice(FLOW_LABEL_PREFIX.length) };
  }

  if (name.startsWith(PROJECT_LABEL_PREFIX)) {
    return { type: 'project' as const, value: name.slice(PROJECT_LABEL_PREFIX.length) };
  }

  if (name.startsWith(SPRINT_LABEL_PREFIX)) {
    return { type: 'sprint' as const, value: name.slice(SPRINT_LABEL_PREFIX.length) };
  }

  return null;
}

export function isWorkspaceManagedLabel(name: string) {
  return Boolean(parseWorkspaceLabel(name));
}

export function humanizeActivityId(id: string) {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}