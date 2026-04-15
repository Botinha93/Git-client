import axios from 'axios';

export interface GiteaConfig {
  baseUrl: string;
  token: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  ssh_url: string;
  clone_url: string;
  website: string;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  archived?: boolean;
  has_issues?: boolean;
  has_wiki?: boolean;
  has_pull_requests?: boolean;
  topics?: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  owner: {
    id: number;
    login: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface FileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface Branch {
  name: string;
  commit: {
    id: number;
    sha: string;
    url: string;
  };
}

export interface GitTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
  url: string;
}

export interface GitTree {
  sha: string;
  url: string;
  truncated: boolean;
  tree: GitTreeItem[];
}

export interface Commit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  };
  parents: {
    sha: string;
    url: string;
  }[];
}

export type CommitStatusState = 'pending' | 'success' | 'error' | 'failure' | 'warning';

export interface CommitStatus {
  id?: number;
  state: CommitStatusState;
  target_url?: string;
  description?: string;
  context?: string;
  url?: string;
  creator?: GiteaUser;
  created_at?: string;
  updated_at?: string;
}

export interface CombinedCommitStatus {
  state: CommitStatusState;
  sha: string;
  total_count: number;
  statuses: CommitStatus[];
  repository?: Repository;
  commit_url?: string;
  url?: string;
}

