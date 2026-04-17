import { ContentType, giteaApi } from 'gitea-js';

export interface GiteaConfig {
  baseUrl: string;
  token?: string;
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
  has_projects?: boolean;
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

export interface GitBlob {
  content: string;
  encoding: string;
  sha: string;
  size: number;
  url: string;
}

export interface GitRef {
  ref: string;
  url: string;
  object: {
    type: string;
    sha: string;
    url: string;
  };
}

export interface GitAnnotatedTag {
  tag: string;
  sha: string;
  url: string;
  message: string;
  object: {
    type: string;
    sha: string;
    url: string;
  };
  tagger?: {
    name: string;
    email: string;
    date: string;
  };
  verification?: {
    verified: boolean;
    reason?: string;
    signature?: string;
    payload?: string;
  };
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
  committer?: {
    login: string;
    avatar_url: string;
  };
  parents: {
    sha: string;
    url: string;
  }[];
  files?: PullRequestFile[];
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
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

export interface ActivityFeed {
  id: number;
  op_type: string;
  act_user?: GiteaUser;
  repo?: Repository;
  ref_name?: string;
  content?: string;
  created: string;
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

export interface PackageFile {
  id: number;
  name: string;
  size?: number;
  Size?: number;
  md5?: string;
  sha1?: string;
  sha256?: string;
  sha512?: string;
}

export interface PackageVersion {
  id: number;
  type: string;
  name: string;
  version: string;
  html_url?: string;
  metadata?: Record<string, any>;
  creator?: GiteaUser;
  repository?: Repository;
  created_at: string;
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

export interface RepositoryProject {
  id: number;
  title: string;
  description?: string;
  state?: string;
  board_type?: string;
  columns?: ProjectColumn[];
  created_at?: string;
  updated_at?: string;
}

export interface ProjectColumn {
  id: number;
  title: string;
  cards?: {
    id: number;
    note?: string;
  }[];
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
  active?: boolean;
  is_admin?: boolean;
  restricted?: boolean;
  prohibit_login?: boolean;
  login_name?: string;
  source_id?: number;
  max_repo_creation?: number;
  allow_create_organization?: boolean;
  allow_git_hook?: boolean;
  allow_import_local?: boolean;
  created?: string;
  last_login?: string;
}

export interface AdminCronTask {
  name: string;
  schedule?: string;
  next?: string;
  prev?: string;
  exec_times?: number;
  status?: string;
}

export interface AdminActionRunner {
  id: number | string;
  name?: string;
  os?: string;
  arch?: string;
  version?: string;
  description?: string;
  status?: string;
  busy?: boolean;
  labels?: string[];
}

export interface AdminActionJob {
  id: number;
  name: string;
  status?: string;
  conclusion?: string;
  head_branch?: string;
  head_sha?: string;
  run_id?: number;
  runner_id?: number;
  runner_name?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface AdminActionRun {
  id: number;
  name?: string;
  display_title?: string;
  event?: string;
  status?: string;
  conclusion?: string;
  head_branch?: string;
  head_sha?: string;
  created_at?: string;
  updated_at?: string;
  run_number?: number;
}

export interface ActionVariable {
  name: string;
  data?: string;
  description?: string;
  owner_id?: number;
  repo_id?: number;
}

export interface ActionSecret {
  name: string;
  description?: string;
  created_at?: string;
}

export interface ActionArtifact {
  id: number;
  name: string;
  size_in_bytes?: number;
  url?: string;
  archive_download_url?: string;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  expired?: boolean;
  workflow_run?: {
    id?: number;
    repository_id?: number;
    head_sha?: string;
  };
}

export interface ActionWorkflow {
  id: string;
  name?: string;
  path?: string;
  state?: string;
  badge_url?: string;
  html_url?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface UserBadge {
  id: number;
  slug: string;
  description?: string;
  image_url?: string;
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
  authorization_header?: string;
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

export interface PushMirror {
  repo_name: string;
  remote_name: string;
  remote_address: string;
  interval: string;
  sync_on_commit: boolean;
  created?: string;
  last_update?: string;
  last_error?: string;
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

export interface OAuth2Application {
  id: number;
  name: string;
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
  confidential_client?: boolean;
  created?: string;
}

export interface EmailAddress {
  email: string;
  verified: boolean;
  primary: boolean;
  user_id?: number;
  username?: string;
}

export interface ServerVersion {
  version: string;
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
  public readonly client: ReturnType<typeof giteaApi>;
  private swaggerPathSetPromise?: Promise<Set<string> | null>;
  private starredRepoSetPromise?: Promise<Set<string>>;
  private starredRepoSetCache?: Set<string>;

  constructor(config: GiteaConfig) {
    this.config = config;
    this.client = giteaApi(this.config.baseUrl.replace(/\/$/, ''), {
      customFetch: this.proxyFetch,
    });
  }

  private proxyFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestInit = init ?? {};
    const targetUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    const inputMethod = typeof input === 'string' || input instanceof URL ? undefined : input.method;
    const method = (requestInit.method || inputMethod || 'GET').toUpperCase();
    const inputHeaders = typeof input === 'string' || input instanceof URL ? undefined : input.headers;
    const mergedHeaders = new Headers(inputHeaders);
    const initHeaders = new Headers(requestInit.headers);
    initHeaders.forEach((value, key) => mergedHeaders.set(key, value));

    const body = requestInit.body ?? (typeof input === 'string' || input instanceof URL ? undefined : input.body);
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const proxyHeaders = new Headers();
    proxyHeaders.set('x-target-url', targetUrl);
    proxyHeaders.set('x-proxy-method', method);

    if (isFormData) {
      proxyHeaders.set('x-proxy-body-type', 'form-data');
    }

    const contentType = mergedHeaders.get('content-type');
    if (contentType && !isFormData) {
      proxyHeaders.set('content-type', contentType);
    }

    const accept = mergedHeaders.get('accept');
    if (accept) {
      proxyHeaders.set('accept', accept);
    }

    return fetch('/api/proxy', {
      method: 'POST',
      headers: proxyHeaders,
      credentials: 'same-origin',
      body: ['GET', 'HEAD'].includes(method) ? undefined : body,
    });
  };

  private async sdkRequest<T>(requestPromise: Promise<{ data: T }>) {
    const response = await requestPromise;
    return response.data;
  }

  private async request(method: string, endpoint: string, data?: any, params?: any) {
    return this.sdkRequest(this.client.request({
      path: endpoint,
      method: method as any,
      body: data,
      query: params,
      type: ContentType.Json,
      format: 'json',
      secure: true,
    }));
  }

  private async requestForm(method: string, endpoint: string, formData: FormData, params?: any) {
    return this.sdkRequest(this.client.request({
      path: endpoint,
      method: method as any,
      body: formData,
      query: params,
      type: ContentType.FormData,
      format: 'json',
      secure: true,
    }));
  }

  private async requestText(method: string, endpoint: string, data?: any, params?: any) {
    return this.sdkRequest(this.client.request<string>({
      path: endpoint,
      method: method as any,
      body: data,
      query: params,
      format: 'text',
      secure: true,
    }));
  }

  private normalizeEndpointPattern(path: string) {
    return path
      .replace(/\{[^}]+\}/g, '{param}')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  }

  private async getSwaggerPathSet() {
    if (!this.swaggerPathSetPromise) {
      this.swaggerPathSetPromise = this.proxyFetch(`${this.config.baseUrl.replace(/\/$/, '')}/api/v1/swagger.v1.json`, { method: 'GET' })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load swagger: ${response.status}`);
          }
          const data = await response.json();
          const paths = Object.keys(data?.paths || {});
          return new Set(paths.map((path) => this.normalizeEndpointPattern(path)));
        })
        .catch(() => null);
    }

    return this.swaggerPathSetPromise;
  }

  private async isEndpointAvailable(pathTemplate: string) {
    const pathSet = await this.getSwaggerPathSet();
    if (!pathSet) {
      // Fail closed for optional/feature-detection calls to avoid noisy unsupported requests.
      return false;
    }
    return pathSet.has(this.normalizeEndpointPattern(pathTemplate));
  }

  async isProjectsSupported() {
    return this.isEndpointAvailable('/repos/{owner}/{repo}/projects');
  }

  private getRepoCacheKey(owner: string, repo: string) {
    return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  }

  private async getStarredRepoSet(forceRefresh = false) {
    if (!forceRefresh && this.starredRepoSetCache) {
      return this.starredRepoSetCache;
    }

    if (forceRefresh || !this.starredRepoSetPromise) {
      this.starredRepoSetPromise = this.getStarredRepositories()
        .then((repos) => {
          const set = new Set(repos.map((repo) => this.getRepoCacheKey(repo.owner.login, repo.name)));
          this.starredRepoSetCache = set;
          return set;
        })
        .catch(() => {
          const empty = new Set<string>();
          this.starredRepoSetCache = empty;
          return empty;
        });
    }

    return this.starredRepoSetPromise;
  }

  async getUser() {
    return this.sdkRequest(this.client.user.userGetCurrent()) as Promise<GiteaUser>;
  }

  async getUserActionVariables(params?: { page?: number; limit?: number }) {
    return this.request('GET', '/user/actions/variables', null, params) as Promise<ActionVariable[]>;
  }

  async createUserActionVariable(name: string, data: { value: string; description?: string }) {
    return this.request('POST', `/user/actions/variables/${encodeURIComponent(name)}`, data);
  }

  async updateUserActionVariable(name: string, data: { value: string; description?: string; name?: string }) {
    return this.request('PUT', `/user/actions/variables/${encodeURIComponent(name)}`, data);
  }

  async deleteUserActionVariable(name: string) {
    return this.request('DELETE', `/user/actions/variables/${encodeURIComponent(name)}`);
  }

  async getUserActionSecrets(params?: { page?: number; limit?: number }) {
    if (!(await this.isEndpointAvailable('/user/actions/secrets'))) {
      return [] as ActionSecret[];
    }
    return this.request('GET', '/user/actions/secrets', null, params) as Promise<ActionSecret[]>;
  }

  async createOrUpdateUserActionSecret(name: string, data: { data: string; description?: string }) {
    return this.request('PUT', `/user/actions/secrets/${encodeURIComponent(name)}`, data);
  }

  async deleteUserActionSecret(name: string) {
    return this.request('DELETE', `/user/actions/secrets/${encodeURIComponent(name)}`);
  }

  async getServerVersion() {
    return this.request('GET', '/version') as Promise<ServerVersion>;
  }

  async getSigningKey() {
    return this.requestText('GET', '/signing-key.gpg');
  }

  async getAdminUsers(params?: { source_id?: number; login_name?: string; page?: number; limit?: number }) {
    return this.request('GET', '/admin/users', null, params) as Promise<GiteaUser[]>;
  }

  async searchAdminEmails(params?: { q?: string; page?: number; limit?: number }) {
    return this.request('GET', '/admin/emails/search', null, params) as Promise<EmailAddress[]>;
  }

  async createAdminUser(data: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    login_name?: string;
    source_id?: number;
    must_change_password?: boolean;
    send_notify?: boolean;
    restricted?: boolean;
    visibility?: string;
  }) {
    return this.request('POST', '/admin/users', data) as Promise<GiteaUser>;
  }

  async renameAdminUser(username: string, new_username: string) {
    return this.request('POST', `/admin/users/${encodeURIComponent(username)}/rename`, { new_username });
  }

  async createAdminOrganization(username: string, data: {
    username: string;
    full_name?: string;
    description?: string;
    website?: string;
    location?: string;
    visibility?: string;
    repo_admin_change_team_access?: boolean;
  }) {
    return this.request('POST', `/admin/users/${encodeURIComponent(username)}/orgs`, data) as Promise<Organization>;
  }

  async createAdminUserRepository(username: string, data: {
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
    return this.request('POST', `/admin/users/${encodeURIComponent(username)}/repos`, data) as Promise<Repository>;
  }

  async updateAdminUser(username: string, data: Partial<{
    active: boolean;
    admin: boolean;
    allow_create_organization: boolean;
    allow_git_hook: boolean;
    allow_import_local: boolean;
    description: string;
    email: string;
    full_name: string;
    location: string;
    login_name: string;
    max_repo_creation: number;
    must_change_password: boolean;
    password: string;
    prohibit_login: boolean;
    restricted: boolean;
    source_id: number;
    visibility: string;
    website: string;
  }>) {
    return this.request('PATCH', `/admin/users/${encodeURIComponent(username)}`, data) as Promise<GiteaUser>;
  }

  async deleteAdminUser(username: string, purge?: boolean) {
    return this.request('DELETE', `/admin/users/${encodeURIComponent(username)}`, null, { purge });
  }

  async getAdminUserBadges(username: string) {
    return this.request('GET', `/admin/users/${encodeURIComponent(username)}/badges`) as Promise<UserBadge[]>;
  }

  async addAdminUserBadges(username: string, badge_slugs: string[]) {
    return this.request('POST', `/admin/users/${encodeURIComponent(username)}/badges`, { badge_slugs });
  }

  async removeAdminUserBadges(username: string, badge_slugs: string[]) {
    return this.request('DELETE', `/admin/users/${encodeURIComponent(username)}/badges`, { badge_slugs });
  }

  async getAdminOrganizations(params?: { page?: number; limit?: number }) {
    return this.request('GET', '/admin/orgs', null, params) as Promise<Organization[]>;
  }

  async getAdminHooks(params?: { page?: number; limit?: number; type?: 'system' | 'default' | 'all' }) {
    return this.request('GET', '/admin/hooks', null, params) as Promise<Hook[]>;
  }

  async getAdminHook(id: number) {
    return this.request('GET', `/admin/hooks/${id}`) as Promise<Hook>;
  }

  async createAdminHook(data: {
    type: string;
    config: Record<string, string>;
    events?: string[];
    active?: boolean;
    branch_filter?: string;
    authorization_header?: string;
  }) {
    return this.request('POST', '/admin/hooks', data) as Promise<Hook>;
  }

  async updateAdminHook(id: number, data: {
    config?: Record<string, string>;
    events?: string[];
    active?: boolean;
    branch_filter?: string;
    authorization_header?: string;
  }) {
    return this.request('PATCH', `/admin/hooks/${id}`, data) as Promise<Hook>;
  }

  async deleteAdminHook(id: number) {
    return this.request('DELETE', `/admin/hooks/${id}`);
  }

  async getAdminUnadoptedRepositories(params?: { pattern?: string; page?: number; limit?: number }) {
    return this.request('GET', '/admin/unadopted', null, params) as Promise<string[]>;
  }

  async adoptAdminUnadoptedRepository(owner: string, repo: string) {
    return this.request('POST', `/admin/unadopted/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  async deleteAdminUnadoptedRepository(owner: string, repo: string) {
    return this.request('DELETE', `/admin/unadopted/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  async getAdminCronTasks(params?: { page?: number; limit?: number }) {
    return this.request('GET', '/admin/cron', null, params) as Promise<AdminCronTask[]>;
  }

  async runAdminCronTask(task: string) {
    return this.request('POST', `/admin/cron/${encodeURIComponent(task)}`);
  }

  async getAdminActionJobs(params?: { status?: string; page?: number; limit?: number }) {
    if (!(await this.isEndpointAvailable('/admin/actions/jobs'))) {
      return { jobs: [], total_count: 0 } as { jobs: AdminActionJob[]; total_count: number };
    }
    return this.request('GET', '/admin/actions/jobs', null, params) as Promise<{ jobs: AdminActionJob[]; total_count: number }>;
  }

  async getAdminActionRuns(params?: { event?: string; branch?: string; status?: string; actor?: string; head_sha?: string; page?: number; limit?: number }) {
    if (!(await this.isEndpointAvailable('/admin/actions/runs'))) {
      return { workflow_runs: [], total_count: 0 } as { workflow_runs: AdminActionRun[]; total_count: number };
    }
    return this.request('GET', '/admin/actions/runs', null, params) as Promise<{ workflow_runs: AdminActionRun[]; total_count: number }>;
  }

  async getAdminActionRunners() {
    if (!(await this.isEndpointAvailable('/admin/actions/runners'))) {
      return { runners: [], total_count: 0 } as { runners: AdminActionRunner[]; total_count?: number };
    }
    return this.request('GET', '/admin/actions/runners') as Promise<{ runners: AdminActionRunner[]; total_count?: number }>;
  }

  async getAdminActionRunner(runnerId: string | number) {
    if (!(await this.isEndpointAvailable('/admin/actions/runners/{runner_id}'))) {
      throw new Error('Admin action runners endpoint is not supported by this Gitea instance.');
    }
    return this.request('GET', `/admin/actions/runners/${encodeURIComponent(String(runnerId))}`) as Promise<AdminActionRunner>;
  }

  async deleteAdminActionRunner(runnerId: string | number) {
    if (!(await this.isEndpointAvailable('/admin/actions/runners/{runner_id}'))) {
      throw new Error('Admin action runners endpoint is not supported by this Gitea instance.');
    }
    return this.request('DELETE', `/admin/actions/runners/${encodeURIComponent(String(runnerId))}`);
  }

  async createAdminActionRunnerRegistrationToken() {
    if (await this.isEndpointAvailable('/admin/actions/runners/registration-token')) {
      return this.request('POST', '/admin/actions/runners/registration-token') as Promise<{ token: string }>;
    }
    if (await this.isEndpointAvailable('/admin/runners/registration-token')) {
      return this.request('POST', '/admin/runners/registration-token') as Promise<{ token: string }>;
    }
    throw new Error('Admin runner registration endpoint is not supported by this Gitea instance.');
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
    const repos = await this.request('GET', '/user/starred') as Repository[];
    this.starredRepoSetCache = new Set(repos.map((repo) => this.getRepoCacheKey(repo.owner.login, repo.name)));
    return repos;
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
    return this.sdkRequest(this.client.users.userGetTokens(username)) as Promise<AccessToken[]>;
  }

  async createAccessToken(username: string, data: { name: string; scopes?: string[] }) {
    return this.request('POST', `/users/${encodeURIComponent(username)}/tokens`, data) as Promise<AccessToken>;
  }

  async deleteAccessToken(username: string, token: string) {
    return this.request('DELETE', `/users/${encodeURIComponent(username)}/tokens/${encodeURIComponent(token)}`);
  }

  async getOAuth2Applications(params?: { page?: number; limit?: number }) {
    return this.request('GET', '/user/applications/oauth2', null, params) as Promise<OAuth2Application[]>;
  }

  async getOAuth2Application(id: number) {
    return this.request('GET', `/user/applications/oauth2/${id}`) as Promise<OAuth2Application>;
  }

  async createOAuth2Application(data: { name: string; redirect_uris: string[]; confidential_client?: boolean }) {
    return this.request('POST', '/user/applications/oauth2', data) as Promise<OAuth2Application>;
  }

  async updateOAuth2Application(id: number, data: { name: string; redirect_uris: string[]; confidential_client?: boolean }) {
    return this.request('PATCH', `/user/applications/oauth2/${id}`, data) as Promise<OAuth2Application>;
  }

  async deleteOAuth2Application(id: number) {
    return this.request('DELETE', `/user/applications/oauth2/${id}`);
  }

  async getPackages(owner: string, params?: { type?: string; q?: string; page?: number; limit?: number }) {
    return this.request('GET', `/packages/${encodeURIComponent(owner)}`, null, params) as Promise<PackageVersion[]>;
  }

  async getPackageVersions(owner: string, type: string, name: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`, null, params) as Promise<PackageVersion[]>;
  }

  async getLatestPackageVersion(owner: string, type: string, name: string) {
    return this.request('GET', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/-/latest`) as Promise<PackageVersion>;
  }

  async getPackage(owner: string, type: string, name: string, version: string) {
    return this.request('GET', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`) as Promise<PackageVersion>;
  }

  async deletePackageVersion(owner: string, type: string, name: string, version: string) {
    return this.request('DELETE', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
  }

  async deletePackage(owner: string, type: string, name: string) {
    return this.request('DELETE', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`);
  }

  async getPackageFiles(owner: string, type: string, name: string, version: string) {
    return this.request('GET', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/files`) as Promise<PackageFile[]>;
  }

  async linkPackageRepository(owner: string, type: string, name: string, repoName: string) {
    return this.request('POST', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/-/link/${encodeURIComponent(repoName)}`, {});
  }

  async unlinkPackageRepository(owner: string, type: string, name: string) {
    return this.request('POST', `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/-/unlink`, {});
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

  async getOrganizationActionVariables(org: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/actions/variables`, null, params) as Promise<ActionVariable[]>;
  }

  async createOrganizationActionVariable(org: string, name: string, data: { value: string; description?: string }) {
    return this.request('POST', `/orgs/${encodeURIComponent(org)}/actions/variables/${encodeURIComponent(name)}`, data);
  }

  async updateOrganizationActionVariable(org: string, name: string, data: { value: string; description?: string; name?: string }) {
    return this.request('PUT', `/orgs/${encodeURIComponent(org)}/actions/variables/${encodeURIComponent(name)}`, data);
  }

  async deleteOrganizationActionVariable(org: string, name: string) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/actions/variables/${encodeURIComponent(name)}`);
  }

  async getOrganizationActionSecrets(org: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/actions/secrets`, null, params) as Promise<ActionSecret[]>;
  }

  async createOrUpdateOrganizationActionSecret(org: string, name: string, data: { data: string; description?: string }) {
    return this.request('PUT', `/orgs/${encodeURIComponent(org)}/actions/secrets/${encodeURIComponent(name)}`, data);
  }

  async deleteOrganizationActionSecret(org: string, name: string) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/actions/secrets/${encodeURIComponent(name)}`);
  }

  async getOrganizationActionRunners(org: string) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/actions/runners`) as Promise<{ runners: AdminActionRunner[]; total_count?: number }>;
  }

