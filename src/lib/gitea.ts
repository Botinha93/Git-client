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
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface Comment {
  id: number;
  body: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
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
  full_name: string;
  avatar_url: string;
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
      },
    });
    return response.data;
  }

  async getUser() {
    return this.request('GET', '/user');
  }

  async getRepositories() {
    return this.request('GET', '/user/repos') as Promise<Repository[]>;
  }

  async getRepository(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}`) as Promise<Repository>;
  }

  async getContents(owner: string, repo: string, path: string = '', ref?: string) {
    return this.request('GET', `/repos/${owner}/${repo}/contents/${path}`, null, { ref }) as Promise<FileContent | FileContent[]>;
  }

  async getBranches(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/branches`) as Promise<Branch[]>;
  }

  async getCommits(owner: string, repo: string, sha?: string) {
    return this.request('GET', `/repos/${owner}/${repo}/commits`, null, { sha }) as Promise<Commit[]>;
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

  async createIssue(owner: string, repo: string, data: { title: string; body?: string; assignees?: string[]; labels?: number[] }) {
    return this.request('POST', `/repos/${owner}/${repo}/issues`, data) as Promise<Issue>;
  }

  async updateIssue(owner: string, repo: string, index: number, data: { title?: string; body?: string; state?: 'open' | 'closed'; assignees?: string[]; labels?: number[] }) {
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

  async getRepoAssignees(owner: string, repo: string) {
    return this.request('GET', `/repos/${owner}/${repo}/assignees`) as Promise<GiteaUser[]>;
  }
}