export interface CompareResult {
  total_commits?: number;
  commits?: Commit[];
  files?: PullRequestFile[];
  compare_url?: string;
  html_url?: string;
  permalink_url?: string;
  base_commit?: Commit;
  merge_base_commit?: Commit;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  assignee?: {
    id: number;
    login: string;
    avatar_url: string;
  };
  labels: {
    id: number;
    name: string;
    color: string;
  }[];
  assets?: Attachment[];
  milestone?: Milestone;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface Milestone {
  id: number;
  title: string;
  description?: string;
  state: 'open' | 'closed';
  open_issues: number;
  closed_issues: number;
  due_on?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  mergeable?: boolean;
  merged_at?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  assignee?: {
    id: number;
    login: string;
    avatar_url: string;
  };
  labels: {
    id: number;
    name: string;
    color: string;
  }[];
  head: {
    label: string;
    ref: string;
    sha: string;
    repo?: Repository;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    repo?: Repository;
  };
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export type PullReviewState = 'APPROVED' | 'PENDING' | 'COMMENT' | 'REQUEST_CHANGES' | 'REQUEST_REVIEW' | '';

export interface PullReview {
  id: number;
  state: PullReviewState;
  body?: string;
  comments_count?: number;
  commit_id?: string;
  stale?: boolean;
  official?: boolean;
  dismissed?: boolean;
  html_url?: string;
  pull_request_url?: string;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
  reviewer?: GiteaUser;
  user?: GiteaUser;
}

export interface PullReviewComment {
  id: number;
  body: string;
  path: string;
  position?: number;
  original_position?: number;
  commit_id?: string;
  original_commit_id?: string;
  diff_hunk?: string;
  html_url?: string;
  user?: GiteaUser;
  created_at: string;
  updated_at?: string;
}

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
  created_at: string;
}

export interface Release {
  id: number;
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
  url: string;
  html_url: string;
  tarball_url: string;
  zipball_url: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at?: string;
  author: {
    id: number;
    login: string;
    avatar_url: string;
  };
  assets: ReleaseAsset[];
}

export interface RepositoryTag {
  id?: string;
  name: string;
  message?: string;
  tarball_url: string;
  zipball_url: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface WikiPageMeta {
  title: string;
  html_url: string;
  sub_url: string;
  last_commit?: {
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
}

export interface WikiPage extends WikiPageMeta {
  content?: string;
  content_base64?: string;
  footer?: string;
  sidebar?: string;
  commit_count?: number;
}

export interface Comment {
  id: number;
  body: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  assets?: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  name: string;
  size: number;
  uuid: string;
  browser_download_url: string;
  download_count: number;
  created_at: string;
}

export interface Reaction {
  content: string;
  user: GiteaUser;
  created_at: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface GiteaUser {
  id: number;
  login: string;
  username?: string;
  full_name: string;
  avatar_url: string;
  description?: string;
  email?: string;
  website?: string;
  location?: string;
  language?: string;
  visibility?: string;
  created?: string;
  last_login?: string;
}

export interface Collaborator extends GiteaUser {
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

export interface Contributor extends GiteaUser {
  contributions?: number;
}

export interface Organization {
  id: number;
  username: string;
  name: string;
  full_name: string;
  description: string;
  avatar_url: string;
  website: string;
  visibility: string;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  organization: Organization;
  permission: 'none' | 'read' | 'write' | 'admin' | 'owner';
  units?: string[];
  units_map?: Record<string, string>;
  can_create_org_repo?: boolean;
  includes_all_repositories?: boolean;
}

export interface Hook {
  id: number;
  type: string;
  active: boolean;
  config: Record<string, string>;
  events: string[];
  branch_filter?: string;
  created_at: string;
  updated_at: string;
}

export interface DeployKey {
  id: number;
  key_id?: number;
  key: string;
  title: string;
  fingerprint?: string;
  url: string;
  read_only?: boolean;
  repository?: Repository;
  created_at: string;
}

export interface BranchProtection {
  branch_name?: string;
  protected_branch_name?: string;
  enable_push?: boolean;
  enable_push_whitelist?: boolean;
  push_whitelist_usernames?: string[];
  push_whitelist_teams?: string[];
  enable_merge_whitelist?: boolean;
  merge_whitelist_usernames?: string[];
  merge_whitelist_teams?: string[];
  enable_status_check?: boolean;
  status_check_contexts?: string[];
  required_approvals?: number;
  approvals_whitelist_username?: string[];
  approvals_whitelist_teams?: string[];
  block_on_rejected_reviews?: boolean;
  block_on_official_review_requests?: boolean;
  block_on_outdated_branch?: boolean;
  dismiss_stale_approvals?: boolean;
  require_signed_commits?: boolean;
  protected_file_patterns?: string;
  unprotected_file_patterns?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SearchResponse<T> {
  ok: boolean;
  data: T[];
}

export interface PublicKey {
  id: number;
  key: string;
  title: string;
  fingerprint: string;
  url: string;
  created_at: string;
}

export interface AccessToken {
  id?: number;
  name: string;
  sha1?: string;
  token_last_eight?: string;
  scopes?: string[];
}

export interface EmailAddress {
  email: string;
  verified: boolean;
  primary: boolean;
  user_id?: number;
}

export interface GpgKey {
  id: number;
  key_id: string;
  primary_key_id: string;
  public_key: string;
  emails: {
    email: string;
    verified: boolean;
  }[];
  subkeys: {
    id: number;
    key_id: string;
    public_key: string;
  }[];
  can_sign: boolean;
  can_encrypt_comms: boolean;
  can_encrypt_storage: boolean;
  can_certify: boolean;
  created_at: string;
  expires_at?: string;
}

export interface NotificationSubject {
  title: string;
  type: string;
  state?: string;
  latest_comment_url?: string;
  url: string;
  html_url?: string;
}

export interface NotificationThread {
  id: number;
  pinned: boolean;
  unread: boolean;
  updated_at: string;
  url: string;
  repository: Repository;
  subject: NotificationSubject;
}

export interface Stopwatch {
  created: string;
  issue_index: number;
  issue_title: string;
  repo_name: string;
  repo_owner_name: string;
  seconds: number;
}

export interface TrackedTime {
  id: number;
  created: string;
  time: number;
  user_id?: number;
  user_name?: string;
  issue_id?: number;
  issue?: Issue;
}

export class GiteaService {
  private config: GiteaConfig;

  constructor(config: GiteaConfig) {
    this.config = config;
  }

  private async request(method: string, endpoint: string, data?: any, params?: any) {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    const response = await axios({
      method: 'POST', // Always POST to our proxy
      url: '/api/proxy',
      data,
      params,
      headers: {
        'x-target-url': url,
        'x-gitea-token': this.config.token,
        'x-proxy-method': method,
      },
    });
    return response.data;
  }

  private async requestForm(method: string, endpoint: string, formData: FormData, params?: any) {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    const response = await axios({
      method: 'POST',
      url: '/api/proxy',
      data: formData,
      params,
      headers: {
        'x-target-url': url,
        'x-gitea-token': this.config.token,
        'x-proxy-method': method,
        'x-proxy-body-type': 'form-data',
      },
    });
    return response.data;
  }

  async getUser() {
    return this.request('GET', '/user') as Promise<GiteaUser>;
  }

  async updateUserSettings(data: {
    full_name?: string;
    description?: string;
    website?: string;
    location?: string;
    language?: string;
    visibility?: string;
  }) {
    return this.request('PATCH', '/user/settings', data) as Promise<GiteaUser>;
  }

  async getNotifications(params?: { all?: boolean; pinned?: boolean; status_types?: string[]; since?: string; before?: string; page?: number; limit?: number }) {
    return this.request('GET', '/notifications', null, params) as Promise<NotificationThread[]>;
  }

  async markNotificationsRead(data?: { last_read_at?: string; status_types?: string[]; to_status?: 'read' | 'pinned' | 'unread' }) {
    return this.request('PUT', '/notifications', data || {});
  }

  async markNotificationThread(threadId: number, data: { to_status: 'read' | 'pinned' | 'unread' }) {
    return this.request('PATCH', `/notifications/threads/${threadId}`, data) as Promise<NotificationThread>;
  }

  async getPublicKeys() {
    return this.request('GET', '/user/keys') as Promise<PublicKey[]>;
  }

  async createPublicKey(data: { title: string; key: string }) {
    return this.request('POST', '/user/keys', data) as Promise<PublicKey>;
  }

  async deletePublicKey(id: number) {
    return this.request('DELETE', `/user/keys/${id}`);
  }

  async getEmails() {
    return this.request('GET', '/user/emails') as Promise<EmailAddress[]>;
  }

  async addEmails(emails: string[]) {
    return this.request('POST', '/user/emails', { emails }) as Promise<EmailAddress[]>;
  }

  async deleteEmails(emails: string[]) {
    return this.request('DELETE', '/user/emails', { emails });
  }

  async getGpgKeys() {
    return this.request('GET', '/user/gpg_keys') as Promise<GpgKey[]>;
  }

  async createGpgKey(data: { armored_public_key: string; armored_signature?: string }) {
    return this.request('POST', '/user/gpg_keys', data) as Promise<GpgKey>;
  }

  async deleteGpgKey(id: number) {
    return this.request('DELETE', `/user/gpg_keys/${id}`);
  }

  async getFollowers() {
    return this.request('GET', '/user/followers') as Promise<GiteaUser[]>;
  }

  async getFollowing() {
    return this.request('GET', '/user/following') as Promise<GiteaUser[]>;
  }

  async isFollowing(username: string) {
    try {
      await this.request('GET', `/user/following/${encodeURIComponent(username)}`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) return false;
      throw error;
    }
  }

  async followUser(username: string) {
    return this.request('PUT', `/user/following/${encodeURIComponent(username)}`);
  }

  async unfollowUser(username: string) {
    return this.request('DELETE', `/user/following/${encodeURIComponent(username)}`);
  }

  async getStarredRepositories() {
    return this.request('GET', '/user/starred') as Promise<Repository[]>;
  }

  async getWatchedRepositories() {
    return this.request('GET', '/user/subscriptions') as Promise<Repository[]>;
  }

  async getStopwatches() {
    return this.request('GET', '/user/stopwatches') as Promise<Stopwatch[]>;
  }

  async getUserTrackedTimes(params?: { since?: string; before?: string; page?: number; limit?: number }) {
    return this.request('GET', '/user/times', null, params) as Promise<TrackedTime[]>;
  }

  async getAccessTokens(username: string) {
    return this.request('GET', `/users/${encodeURIComponent(username)}/tokens`) as Promise<AccessToken[]>;
  }

  async createAccessToken(username: string, data: { name: string; scopes?: string[] }) {
    return this.request('POST', `/users/${encodeURIComponent(username)}/tokens`, data) as Promise<AccessToken>;
  }

  async deleteAccessToken(username: string, token: string) {
    return this.request('DELETE', `/users/${encodeURIComponent(username)}/tokens/${encodeURIComponent(token)}`);
  }

  async getRepositories() {
    return this.request('GET', '/user/repos') as Promise<Repository[]>;
  }

  async createRepository(data: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    default_branch?: string;
    gitignores?: string;
    issue_labels?: string;
    license?: string;
    readme?: string;
    template?: boolean;
    trust_model?: string;
  }) {
    return this.request('POST', '/user/repos', data) as Promise<Repository>;
  }

  async searchRepositories(params: { q?: string; uid?: number; owner?: string; page?: number; limit?: number }) {
    return this.request('GET', '/repos/search', null, params) as Promise<SearchResponse<Repository>>;
  }

  async searchUsers(params: { q?: string; uid?: number; page?: number; limit?: number }) {
    return this.request('GET', '/users/search', null, params) as Promise<SearchResponse<GiteaUser>>;
  }

  async getUserRepositories(username: string) {
    return this.request('GET', `/users/${encodeURIComponent(username)}/repos`) as Promise<Repository[]>;
  }

  async getOrganizations() {
    return this.request('GET', '/user/orgs') as Promise<Organization[]>;
  }

  async createOrganization(data: {
    username: string;
    full_name?: string;
    description?: string;
    website?: string;
    location?: string;
    visibility?: 'public' | 'limited' | 'private';
    repo_admin_change_team_access?: boolean;
  }) {
    return this.request('POST', '/orgs', data) as Promise<Organization>;
  }

  async getOrganization(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}`) as Promise<Organization>;
  }

  async updateOrganization(org: string, data: {
    full_name?: string;
    description?: string;
    website?: string;
    location?: string;
    visibility?: 'public' | 'limited' | 'private';
    repo_admin_change_team_access?: boolean;
  }) {
    return this.request('PATCH', `/orgs/${encodeURIComponent(org)}`, data) as Promise<Organization>;
  }

  async deleteOrganization(org: string) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}`);
  }

  async checkOrganizationMembership(org: string, username: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/members/${encodeURIComponent(username)}`);
  }

  async checkOrganizationPublicMembership(org: string, username: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/public_members/${encodeURIComponent(username)}`);
  }

  async getOrganizationRepositories(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/repos`) as Promise<Repository[]>;
  }

  async getOrganizationLabels(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/labels`) as Promise<Label[]>;
  }