  async getOrganizationActionRunner(org: string, runnerId: string | number) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/actions/runners/${encodeURIComponent(String(runnerId))}`) as Promise<AdminActionRunner>;
  }

  async deleteOrganizationActionRunner(org: string, runnerId: string | number) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/actions/runners/${encodeURIComponent(String(runnerId))}`);
  }

  async createOrganizationActionRunnerRegistrationToken(org: string) {
    return this.request('POST', `/orgs/${encodeURIComponent(org)}/actions/runners/registration-token`) as Promise<{ token: string }>;
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

  async getOrganizationBlocks(org: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/orgs/${encodeURIComponent(org)}/blocks`, null, params) as Promise<GiteaUser[]>;
  }

  async blockOrganizationUser(org: string, username: string, note?: string) {
    return this.request('PUT', `/orgs/${encodeURIComponent(org)}/blocks/${encodeURIComponent(username)}`, null, note ? { note } : undefined);
  }

  async unblockOrganizationUser(org: string, username: string) {
    return this.request('DELETE', `/orgs/${encodeURIComponent(org)}/blocks/${encodeURIComponent(username)}`);
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
    return this.sdkRequest(this.client.repos.repoGet(owner, repo)) as Promise<Repository>;
  }

  async getRepositoryForks(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/forks`, null, params) as Promise<Repository[]>;
  }