  async createOrganizationLabel(org: string, data: { name: string; color: string; description?: string }) {
    return this.request('POST', `/orgs/${encodeURIComponent(org)}/labels`, data) as Promise<Label>;
  }

  async updateOrganizationLabel(org: string, id: number, data: { name?: string; color?: string; description?: string }) {
    return this.request('PATCH', `/orgs/${encodeURIComponent(org)}/labels/${id}`, data) as Promise<Label>;
  }

  async deleteOrganizationLabel(org: string, id: number) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/labels/${id}`);
  }

  async getOrganizationHooks(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/hooks`) as Promise<Hook[]>;
  }

  async createOrganizationHook(org: string, data: {
    type: string;
    config: Record<string, string>;
    events?: string[];
    active?: boolean;
    branch_filter?: string;
  }) {
    return this.request('POST', `/orgs/${encodeURIComponent(org)}/hooks`, data) as Promise<Hook>;
  }

  async updateOrganizationHook(org: string, id: number, data: {
    config?: Record<string, string>;
    events?: string[];
    active?: boolean;
    branch_filter?: string;
  }) {
    return this.request('PATCH', `/orgs/${encodeURIComponent(org)}/hooks/${id}`, data) as Promise<Hook>;
  }

  async deleteOrganizationHook(org: string, id: number) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/hooks/${id}`);
  }

  async createOrganizationRepository(org: string, data: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    default_branch?: string;
  }) {
    return this.request('POST', `/orgs/${encodeURIComponent(org)}/repos`, data) as Promise<Repository>;
  }

  async getOrganizationMembers(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/members`) as Promise<GiteaUser[]>;
  }

  async getOrganizationPublicMembers(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/public_members`) as Promise<GiteaUser[]>;
  }

  async removeOrganizationMember(org: string, username: string) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/members/${encodeURIComponent(username)}`);
  }

  async publicizeOrganizationMembership(org: string, username: string) {
    return this.request('PUT', `/orgs/${encodeURIComponent(org)}/public_members/${encodeURIComponent(username)}`);
  }

  async concealOrganizationMembership(org: string, username: string) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/public_members/${encodeURIComponent(username)}`);
  }

  async getOrganizationTeams(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/teams`) as Promise<Team[]>;
  }

  async createOrganizationTeam(org: string, data: {
    name: string;
    description?: string;
    permission?: 'read' | 'write' | 'admin';
    units?: string[];
    can_create_org_repo?: boolean;
    includes_all_repositories?: boolean;
  }) {
    return this.request('POST', `/orgs/${encodeURIComponent(org)}/teams`, data) as Promise<Team>;
  }

  async updateTeam(teamId: number, data: {
    name?: string;
    description?: string;
    permission?: 'read' | 'write' | 'admin';
    units?: string[];
    can_create_org_repo?: boolean;
    includes_all_repositories?: boolean;
  }) {
    return this.request('PATCH', `/teams/${teamId}`, data) as Promise<Team>;
  }

  async deleteTeam(teamId: number) {
    return this.request('DELETE', `/teams/${teamId}`);
  }

  async getTeamMembers(teamId: number) {
    return this.request('GET', `/teams/${teamId}/members`) as Promise<GiteaUser[]>;
  }

  async addTeamMember(teamId: number, username: string) {
    return this.request('PUT', `/teams/${teamId}/members/${encodeURIComponent(username)}`);
  }

  async removeTeamMember(teamId: number, username: string) {
    return this.request('DELETE', `/teams/${teamId}/members/${encodeURIComponent(username)}`);
  }

  async getTeamRepositories(teamId: number) {
    return this.request('GET', `/teams/${teamId}/repos`) as Promise<Repository[]>;
  }

  async addTeamRepository(teamId: number, owner: string, repo: string) {
    return this.request('PUT', `/teams/${teamId}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  async removeTeamRepository(teamId: number, owner: string, repo: string) {
    return this.request('DELETE', `/teams/${teamId}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  async getRepository(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}`) as Promise<Repository>;
  }

  async getRepositoryForks(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/forks`, null, params) as Promise<Repository[]>;
  }

  async getRepositoryContributors(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/contributors`, null, params) as Promise<Contributor[]>;
  }

  async getRepositoryLanguages(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/languages`) as Promise<Record<string, number>>;
  }

  async getRepositoryStargazers(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/stargazers`, null, params) as Promise<GiteaUser[]>;
  }

  async getRepositorySubscribers(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/subscribers`, null, params) as Promise<GiteaUser[]>;
  }

  async createRepositoryFork(owner: string, repo: string, data?: { organization?: string; name?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/forks`, data || {}) as Promise<Repository>;
  }

  async getRepositoryTopics(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/topics`) as Promise<{ topics: string[] }>;
  }

  async replaceRepositoryTopics(owner: string, repo: string, topics: string[]) {
    return this.request('PUT', `/repos/${owner}/${repo}/topics`, { topics }) as Promise<{ topics: string[] }>;
  }

  async addRepositoryTopic(owner: string, repo: string, topic: string) {
    return this.request('PUT', `/repos/${owner}/${repo}/topics/${encodeURIComponent(topic)}`);
  }

  async deleteRepositoryTopic(owner: string, repo: string, topic: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/topics/${encodeURIComponent(topic)}`);
  }

  async updateRepository(owner: string, repo: string, data: {
    name?: string;
    description?: string;
    website?: string;
    private?: boolean;
    archived?: boolean;
    has_issues?: boolean;
    has_wiki?: boolean;
    has_pull_requests?: boolean;
    default_branch?: string;
  }) {
    return this.request('PATCH', `/repos/${owner}/${repo}`, data) as Promise<Repository>;
  }

  async deleteRepository(owner: string, repo: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}`);
  }

  async transferRepository(owner: string, repo: string, data: { new_owner: string; team_ids?: number[] }) {
    return this.request('POST', `/repos/${owner}/${repo}/transfer`, data);
  }

  async acceptRepositoryTransfer(owner: string, repo: string) {
    return this.request('POST', `/repos/${owner}/${repo}/transfer/accept`, {});
  }

  async rejectRepositoryTransfer(owner: string, repo: string) {
    return this.request('POST', `/repos/${owner}/${repo}/transfer/reject`, {});
  }

  async isStarred(owner: string, repo: string) {
    try {
      await this.request('GET', `/user/starred/${owner}/${repo}`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) return false;
      throw error;
    }
  }

  async starRepository(owner: string, repo: string) {
    return this.request('PUT', `/user/starred/${owner}/${repo}`);
  }

  async unstarRepository(owner: string, repo: string) {
    return this.request('DELETE', `/user/starred/${owner}/${repo}`);
  }

  async isWatching(owner: string, repo: string) {
    try {
      await this.request('GET', `/repos/${owner}/${repo}/subscription`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) return false;
      throw error;
    }
  }

  async watchRepository(owner: string, repo: string) {
    return this.request('PUT', `/repos/${owner}/${repo}/subscription`);
  }

  async unwatchRepository(owner: string, repo: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/subscription`);
  }

  async getContents(owner: string, repo: string, path: string = '', ref?: string) {
    return this.request('GET', `/repos/${owner}/${repo}/contents/${path}`, null, { ref }) as Promise<FileContent | FileContent[]>;
  }

  async getBranches(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/branches`) as Promise<Branch[]>;
  }

  async getGitTree(owner: string, repo: string, sha: string, recursive = true) {
    return this.request('GET', `/repos/${owner}/${repo}/git/trees/${sha}`, null, { recursive }) as Promise<GitTree>;
  }

  async createBranch(owner: string, repo: string, data: { new_branch_name: string; old_branch_name?: string; old_ref_name?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/branches`, data) as Promise<Branch>;
  }

  async deleteBranch(owner: string, repo: string, branch: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
  }

  async getCommits(owner: string, repo: string, sha?: string) {
    return this.request('GET', `/repos/${owner}/${repo}/commits`, null, { sha }) as Promise<Commit[]>;
  }

  async compareCommits(owner: string, repo: string, base: string, head: string) {
    return this.request('GET', `/repos/${owner}/${repo}/compare/${encodeURIComponent(`${base}...${head}`)}`) as Promise<CompareResult>;
  }

  async getCommitStatuses(owner: string, repo: string, sha: string, params?: { sort?: string; state?: CommitStatusState; page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/statuses/${encodeURIComponent(sha)}`, null, params) as Promise<CommitStatus[]>;
  }

  async getCombinedCommitStatus(owner: string, repo: string, ref: string) {
    return this.request('GET', `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/status`) as Promise<CombinedCommitStatus>;
  }

  async createCommitStatus(owner: string, repo: string, sha: string, data: {
    state: CommitStatusState;
    target_url?: string;
    description?: string;
    context?: string;
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/statuses/${encodeURIComponent(sha)}`, data) as Promise<CommitStatus>;
  }

  async updateFile(owner: string, repo: string, path: string, data: {
    content: string; // base64
    sha: string;
    message: string;
    branch?: string;
    author?: { name: string; email: string };
    committer?: { name: string; email: string };
  }) {
    return this.request('PUT', `/repos/${owner}/${repo}/contents/${path}`, data);
  }

  async createFile(owner: string, repo: string, path: string, data: {
    content: string; // base64
    message: string;
    branch?: string;
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/contents/${path}`, data);
  }

  async deleteFile(owner: string, repo: string, path: string, data: {
    sha: string;
    message: string;
    branch?: string;
  }) {
    return this.request('DELETE', `/repos/${owner}/${repo}/contents/${path}`, data);
  }

  async getIssues(owner: string, repo: string, params?: any) {
    return this.request('GET', `/repos/${owner}/${repo}/issues`, null, params) as Promise<Issue[]>;
  }

  async getIssue(owner: string, repo: string, index: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/${index}`) as Promise<Issue>;
  }

  async createIssue(owner: string, repo: string, data: { title: string; body?: string; assignees?: string[]; labels?: number[]; milestone?: number }) {
    return this.request('POST', `/repos/${owner}/${repo}/issues`, data) as Promise<Issue>;
  }

  async updateIssue(owner: string, repo: string, index: number, data: { title?: string; body?: string; state?: 'open' | 'closed'; assignees?: string[]; labels?: number[]; milestone?: number | null }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/issues/${index}`, data) as Promise<Issue>;
  }

  async getIssueComments(owner: string, repo: string, index: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/${index}/comments`) as Promise<Comment[]>;
  }

  async createIssueComment(owner: string, repo: string, index: number, body: string) {
    return this.request('POST', `/repos/${owner}/${repo}/issues/${index}/comments`, { body }) as Promise<Comment>;
  }

  async updateIssueComment(owner: string, repo: string, id: number, body: string) {
    return this.request('PATCH', `/repos/${owner}/${repo}/issues/comments/${id}`, { body }) as Promise<Comment>;
  }

  async deleteIssueComment(owner: string, repo: string, id: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/comments/${id}`);
  }

  async getIssueTrackedTimes(owner: string, repo: string, index: number, params?: { user?: string; since?: string; before?: string; page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/${index}/times`, null, params) as Promise<TrackedTime[]>;
  }

  async addIssueTrackedTime(owner: string, repo: string, index: number, data: { time: number; created?: string; user_name?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/issues/${index}/times`, data) as Promise<TrackedTime>;
  }

  async resetIssueTrackedTimes(owner: string, repo: string, index: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/${index}/times`);
  }

  async deleteIssueTrackedTime(owner: string, repo: string, index: number, timeId: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/${index}/times/${timeId}`);
  }

  async startIssueStopwatch(owner: string, repo: string, index: number) {
    return this.request('POST', `/repos/${owner}/${repo}/issues/${index}/stopwatch/start`);
  }

  async stopIssueStopwatch(owner: string, repo: string, index: number) {
    return this.request('POST', `/repos/${owner}/${repo}/issues/${index}/stopwatch/stop`);
  }

  async deleteIssueStopwatch(owner: string, repo: string, index: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/${index}/stopwatch/delete`);
  }

  async getIssueAttachments(owner: string, repo: string, index: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/${index}/assets`) as Promise<Attachment[]>;
  }

  async createIssueAttachment(owner: string, repo: string, index: number, file: File, name?: string) {
    const formData = new FormData();
    formData.append('attachment', file);
    return this.requestForm('POST', `/repos/${owner}/${repo}/issues/${index}/assets`, formData, { name: name || file.name }) as Promise<Attachment>;
  }

  async getIssueAttachment(owner: string, repo: string, index: number, attachmentId: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/${index}/assets/${attachmentId}`) as Promise<Attachment>;
  }

  async updateIssueAttachment(owner: string, repo: string, index: number, attachmentId: number, data: { name: string }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/issues/${index}/assets/${attachmentId}`, data) as Promise<Attachment>;
  }

  async deleteIssueAttachment(owner: string, repo: string, index: number, attachmentId: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/${index}/assets/${attachmentId}`);
  }

  async getIssueCommentAttachments(owner: string, repo: string, id: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/comments/${id}/assets`) as Promise<Attachment[]>;
  }

  async createIssueCommentAttachment(owner: string, repo: string, id: number, file: File, name?: string) {
    const formData = new FormData();
    formData.append('attachment', file);
    return this.requestForm('POST', `/repos/${owner}/${repo}/issues/comments/${id}/assets`, formData, { name: name || file.name }) as Promise<Attachment>;
  }

  async getIssueCommentAttachment(owner: string, repo: string, id: number, attachmentId: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/comments/${id}/assets/${attachmentId}`) as Promise<Attachment>;
  }

  async updateIssueCommentAttachment(owner: string, repo: string, id: number, attachmentId: number, data: { name: string }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/issues/comments/${id}/assets/${attachmentId}`, data) as Promise<Attachment>;
  }

  async deleteIssueCommentAttachment(owner: string, repo: string, id: number, attachmentId: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/comments/${id}/assets/${attachmentId}`);
  }

  async getIssueReactions(owner: string, repo: string, index: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/${index}/reactions`) as Promise<Reaction[]>;
  }

  async createIssueReaction(owner: string, repo: string, index: number, content: string) {
    return this.request('POST', `/repos/${owner}/${repo}/issues/${index}/reactions`, { content }) as Promise<Reaction>;
  }

  async deleteIssueReaction(owner: string, repo: string, index: number, content: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/${index}/reactions`, { content });
  }

  async getIssueCommentReactions(owner: string, repo: string, id: number) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/comments/${id}/reactions`) as Promise<Reaction[]>;
  }

  async createIssueCommentReaction(owner: string, repo: string, id: number, content: string) {
    return this.request('POST', `/repos/${owner}/${repo}/issues/comments/${id}/reactions`, { content }) as Promise<Reaction>;
  }

  async deleteIssueCommentReaction(owner: string, repo: string, id: number, content: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/issues/comments/${id}/reactions`, { content });
  }

  async getPullRequests(owner: string, repo: string, params?: { state?: 'open' | 'closed' | 'all'; page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls`, null, params) as Promise<PullRequest[]>;
  }

  async getPullRequest(owner: string, repo: string, index: number) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${index}`) as Promise<PullRequest>;
  }

  async getPullRequestByBaseHead(owner: string, repo: string, base: string, head: string) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${encodeURIComponent(base)}/${encodeURIComponent(head)}`) as Promise<PullRequest>;
  }

  async createPullRequest(owner: string, repo: string, data: {
    title: string;
    body?: string;
    head: string;
    base: string;
    assignee?: string;
    assignees?: string[];
    labels?: number[];
    milestone?: number;
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls`, data) as Promise<PullRequest>;
  }

  async updatePullRequest(owner: string, repo: string, index: number, data: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    base?: string;
    assignee?: string;
    assignees?: string[];
    labels?: number[];
    milestone?: number;
  }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/pulls/${index}`, data) as Promise<PullRequest>;
  }

  async mergePullRequest(owner: string, repo: string, index: number, data?: {
    do?: 'merge' | 'rebase' | 'rebase-merge' | 'squash' | 'manually-merged';
    merge_title_field?: string;
    merge_message_field?: string;
    delete_branch_after_merge?: boolean;
    force_merge?: boolean;
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${index}/merge`, data || {});
  }

  async isPullRequestMerged(owner: string, repo: string, index: number) {
    try {
      await this.request('GET', `/repos/${owner}/${repo}/pulls/${index}/merge`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) return false;
      throw error;
    }
  }

  async cancelPullRequestAutoMerge(owner: string, repo: string, index: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/pulls/${index}/merge`);
  }

  async updatePullRequestBranch(owner: string, repo: string, index: number, style?: 'merge' | 'rebase') {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${index}/update`, {}, { style });
  }

  async getPullRequestFiles(owner: string, repo: string, index: number) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${index}/files`) as Promise<PullRequestFile[]>;
  }

  async requestPullRequestReviewers(owner: string, repo: string, index: number, data: { reviewers?: string[]; team_reviewers?: string[] }) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${index}/requested_reviewers`, data) as Promise<PullReview[]>;
  }

  async cancelPullRequestReviewers(owner: string, repo: string, index: number, data: { reviewers?: string[]; team_reviewers?: string[] }) {
    return this.request('DELETE', `/repos/${owner}/${repo}/pulls/${index}/requested_reviewers`, data);
  }

  async getPullRequestReviews(owner: string, repo: string, index: number, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${index}/reviews`, null, params) as Promise<PullReview[]>;
  }

  async getPullRequestReview(owner: string, repo: string, index: number, reviewId: number) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}`) as Promise<PullReview>;
  }

  async createPullRequestReview(owner: string, repo: string, index: number, data: {
    body?: string;
    commit_id?: string;
    event?: PullReviewState;
    comments?: {
      path: string;
      position?: number;
      old_position?: number;
      new_position?: number;
      body: string;
    }[];
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${index}/reviews`, data) as Promise<PullReview>;
  }

  async submitPullRequestReview(owner: string, repo: string, index: number, reviewId: number, data: { body?: string; event: PullReviewState }) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}`, data) as Promise<PullReview>;
  }

  async deletePullRequestReview(owner: string, repo: string, index: number, reviewId: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}`);
  }

  async getPullRequestReviewComments(owner: string, repo: string, index: number, reviewId: number) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}/comments`) as Promise<PullReviewComment[]>;
  }

  async dismissPullRequestReview(owner: string, repo: string, index: number, reviewId: number, data: { message: string; priors?: boolean }) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}/dismissals`, data) as Promise<PullReview>;
  }

  async undismissPullRequestReview(owner: string, repo: string, index: number, reviewId: number) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}/undismissals`, {}) as Promise<PullReview>;
  }

  async getReleases(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/releases`, null, params) as Promise<Release[]>;
  }

  async getLatestRelease(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/releases/latest`) as Promise<Release>;
  }

  async getRelease(owner: string, repo: string, id: number) {
    return this.request('GET', `/repos/${owner}/${repo}/releases/${id}`) as Promise<Release>;
  }

  async getReleaseByTag(owner: string, repo: string, tag: string) {
    return this.request('GET', `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`) as Promise<Release>;
  }

  async createRelease(owner: string, repo: string, data: {
    tag_name: string;
    target_commitish?: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/releases`, data) as Promise<Release>;
  }

  async updateRelease(owner: string, repo: string, id: number, data: {
    tag_name?: string;
    target_commitish?: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
  }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/releases/${id}`, data) as Promise<Release>;
  }

  async deleteRelease(owner: string, repo: string, id: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/releases/${id}`);
  }

  async getReleaseAssets(owner: string, repo: string, id: number) {
    return this.request('GET', `/repos/${owner}/${repo}/releases/${id}/assets`) as Promise<ReleaseAsset[]>;
  }

  async createReleaseAsset(owner: string, repo: string, id: number, file: File, name?: string) {
    const formData = new FormData();
    formData.append('attachment', file);
    return this.requestForm('POST', `/repos/${owner}/${repo}/releases/${id}/assets`, formData, { name: name || file.name }) as Promise<ReleaseAsset>;
  }

  async getReleaseAsset(owner: string, repo: string, id: number, attachmentId: number) {
    return this.request('GET', `/repos/${owner}/${repo}/releases/${id}/assets/${attachmentId}`) as Promise<ReleaseAsset>;
  }

  async updateReleaseAsset(owner: string, repo: string, id: number, attachmentId: number, data: { name: string }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/releases/${id}/assets/${attachmentId}`, data) as Promise<ReleaseAsset>;
  }

  async deleteReleaseAsset(owner: string, repo: string, id: number, attachmentId: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/releases/${id}/assets/${attachmentId}`);
  }

  async getTags(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/tags`, null, params) as Promise<RepositoryTag[]>;
  }

  async createTag(owner: string, repo: string, data: { tag_name: string; target?: string; message?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/tags`, data) as Promise<RepositoryTag>;
  }

  async deleteTag(owner: string, repo: string, tagName: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/tags/${encodeURIComponent(tagName)}`);
  }

  async getWikiPages(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/wiki/pages`) as Promise<WikiPageMeta[]>;
  }

  async getWikiPage(owner: string, repo: string, pageName: string) {
    return this.request('GET', `/repos/${owner}/${repo}/wiki/page/${encodeURIComponent(pageName)}`) as Promise<WikiPage>;
  }

  async createWikiPage(owner: string, repo: string, data: { title: string; content: string; message?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/wiki/new`, data) as Promise<WikiPage>;
  }

  async updateWikiPage(owner: string, repo: string, pageName: string, data: { title?: string; content?: string; message?: string }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/wiki/page/${encodeURIComponent(pageName)}`, data) as Promise<WikiPage>;
  }

  async deleteWikiPage(owner: string, repo: string, pageName: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/wiki/page/${encodeURIComponent(pageName)}`);
  }

  async getLabels(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/labels`) as Promise<Label[]>;
  }

  async createLabel(owner: string, repo: string, data: { name: string; color: string; description?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/labels`, data) as Promise<Label>;
  }

  async updateLabel(owner: string, repo: string, id: number, data: { name?: string; color?: string; description?: string }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/labels/${id}`, data) as Promise<Label>;
  }

  async deleteLabel(owner: string, repo: string, id: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/labels/${id}`);
  }

  async getMilestones(owner: string, repo: string, params?: { state?: 'open' | 'closed' | 'all'; page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/milestones`, null, params) as Promise<Milestone[]>;
  }

  async createMilestone(owner: string, repo: string, data: { title: string; description?: string; due_on?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/milestones`, data) as Promise<Milestone>;
  }

  async updateMilestone(owner: string, repo: string, id: number, data: { title?: string; description?: string; due_on?: string | null; state?: 'open' | 'closed' }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/milestones/${id}`, data) as Promise<Milestone>;
  }

  async deleteMilestone(owner: string, repo: string, id: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/milestones/${id}`);
  }

  async getRepoAssignees(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/assignees`) as Promise<GiteaUser[]>;
  }

  async getCollaborators(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/collaborators`) as Promise<Collaborator[]>;
  }

  async addCollaborator(owner: string, repo: string, username: string, data?: { permission?: 'read' | 'write' | 'admin' }) {
    return this.request('PUT', `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`, data || {});
  }

  async deleteCollaborator(owner: string, repo: string, username: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`);
  }

  async getRepositoryHooks(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/hooks`) as Promise<Hook[]>;
  }

  async createRepositoryHook(owner: string, repo: string, data: {
    type: string;
    config: Record<string, string>;
    events?: string[];
    active?: boolean;
    branch_filter?: string;
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/hooks`, data) as Promise<Hook>;
  }

  async updateRepositoryHook(owner: string, repo: string, id: number, data: {
    config?: Record<string, string>;
    events?: string[];
    active?: boolean;
    branch_filter?: string;
  }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/hooks/${id}`, data) as Promise<Hook>;
  }

  async deleteRepositoryHook(owner: string, repo: string, id: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/hooks/${id}`);
  }

  async getDeployKeys(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/keys`) as Promise<DeployKey[]>;
  }

  async createDeployKey(owner: string, repo: string, data: { title: string; key: string; read_only?: boolean }) {
    return this.request('POST', `/repos/${owner}/${repo}/keys`, data) as Promise<DeployKey>;
  }

  async deleteDeployKey(owner: string, repo: string, id: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/keys/${id}`);
  }

  async getBranchProtections(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/branch_protections`) as Promise<BranchProtection[]>;
  }

  async getBranchProtection(owner: string, repo: string, branch: string) {
    return this.request('GET', `/repos/${owner}/${repo}/branch_protections/${encodeURIComponent(branch)}`) as Promise<BranchProtection>;
  }

  async createBranchProtection(owner: string, repo: string, data: BranchProtection) {
    return this.request('POST', `/repos/${owner}/${repo}/branch_protections`, data) as Promise<BranchProtection>;
  }

  async updateBranchProtection(owner: string, repo: string, branch: string, data: BranchProtection) {
    return this.request('PATCH', `/repos/${owner}/${repo}/branch_protections/${encodeURIComponent(branch)}`, data) as Promise<BranchProtection>;
  }

  async deleteBranchProtection(owner: string, repo: string, branch: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/branch_protections/${encodeURIComponent(branch)}`);
  }
}