  async getRepositoryContributors(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    // Gitea 1.23 has no stable contributors endpoint in the OpenAPI spec.
    // Keep the UI resilient by returning an empty list instead of spamming 404s.
    return [] as Contributor[];
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

  async getRepositoryActivityFeeds(owner: string, repo: string, params?: { date?: string; page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/activities/feeds`, null, params) as Promise<ActivityFeed[]>;
  }

  getRepositoryArchiveUrl(owner: string, repo: string, archive: string) {
    return `${this.config.baseUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/${encodeURIComponent(archive)}`;
  }

  getRepositoryRawFileUrl(owner: string, repo: string, path: string, ref?: string) {
    const url = new URL(`${this.config.baseUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${path}`);
    if (ref) url.searchParams.set('ref', ref);
    return url.toString();
  }

  getRepositoryMediaFileUrl(owner: string, repo: string, path: string, ref?: string) {
    const url = new URL(`${this.config.baseUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/media/${path}`);
    if (ref) url.searchParams.set('ref', ref);
    return url.toString();
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

  async getRepositoryLabels(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/labels`) as Promise<Label[]>;
  }

  async createRepositoryLabel(owner: string, repo: string, data: { name: string; color: string; description?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/labels`, data) as Promise<Label>;
  }

  async updateRepositoryLabel(owner: string, repo: string, id: number, data: { name?: string; color?: string; description?: string }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/labels/${id}`, data) as Promise<Label>;
  }

  async deleteRepositoryLabel(owner: string, repo: string, id: number) {
    return this.request('DELETE', `/repos/${owner}/${repo}/labels/${id}`);
  }

  async getRepositoryProjects(owner: string, repo: string) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/projects'))) {
      return [] as RepositoryProject[];
    }
    return this.request('GET', `/repos/${owner}/${repo}/projects`) as Promise<RepositoryProject[]>;
  }

  async createRepositoryProject(owner: string, repo: string, data: { title: string; description?: string; board_type?: string }) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/projects'))) {
      throw new Error('Repository projects endpoint is not supported by this Gitea instance.');
    }
    return this.request('POST', `/repos/${owner}/${repo}/projects`, data) as Promise<RepositoryProject>;
  }

  async deleteRepositoryProject(owner: string, repo: string, id: number) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/projects/{id}'))) {
      throw new Error('Repository projects endpoint is not supported by this Gitea instance.');
    }
    return this.request('DELETE', `/repos/${owner}/${repo}/projects/${id}`);
  }

  async getProjectColumns(id: number) {
    if (!(await this.isEndpointAvailable('/projects/{id}/columns'))) {
      return [] as ProjectColumn[];
    }
    return this.request('GET', `/projects/${id}/columns`) as Promise<ProjectColumn[]>;
  }

  async createProjectColumn(id: number, data: { title: string }) {
    if (!(await this.isEndpointAvailable('/projects/{id}/columns'))) {
      throw new Error('Project columns endpoint is not supported by this Gitea instance.');
    }
    return this.request('POST', `/projects/${id}/columns`, data) as Promise<ProjectColumn>;
  }

  async updateRepository(owner: string, repo: string, data: {
    name?: string;
    description?: string;
    website?: string;
    private?: boolean;
    archived?: boolean;
    has_issues?: boolean;
    has_wiki?: boolean;
    has_projects?: boolean;
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

  async syncMirror(owner: string, repo: string) {
    return this.request('POST', `/repos/${owner}/${repo}/mirror-sync`, {});
  }

  async getPushMirrors(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/push_mirrors`, null, params) as Promise<PushMirror[]>;
  }

  async createPushMirror(owner: string, repo: string, data: {
    remote_address: string;
    remote_username?: string;
    remote_password?: string;
    interval?: string;
    sync_on_commit?: boolean;
  }) {
    return this.request('POST', `/repos/${owner}/${repo}/push_mirrors`, data) as Promise<PushMirror>;
  }

  async getPushMirror(owner: string, repo: string, name: string) {
    return this.request('GET', `/repos/${owner}/${repo}/push_mirrors/${encodeURIComponent(name)}`) as Promise<PushMirror>;
  }

  async deletePushMirror(owner: string, repo: string, name: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/push_mirrors/${encodeURIComponent(name)}`);
  }

  async syncPushMirrors(owner: string, repo: string) {
    return this.request('POST', `/repos/${owner}/${repo}/push_mirrors-sync`, {});
  }

  async isStarred(owner: string, repo: string) {
    const starred = await this.getStarredRepoSet();
    return starred.has(this.getRepoCacheKey(owner, repo));
  }

  async starRepository(owner: string, repo: string) {
    const response = await this.sdkRequest(this.client.user.userCurrentPutStar(owner, repo));
    const starred = await this.getStarredRepoSet();
    starred.add(this.getRepoCacheKey(owner, repo));
    this.starredRepoSetCache = starred;
    return response;
  }

  async unstarRepository(owner: string, repo: string) {
    const response = await this.sdkRequest(this.client.user.userCurrentDeleteStar(owner, repo));
    const starred = await this.getStarredRepoSet();
    starred.delete(this.getRepoCacheKey(owner, repo));
    this.starredRepoSetCache = starred;
    return response;
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
    if (!path) {
      return this.sdkRequest(this.client.repos.repoGetContentsList(owner, repo, { ref })) as Promise<FileContent[]>;
    }
    return this.sdkRequest(this.client.repos.repoGetContents(owner, repo, path, { ref })) as Promise<FileContent | FileContent[]>;
  }

  async getBranches(owner: string, repo: string) {
    const branches = await this.sdkRequest(this.client.repos.repoListBranches(owner, repo));
    return branches.map((branch: any) => ({
      ...branch,
      commit: {
        id: Number(branch?.commit?.id || 0),
        sha: String(branch?.commit?.id || branch?.commit?.sha || ''),
        url: String(branch?.commit?.url || ''),
      },
    })) as Branch[];
  }

  async getBranch(owner: string, repo: string, branch: string) {
    const data: any = await this.sdkRequest(this.client.repos.repoGetBranch(owner, repo, branch));
    return {
      ...data,
      commit: {
        id: Number(data?.commit?.id || 0),
        sha: String(data?.commit?.id || data?.commit?.sha || ''),
        url: String(data?.commit?.url || ''),
      },
    } as Branch;
  }

  async getGitTree(owner: string, repo: string, sha: string, recursive = true) {
    return this.request('GET', `/repos/${owner}/${repo}/git/trees/${sha}`, null, { recursive }) as Promise<GitTree>;
  }

  async getGitBlob(owner: string, repo: string, sha: string) {
    return this.request('GET', `/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(sha)}`) as Promise<GitBlob>;
  }

  async getGitCommit(owner: string, repo: string, sha: string, params?: { stat?: boolean; verification?: boolean; files?: boolean }) {
    return this.request('GET', `/repos/${owner}/${repo}/git/commits/${encodeURIComponent(sha)}`, null, params) as Promise<Commit>;
  }

  async getGitCommitDiff(owner: string, repo: string, sha: string, type: 'diff' | 'patch' = 'diff') {
    return this.request('GET', `/repos/${owner}/${repo}/git/commits/${encodeURIComponent(sha)}.${type}`) as Promise<string>;
  }

  async getGitTag(owner: string, repo: string, sha: string) {
    return this.request('GET', `/repos/${owner}/${repo}/git/tags/${encodeURIComponent(sha)}`) as Promise<GitAnnotatedTag>;
  }

  async getGitRefs(owner: string, repo: string, ref?: string) {
    const suffix = ref ? `/${encodeURIComponent(ref)}` : '';
    return this.request('GET', `/repos/${owner}/${repo}/git/refs${suffix}`) as Promise<GitRef[]>;
  }

  async createGitRef(owner: string, repo: string, data: { ref: string; sha: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/git/refs`, data) as Promise<GitRef>;
  }

  async updateGitRef(owner: string, repo: string, ref: string, data: { sha: string; force?: boolean }) {
    return this.request('PATCH', `/repos/${owner}/${repo}/git/refs/${encodeURIComponent(ref)}`, data) as Promise<GitRef>;
  }

  async deleteGitRef(owner: string, repo: string, ref: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/git/refs/${encodeURIComponent(ref)}`);
  }

  async createBranch(owner: string, repo: string, data: { new_branch_name: string; old_branch_name?: string; old_ref_name?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/branches`, data) as Promise<Branch>;
  }

  async deleteBranch(owner: string, repo: string, branch: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
  }

  async renameBranch(owner: string, repo: string, branch: string, name: string) {
    return this.request('PATCH', `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, { name });
  }

  async getCommits(owner: string, repo: string, sha?: string) {
    return this.sdkRequest(this.client.repos.repoGetAllCommits(owner, repo, { sha })) as Promise<Commit[]>;
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
    return this.request('PUT', `/repos/${owner}/${repo}/pulls/${index}/update`, style ? { style } : {});
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
    return this.sdkRequest(this.client.repos.repoGetWikiPages(owner, repo)) as Promise<WikiPageMeta[]>;
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

  async getRepositoryActionVariables(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/actions/variables`, null, params) as Promise<ActionVariable[]>;
  }

  async getRepositoryActionVariable(owner: string, repo: string, name: string) {
    return this.request('GET', `/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`) as Promise<ActionVariable>;
  }

  async createRepositoryActionVariable(owner: string, repo: string, name: string, data: { value: string; description?: string }) {
    return this.request('POST', `/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`, data);
  }

  async updateRepositoryActionVariable(owner: string, repo: string, name: string, data: { value: string; description?: string; name?: string }) {
    return this.request('PUT', `/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`, data);
  }

  async deleteRepositoryActionVariable(owner: string, repo: string, name: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`);
  }

  async getRepositoryActionSecrets(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/actions/secrets`, null, params) as Promise<ActionSecret[]>;
  }

  async createOrUpdateRepositoryActionSecret(owner: string, repo: string, name: string, data: { data: string; description?: string }) {
    return this.request('PUT', `/repos/${owner}/${repo}/actions/secrets/${encodeURIComponent(name)}`, data);
  }

  async deleteRepositoryActionSecret(owner: string, repo: string, name: string) {
    return this.request('DELETE', `/repos/${owner}/${repo}/actions/secrets/${encodeURIComponent(name)}`);
  }

  async getRepositoryActionArtifacts(owner: string, repo: string, params?: { name?: string }) {
    return { artifacts: [], total_count: 0 } as { artifacts: ActionArtifact[]; total_count: number };
  }

  async getRepositoryActionArtifact(owner: string, repo: string, artifactId: string | number) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/artifacts/{artifact_id}'))) {
      throw new Error('Repository action artifacts endpoint is not supported by this Gitea instance.');
    }
    return this.request('GET', `/repos/${owner}/${repo}/actions/artifacts/${encodeURIComponent(String(artifactId))}`) as Promise<ActionArtifact>;
  }

  async getRepositoryActionWorkflows(owner: string, repo: string) {
    return { workflows: [], total_count: 0 } as { workflows: ActionWorkflow[]; total_count: number };
  }

  async getRepositoryActionWorkflow(owner: string, repo: string, workflowId: string) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/workflows/{workflow_id}'))) {
      throw new Error('Repository action workflows endpoint is not supported by this Gitea instance.');
    }
    return this.request('GET', `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}`) as Promise<ActionWorkflow>;
  }

  async enableRepositoryActionWorkflow(owner: string, repo: string, workflowId: string) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable'))) {
      throw new Error('Repository action workflows endpoint is not supported by this Gitea instance.');
    }
    return this.request('PUT', `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/enable`);
  }

  async disableRepositoryActionWorkflow(owner: string, repo: string, workflowId: string) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable'))) {
      throw new Error('Repository action workflows endpoint is not supported by this Gitea instance.');
    }
    return this.request('PUT', `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/disable`);
  }

  async dispatchRepositoryActionWorkflow(owner: string, repo: string, workflowId: string, data: { ref: string; inputs?: Record<string, string> }) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches'))) {
      throw new Error('Repository action workflows endpoint is not supported by this Gitea instance.');
    }
    return this.request('POST', `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`, data);
  }

  async getRepositoryActionRunners(owner: string, repo: string) {
    return { runners: [], total_count: 0 } as { runners: AdminActionRunner[]; total_count?: number };
  }

  async getRepositoryActionRunner(owner: string, repo: string, runnerId: string | number) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/runners/{runner_id}'))) {
      throw new Error('Repository action runners endpoint is not supported by this Gitea instance.');
    }
    return this.request('GET', `/repos/${owner}/${repo}/actions/runners/${encodeURIComponent(String(runnerId))}`) as Promise<AdminActionRunner>;
  }

  async deleteRepositoryActionRunner(owner: string, repo: string, runnerId: string | number) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/runners/{runner_id}'))) {
      throw new Error('Repository action runners endpoint is not supported by this Gitea instance.');
    }
    return this.request('DELETE', `/repos/${owner}/${repo}/actions/runners/${encodeURIComponent(String(runnerId))}`);
  }

  async createRepositoryActionRunnerRegistrationToken(owner: string, repo: string) {
    if (!(await this.isEndpointAvailable('/repos/{owner}/{repo}/actions/runners/registration-token'))) {
      throw new Error('Repository action runners endpoint is not supported by this Gitea instance.');
    }
    return this.request('POST', `/repos/${owner}/${repo}/actions/runners/registration-token`) as Promise<{ token: string }>;
  }

  async getRepositoryActionTasks(owner: string, repo: string, params?: { page?: number; limit?: number }) {
    return this.request('GET', `/repos/${owner}/${repo}/actions/tasks`, null, params) as Promise<{ workflow_runs: AdminActionRun[]; total_count: number }>;
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
