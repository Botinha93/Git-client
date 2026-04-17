import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import { promises as fs } from 'fs';
import crypto from 'crypto';

type SupportStatus = 'submitted' | 'triaged' | 'translated' | 'in-review' | 'approved' | 'converted' | 'rejected';

interface SupportProgressEntry {
  id: string;
  status: SupportStatus;
  note: string;
  createdAt: string;
  actorType: 'user' | 'developer' | 'system';
  actorName?: string;
}

interface SupportMessage {
  id: string;
  authorType: 'user' | 'developer';
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface SupportAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedByType: 'user' | 'developer';
  uploadedByName: string;
  uploadedAt: string;
  storageName: string;
}

interface SupportReport {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  sourceLanguage?: string;
  title: string;
  description: string;
  repositoryOwner: string;
  repositoryName: string;
  status: SupportStatus;
  translatedTitle?: string;
  translatedDescription?: string;
  messages: SupportMessage[];
  attachments: SupportAttachment[];
  progress: SupportProgressEntry[];
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  giteaIssue?: {
    number: number;
    url?: string;
    html_url?: string;
  };
}

interface EndUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

interface SupportUserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  reportCount: number;
  lastReportAt?: string;
}

interface SupportDb {
  users: EndUserRecord[];
  reports: SupportReport[];
}

interface EndUserSession {
  userId: string;
  expiresAt: number;
}

interface DeveloperSession {
  username: string;
  user: {
    id: number;
    login: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    email?: string;
    is_admin?: boolean;
  };
  accessToken: string;
  baseUrl: string;
  expiresAt: number;
}

interface PendingDeveloperLogin {
  redirectTo: string;
  expiresAt: number;
}

interface SupportRepositoryOption {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  description?: string;
  private: boolean;
  archived?: boolean;
}

interface GiteaLabelRecord {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

interface DeployProjectPayload {
  name: string;
  repoUrl: string;
  branch: string;
  steps: Array<{ name: string; command: string }>;
  envVars?: Record<string, string>;
  buildFiles?: Array<{ path: string; content: string }>;
  artifactPaths?: Array<{ id?: string; path: string }>;
  retainedRunCount?: number;
  queuePriorityClass?: 'normal' | 'hotfix';
  maxConcurrentBuilds?: number;
  remoteHostId?: string;
  autoBuild?: boolean;
  webhookSecret?: string;
  deploymentSettings?: {
    hostId: string;
    sourceType: 'repo' | 'manual';
    composeFilePath?: string;
    composeContent?: string;
    branchFilters?: string[];
    autoDeploy?: boolean;
    enabled?: boolean;
  };
}

const SUPPORT_DB_PATH = path.join(process.cwd(), '.data', 'support-workflow.json');
const SUPPORT_ATTACHMENTS_DIR = path.join(process.cwd(), '.data', 'support-attachments');
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const USER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const DEVELOPER_SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const DEVELOPER_LOGIN_STATE_TTL_MS = 1000 * 60 * 10;
const DEVELOPER_SESSION_COOKIE = 'gitflow_dev_session';

const userSessions = new Map<string, EndUserSession>();
const developerSessions = new Map<string, DeveloperSession>();
const pendingDeveloperLogins = new Map<string, PendingDeveloperLogin>();

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

function createPasswordHash(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, '');
}

function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>();
  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (!rawName) {
      continue;
    }
    cookies.set(rawName, decodeURIComponent(rest.join('=')));
  }

  return cookies;
}

function getCookie(req: express.Request, name: string) {
  return parseCookies(req.headers.cookie).get(name) || null;
}

function appendSetCookie(res: express.Response, value: string) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', value);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, value]);
    return;
  }
  res.setHeader('Set-Cookie', [String(current), value]);
}

function setCookie(res: express.Response, name: string, value: string, maxAgeMs: number, secure: boolean) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (secure) {
    parts.push('Secure');
  }

  appendSetCookie(res, parts.join('; '));
}

function clearCookie(res: express.Response, name: string, secure: boolean) {
  const parts = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (secure) {
    parts.push('Secure');
  }

  appendSetCookie(res, parts.join('; '));
}

function sanitizeRedirectTarget(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return '/';
  }
  if (value.startsWith('//')) {
    return '/';
  }
  return value;
}

function pruneExpiredSessions() {
  const now = Date.now();

  for (const [token, session] of userSessions.entries()) {
    if (session.expiresAt < now) {
      userSessions.delete(token);
    }
  }

  for (const [sessionId, session] of developerSessions.entries()) {
    if (session.expiresAt < now) {
      developerSessions.delete(sessionId);
    }
  }

  for (const [state, pending] of pendingDeveloperLogins.entries()) {
    if (pending.expiresAt < now) {
      pendingDeveloperLogins.delete(state);
    }
  }
}

function sanitizeForUser(report: SupportReport, userId: string) {
  if (report.userId !== userId) {
    return null;
  }
  return report;
}

function summarizeSupportUser(user: EndUserRecord, reports: SupportReport[]): SupportUserSummary {
  const userReports = reports
    .filter((report) => report.userId === user.id)
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    reportCount: userReports.length,
    lastReportAt: userReports[0]?.updatedAt,
  };
}

async function ensureSupportDb() {
  const dir = path.dirname(SUPPORT_DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(SUPPORT_ATTACHMENTS_DIR, { recursive: true });
  try {
    await fs.access(SUPPORT_DB_PATH);
  } catch {
    const initial: SupportDb = { users: [], reports: [] };
    await fs.writeFile(SUPPORT_DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function loadSupportDb() {
  await ensureSupportDb();
  try {
    const raw = await fs.readFile(SUPPORT_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SupportDb>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      reports: Array.isArray(parsed.reports)
        ? parsed.reports.map((report) => ({
            ...report,
            attachments: Array.isArray((report as SupportReport).attachments) ? (report as SupportReport).attachments : [],
          }))
        : [],
    } satisfies SupportDb;
  } catch {
    return { users: [], reports: [] } satisfies SupportDb;
  }
}

async function saveSupportDb(db: SupportDb) {
  await ensureSupportDb();
  await fs.writeFile(SUPPORT_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function addProgress(report: SupportReport, entry: Omit<SupportProgressEntry, 'id' | 'createdAt'>) {
  report.progress.push({
    id: createId('progress'),
    createdAt: nowIso(),
    ...entry,
  });
}

function readBearerToken(authHeader: string | undefined) {
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

function sanitizeFileName(fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return safe || 'attachment.bin';
}

function decodeBase64Payload(value: string) {
  const normalized = value.replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(normalized, 'base64');
}

async function saveSupportAttachment(reportId: string, attachmentId: string, fileName: string, content: Buffer) {
  const reportDir = path.join(SUPPORT_ATTACHMENTS_DIR, reportId);
  await fs.mkdir(reportDir, { recursive: true });
  const safeName = sanitizeFileName(fileName);
  const storageName = `${attachmentId}_${safeName}`;
  const absolutePath = path.join(reportDir, storageName);
  await fs.writeFile(absolutePath, content);
  return { storageName, absolutePath };
}

function getSupportAttachmentPath(reportId: string, storageName: string) {
  return path.join(SUPPORT_ATTACHMENTS_DIR, reportId, storageName);
}

async function startServer() {
  const app = express();
  const PORT = 9000;
  const serverBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL || `http://localhost:${PORT}`);
  const configuredGiteaBaseUrl = normalizeBaseUrl(process.env.GITEA_BASE_URL || '');
  const giteaServiceToken = String(process.env.GITEA_SERVICE_TOKEN || '').trim();
  const deployBaseUrl = normalizeBaseUrl(process.env.DEPLOY_BASE_URL || '');
  const deployApiToken = String(process.env.DEPLOY_API_TOKEN || '').trim();
  const giteaOauthClientId = String(process.env.GITEA_OAUTH_CLIENT_ID || '').trim();
  const giteaOauthClientSecret = String(process.env.GITEA_OAUTH_CLIENT_SECRET || '').trim();
  const oauthRedirectUri = `${serverBaseUrl}/api/auth/gitea/callback`;
  const secureCookies = serverBaseUrl.startsWith('https://');
  const giteaOauthConfigured = Boolean(configuredGiteaBaseUrl && giteaOauthClientId && giteaOauthClientSecret);

  app.use(express.json());

  function getDeveloperSession(req: express.Request) {
    pruneExpiredSessions();

    const sessionId = getCookie(req, DEVELOPER_SESSION_COOKIE);
    if (!sessionId) {
      return null;
    }

    const session = developerSessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      developerSessions.delete(sessionId);
      return null;
    }

    return { sessionId, session };
  }

  function requireDeveloperSession(req: express.Request, res: express.Response) {
    const authenticated = getDeveloperSession(req);
    if (!authenticated) {
      res.status(401).json({ error: 'Developer session expired or missing.' });
      return null;
    }
    return authenticated;
  }

  function getDeveloperAuthHeaders(session: DeveloperSession) {
    return {
      Authorization: `Bearer ${session.accessToken}`,
    };
  }

  function getDeployAuthHeaders() {
    return {
      Authorization: `Bearer ${deployApiToken}`,
    };
  }

  async function ensureRepositoryLabels(
    session: DeveloperSession,
    owner: string,
    repo: string,
    labelNames: string[],
  ) {
    if (labelNames.length === 0) {
      return [] as number[];
    }

    const repoLabelsResponse = await axios.get(
      `${session.baseUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels`,
      {
        headers: getDeveloperAuthHeaders(session),
        responseType: 'json',
      },
    );

    const existingLabels = Array.isArray(repoLabelsResponse.data)
      ? repoLabelsResponse.data as GiteaLabelRecord[]
      : [];

    const ensuredLabels = await Promise.all(labelNames.map(async (labelName) => {
      const existing = existingLabels.find((label) => label.name === labelName);
      if (existing?.id) {
        return existing.id;
      }

      const createdLabelResponse = await axios.post(
        `${session.baseUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels`,
        {
          name: labelName,
          color: labelName === 'user-reported' ? '0ea5e9' : '64748b',
          description: `Support workflow label: ${labelName}`,
        },
        {
          headers: {
            ...getDeveloperAuthHeaders(session),
            'Content-Type': 'application/json',
          },
          responseType: 'json',
        },
      );

      return Number(createdLabelResponse.data?.id);
    }));

    return ensuredLabels.filter((labelId) => Number.isFinite(labelId) && labelId > 0);
  }

  app.get('/api/auth/gitea/session', async (req, res) => {
    const authenticated = getDeveloperSession(req);

    if (!authenticated) {
      return res.json({
        authenticated: false,
        giteaConfigured: giteaOauthConfigured,
        baseUrl: configuredGiteaBaseUrl || null,
      });
    }

    return res.json({
      authenticated: true,
      giteaConfigured: giteaOauthConfigured,
      baseUrl: authenticated.session.baseUrl,
      user: authenticated.session.user,
    });
  });

  app.get('/api/integrations/deploy/status', async (req, res) => {
    const authenticated = getDeveloperSession(req);

    return res.json({
      configured: Boolean(deployBaseUrl && deployApiToken),
      authenticated: Boolean(authenticated),
      baseUrl: deployBaseUrl || null,
    });
  });

  app.get('/api/auth/gitea/login', async (req, res) => {
    if (!giteaOauthConfigured) {
      return res.status(503).send('Gitea OAuth is not configured on the server.');
    }

    pruneExpiredSessions();
    const state = createId('gitea_state');
    pendingDeveloperLogins.set(state, {
      redirectTo: sanitizeRedirectTarget(String(req.query.redirectTo || '/')),
      expiresAt: Date.now() + DEVELOPER_LOGIN_STATE_TTL_MS,
    });

    const authorizeUrl = new URL(`${configuredGiteaBaseUrl}/login/oauth/authorize`);
    authorizeUrl.searchParams.set('client_id', giteaOauthClientId);
    authorizeUrl.searchParams.set('redirect_uri', oauthRedirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('state', state);

    return res.redirect(authorizeUrl.toString());
  });

  app.get('/api/auth/gitea/callback', async (req, res) => {
    if (!giteaOauthConfigured) {
      return res.status(503).send('Gitea OAuth is not configured on the server.');
    }

    pruneExpiredSessions();
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const pending = pendingDeveloperLogins.get(state);
    pendingDeveloperLogins.delete(state);

    if (!code || !pending || pending.expiresAt < Date.now()) {
      return res.redirect('/?authError=invalid_state');
    }

    try {
      const tokenPayload = new URLSearchParams();
      tokenPayload.set('client_id', giteaOauthClientId);
      tokenPayload.set('client_secret', giteaOauthClientSecret);
      tokenPayload.set('code', code);
      tokenPayload.set('grant_type', 'authorization_code');
      tokenPayload.set('redirect_uri', oauthRedirectUri);

      const tokenResponse = await axios.post(
        `${configuredGiteaBaseUrl}/login/oauth/access_token`,
        tokenPayload.toString(),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          responseType: 'json',
        },
      );

      const accessToken = String(tokenResponse.data?.access_token || '').trim();
      if (!accessToken) {
        throw new Error('Missing access token from Gitea.');
      }

      const userResponse = await axios.get(`${configuredGiteaBaseUrl}/api/v1/user`, {
        headers: getDeveloperAuthHeaders({
          username: '',
          user: { id: 0, login: '' },
          accessToken,
          baseUrl: configuredGiteaBaseUrl,
          expiresAt: 0,
        }),
        responseType: 'json',
      });

      const login = String(userResponse.data?.login || userResponse.data?.username || '').trim();
      if (!login) {
        throw new Error('Unable to resolve developer identity from Gitea.');
      }

      const sessionId = createId('devsess');
      developerSessions.set(sessionId, {
        username: login,
        user: userResponse.data,
        accessToken,
        baseUrl: configuredGiteaBaseUrl,
        expiresAt: Date.now() + DEVELOPER_SESSION_TTL_MS,
      });

      setCookie(res, DEVELOPER_SESSION_COOKIE, sessionId, DEVELOPER_SESSION_TTL_MS, secureCookies);
      return res.redirect(pending.redirectTo);
    } catch (error) {
      console.error('Gitea OAuth callback failed:', error);
      return res.redirect('/?authError=oauth_failed');
    }
  });

  app.post('/api/auth/gitea/logout', async (req, res) => {
    const sessionId = getCookie(req, DEVELOPER_SESSION_COOKIE);
    if (sessionId) {
      developerSessions.delete(sessionId);
    }
    clearCookie(res, DEVELOPER_SESSION_COOKIE, secureCookies);
    return res.json({ ok: true });
  });

  app.post('/api/enduser/register', async (req, res) => {
    const { email, password, name } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();
    const rawPassword = String(password || '');

    if (!normalizedEmail || !normalizedName || rawPassword.length < 6) {
      return res.status(400).json({ error: 'Name, valid email, and password (min 6 chars) are required.' });
    }

    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const db = await loadSupportDb();
    const existingUser = db.users.find((user) => user.email === normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const user: EndUserRecord = {
      id: createId('enduser'),
      email: normalizedEmail,
      name: normalizedName,
      passwordHash: createPasswordHash(rawPassword),
      createdAt: nowIso(),
    };
    db.users.push(user);
    await saveSupportDb(db);

    return res.status(201).json({ ok: true });
  });

  app.post('/api/enduser/login', async (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = await loadSupportDb();
    const user = db.users.find((entry) => entry.email === normalizedEmail);
    if (!user || user.passwordHash !== createPasswordHash(rawPassword)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = createId('eusess');
    userSessions.set(token, {
      userId: user.id,
      expiresAt: Date.now() + USER_SESSION_TTL_MS,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  });

  app.get('/api/support/users', async (req, res) => {
    if (!requireDeveloperSession(req, res)) {
      return;
    }

    const db = await loadSupportDb();
    const users = db.users
      .map((user) => summarizeSupportUser(user, db.reports))
      .sort((left, right) => (left.lastReportAt || left.createdAt) < (right.lastReportAt || right.createdAt) ? 1 : -1);

    return res.json(users);
  });

  app.post('/api/support/users', async (req, res) => {
    if (!requireDeveloperSession(req, res)) {
      return;
    }

    const { email, password, name } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();
    const rawPassword = String(password || '');

    if (!normalizedEmail || !normalizedName || rawPassword.length < 6) {
      return res.status(400).json({ error: 'Name, valid email, and password (min 6 chars) are required.' });
    }

    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const db = await loadSupportDb();
    const existingUser = db.users.find((user) => user.email === normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const user: EndUserRecord = {
      id: createId('enduser'),
      email: normalizedEmail,
      name: normalizedName,
      passwordHash: createPasswordHash(rawPassword),
      createdAt: nowIso(),
    };

    db.users.push(user);
    await saveSupportDb(db);

    return res.status(201).json(summarizeSupportUser(user, db.reports));
  });

  app.patch('/api/support/users/:userId', async (req, res) => {
    if (!requireDeveloperSession(req, res)) {
      return;
    }

    const db = await loadSupportDb();
    const user = db.users.find((entry) => entry.id === req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Support user not found.' });
    }

    const nextEmail = req.body?.email !== undefined ? String(req.body.email || '').trim().toLowerCase() : user.email;
    const nextName = req.body?.name !== undefined ? String(req.body.name || '').trim() : user.name;

    if (!nextEmail || !nextName || !nextEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid name and email are required.' });
    }

    const duplicate = db.users.find((entry) => entry.id !== user.id && entry.email === nextEmail);
    if (duplicate) {
      return res.status(409).json({ error: 'Another support user already uses that email.' });
    }

    user.email = nextEmail;
    user.name = nextName;
    await saveSupportDb(db);

    return res.json(summarizeSupportUser(user, db.reports));
  });

  app.post('/api/support/users/:userId/reset-password', async (req, res) => {
    if (!requireDeveloperSession(req, res)) {
      return;
    }

    const rawPassword = String(req.body?.password || '');
    if (rawPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const db = await loadSupportDb();
    const user = db.users.find((entry) => entry.id === req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Support user not found.' });
    }

    user.passwordHash = createPasswordHash(rawPassword);
    await saveSupportDb(db);

    return res.json({ ok: true });
  });

  app.get('/api/enduser/me', async (req, res) => {
    const token = readBearerToken(req.headers.authorization as string | undefined);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = userSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      userSessions.delete(token);
      return res.status(401).json({ error: 'Session expired.' });
    }

    const db = await loadSupportDb();
    const user = db.users.find((entry) => entry.id === session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  });

  app.get('/api/enduser/reports', async (req, res) => {
    const token = readBearerToken(req.headers.authorization as string | undefined);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = userSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      userSessions.delete(token);
      return res.status(401).json({ error: 'Session expired.' });
    }

    const db = await loadSupportDb();
    const userReports = db.reports
      .filter((report) => report.userId === session.userId)
      .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));

    return res.json(userReports);
  });

  app.get('/api/enduser/repositories', async (_req, res) => {
    if (!configuredGiteaBaseUrl) {
      return res.json([] satisfies SupportRepositoryOption[]);
    }

    try {
      const response = await axios.get(`${configuredGiteaBaseUrl}/api/v1/repos/search`, {
        params: {
          limit: 200,
          mode: 'source',
        },
        headers: giteaServiceToken
          ? {
              Authorization: `token ${giteaServiceToken}`,
            }
          : undefined,
        responseType: 'json',
      });

      const repositories = Array.isArray(response.data?.data) ? response.data.data : [];
      const options = repositories
        .filter((repository: any) => giteaServiceToken || !repository?.private)
        .map((repository: any) => ({
          id: Number(repository.id),
          fullName: String(repository.full_name || `${repository.owner?.login || ''}/${repository.name || ''}`),
          owner: String(repository.owner?.login || ''),
          name: String(repository.name || ''),
          description: repository.description ? String(repository.description) : undefined,
          private: Boolean(repository.private),
          archived: Boolean(repository.archived),
        }))
        .filter((repository: SupportRepositoryOption) => repository.owner && repository.name)
        .sort((left: SupportRepositoryOption, right: SupportRepositoryOption) => left.fullName.localeCompare(right.fullName));

      return res.json(options);
    } catch (error) {
      console.error('Failed to load support portal repositories:', error);
      return res.status(500).json({ error: 'Failed to load available repositories.' });
    }
  });

  app.post('/api/integrations/deploy/projects', async (req, res) => {
    const authenticated = requireDeveloperSession(req, res);
    if (!authenticated) {
      return;
    }

    if (!deployBaseUrl || !deployApiToken) {
      return res.status(503).json({ error: 'Deploy integration is not configured on this server.' });
    }

    const { owner, repo, payload } = req.body as { owner?: string; repo?: string; payload?: DeployProjectPayload };
    const safeOwner = String(owner || '').trim();
    const safeRepo = String(repo || '').trim();

    if (!safeOwner || !safeRepo || !payload?.name || !payload?.repoUrl || !payload?.branch) {
      return res.status(400).json({ error: 'owner, repo, and a valid Deploy payload are required.' });
    }

    const { session: developer } = authenticated;
    const projectPayload = {
      name: String(payload.name).trim(),
      repoUrl: String(payload.repoUrl).trim(),
      branch: String(payload.branch).trim(),
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      envVars: payload.envVars || {},
      buildFiles: Array.isArray(payload.buildFiles) ? payload.buildFiles : [],
      artifactPaths: Array.isArray(payload.artifactPaths) ? payload.artifactPaths : [],
      retainedRunCount: Number(payload.retainedRunCount || 10),
      queuePriorityClass: payload.queuePriorityClass === 'hotfix' ? 'hotfix' : 'normal',
      maxConcurrentBuilds: Number(payload.maxConcurrentBuilds || 1),
      remoteHostId: String(payload.remoteHostId || ''),
      autoBuild: Boolean(payload.autoBuild),
      webhookSecret: payload.webhookSecret ? String(payload.webhookSecret) : undefined,
      gitAuth: {
        type: 'basic',
        username: developer.username,
        password: developer.accessToken,
      },
    };

    try {
      const createdProjectResponse = await axios.post(`${deployBaseUrl}/api/projects`, projectPayload, {
        headers: {
          ...getDeployAuthHeaders(),
          'Content-Type': 'application/json',
        },
        responseType: 'json',
      });

      const projectId = String(createdProjectResponse.data?.id || '');
      if (!projectId) {
        throw new Error('Deploy did not return a project id.');
      }

      if (payload.deploymentSettings?.hostId) {
        await axios.put(
          `${deployBaseUrl}/api/projects/${encodeURIComponent(projectId)}/deployment-settings`,
          {
            hostId: payload.deploymentSettings.hostId,
            sourceType: payload.deploymentSettings.sourceType,
            composeFilePath: payload.deploymentSettings.sourceType === 'repo'
              ? String(payload.deploymentSettings.composeFilePath || '').trim() || undefined
              : undefined,
            composeContent: payload.deploymentSettings.sourceType === 'manual'
              ? String(payload.deploymentSettings.composeContent || '')
              : undefined,
            branchFilters: Array.isArray(payload.deploymentSettings.branchFilters) && payload.deploymentSettings.branchFilters.length > 0
              ? payload.deploymentSettings.branchFilters
              : [projectPayload.branch],
            autoDeploy: Boolean(payload.deploymentSettings.autoDeploy),
            enabled: payload.deploymentSettings.enabled !== false,
          },
          {
            headers: {
              ...getDeployAuthHeaders(),
              'Content-Type': 'application/json',
            },
            responseType: 'json',
          },
        );
      }

      return res.status(201).json({
        ok: true,
        project: createdProjectResponse.data,
        baseUrl: deployBaseUrl,
      });
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message || 'Failed to create Deploy project.';
      return res.status(status || 500).json({ error: message });
    }
  });

  app.post('/api/enduser/reports', async (req, res) => {
    const token = readBearerToken(req.headers.authorization as string | undefined);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = userSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      userSessions.delete(token);
      return res.status(401).json({ error: 'Session expired.' });
    }

    const { title, description, repositoryOwner, repositoryName, sourceLanguage } = req.body || {};
    const safeTitle = String(title || '').trim();
    const safeDescription = String(description || '').trim();
    const safeOwner = String(repositoryOwner || '').trim();
    const safeRepo = String(repositoryName || '').trim();

    if (!safeTitle || !safeDescription || !safeOwner || !safeRepo) {
      return res.status(400).json({ error: 'title, description, repositoryOwner, and repositoryName are required.' });
    }

    const db = await loadSupportDb();
    const user = db.users.find((entry) => entry.id === session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const report: SupportReport = {
      id: createId('report'),
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      sourceLanguage: sourceLanguage ? String(sourceLanguage) : undefined,
      title: safeTitle,
      description: safeDescription,
      repositoryOwner: safeOwner,
      repositoryName: safeRepo,
      status: 'submitted',
      messages: [],
      attachments: [],
      progress: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    addProgress(report, {
      status: 'submitted',
      note: 'Issue report submitted by user.',
      actorType: 'user',
      actorName: user.name,
    });

    db.reports.push(report);
    await saveSupportDb(db);
    return res.status(201).json(report);
  });

  app.post('/api/enduser/reports/:reportId/attachments', async (req, res) => {
    const token = readBearerToken(req.headers.authorization as string | undefined);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = userSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      userSessions.delete(token);
      return res.status(401).json({ error: 'Session expired.' });
    }

    const fileName = String(req.body?.fileName || '').trim();
    const mimeType = String(req.body?.mimeType || 'application/octet-stream').trim();
    const contentBase64 = String(req.body?.contentBase64 || '');

    if (!fileName || !contentBase64) {
      return res.status(400).json({ error: 'fileName and contentBase64 are required.' });
    }

    const content = decodeBase64Payload(contentBase64);
    if (!content.length) {
      return res.status(400).json({ error: 'Attachment payload is empty.' });
    }
    if (content.length > MAX_ATTACHMENT_BYTES) {
      return res.status(400).json({ error: 'Attachment too large. Max 10 MB.' });
    }

    const db = await loadSupportDb();
    const user = db.users.find((entry) => entry.id === session.userId);
    const report = db.reports.find((entry) => entry.id === req.params.reportId);

    if (!user || !report || report.userId !== session.userId) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const attachmentId = createId('attach');
    const { storageName } = await saveSupportAttachment(report.id, attachmentId, fileName, content);
    const attachment: SupportAttachment = {
      id: attachmentId,
      fileName: sanitizeFileName(fileName),
      mimeType: mimeType || 'application/octet-stream',
      size: content.length,
      uploadedByType: 'user',
      uploadedByName: user.name,
      uploadedAt: nowIso(),
      storageName,
    };

    report.attachments.push(attachment);
    report.updatedAt = nowIso();
    addProgress(report, {
      status: report.status,
      note: `User attached file: ${attachment.fileName}`,
      actorType: 'user',
      actorName: user.name,
    });

    await saveSupportDb(db);
    return res.status(201).json(attachment);
  });

  app.get('/api/enduser/reports/:reportId/attachments/:attachmentId', async (req, res) => {
    const token = readBearerToken(req.headers.authorization as string | undefined);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = userSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      userSessions.delete(token);
      return res.status(401).json({ error: 'Session expired.' });
    }

    const db = await loadSupportDb();
    const report = db.reports.find((entry) => entry.id === req.params.reportId);
    if (!report || report.userId !== session.userId) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const attachment = report.attachments.find((entry) => entry.id === req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    const filePath = getSupportAttachmentPath(report.id, attachment.storageName);
    try {
      await fs.access(filePath);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
      return res.sendFile(filePath);
    } catch {
      return res.status(404).json({ error: 'Attachment file missing.' });
    }
  });

  app.post('/api/enduser/reports/:reportId/messages', async (req, res) => {
    const token = readBearerToken(req.headers.authorization as string | undefined);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = userSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      userSessions.delete(token);
      return res.status(401).json({ error: 'Session expired.' });
    }

    const body = String(req.body?.body || '').trim();
    if (!body) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    const db = await loadSupportDb();
    const user = db.users.find((entry) => entry.id === session.userId);
    const report = db.reports.find((entry) => entry.id === req.params.reportId);

    if (!user || !report || report.userId !== session.userId) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const message: SupportMessage = {
      id: createId('message'),
      authorType: 'user',
      authorId: user.id,
      authorName: user.name,
      body,
      createdAt: nowIso(),
    };

    report.messages.push(message);
    report.updatedAt = nowIso();
    addProgress(report, {
      status: report.status,
      note: 'User sent a new clarification message.',
      actorType: 'user',
      actorName: user.name,
    });

    await saveSupportDb(db);
    return res.status(201).json(message);
  });

  app.get('/api/enduser/reports/:reportId', async (req, res) => {
    const token = readBearerToken(req.headers.authorization as string | undefined);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = userSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      userSessions.delete(token);
      return res.status(401).json({ error: 'Session expired.' });
    }

    const db = await loadSupportDb();
    const report = db.reports.find((entry) => entry.id === req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const sanitized = sanitizeForUser(report, session.userId);
    if (!sanitized) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    return res.json(sanitized);
  });

  app.get('/api/support/reports', async (req, res) => {
    if (!requireDeveloperSession(req, res)) {
      return;
    }

    const statusFilter = String(req.query.status || '').trim();
    const db = await loadSupportDb();
    const reports = db.reports
      .filter((report) => (statusFilter ? report.status === statusFilter : true))
      .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));

    return res.json(reports);
  });

  app.patch('/api/support/reports/:reportId', async (req, res) => {
    const authenticated = requireDeveloperSession(req, res);
    if (!authenticated) {
      return;
    }
    const { session: developer } = authenticated;

    const db = await loadSupportDb();
    const report = db.reports.find((entry) => entry.id === req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const status = req.body?.status as SupportStatus | undefined;
    const translatedTitle = req.body?.translatedTitle as string | undefined;
    const translatedDescription = req.body?.translatedDescription as string | undefined;
    const note = req.body?.note as string | undefined;

    if (translatedTitle !== undefined) {
      report.translatedTitle = String(translatedTitle).trim();
    }
    if (translatedDescription !== undefined) {
      report.translatedDescription = String(translatedDescription).trim();
    }
    if (status) {
      report.status = status;
      addProgress(report, {
        status,
        note: note?.trim() || `Status updated to ${status}.`,
        actorType: 'developer',
        actorName: developer.username,
      });
    }

    report.updatedAt = nowIso();
    await saveSupportDb(db);
    return res.json(report);
  });

  app.post('/api/support/reports/:reportId/messages', async (req, res) => {
    const body = String(req.body?.body || '').trim();

    if (!body) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    const authenticated = requireDeveloperSession(req, res);
    if (!authenticated) {
      return;
    }
    const { session: developer } = authenticated;

    const db = await loadSupportDb();
    const report = db.reports.find((entry) => entry.id === req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const message: SupportMessage = {
      id: createId('message'),
      authorType: 'developer',
      authorId: developer.username,
      authorName: developer.username,
      body,
      createdAt: nowIso(),
    };

    report.messages.push(message);
    report.updatedAt = nowIso();
    addProgress(report, {
      status: report.status,
      note: 'Developer sent a response.',
      actorType: 'developer',
      actorName: developer.username,
    });

    await saveSupportDb(db);
    return res.status(201).json(message);
  });

  app.get('/api/support/reports/:reportId/attachments/:attachmentId', async (req, res) => {
    if (!requireDeveloperSession(req, res)) {
      return;
    }

    const db = await loadSupportDb();
    const report = db.reports.find((entry) => entry.id === req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const attachment = report.attachments.find((entry) => entry.id === req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    const filePath = getSupportAttachmentPath(report.id, attachment.storageName);
    try {
      await fs.access(filePath);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
      return res.sendFile(filePath);
    } catch {
      return res.status(404).json({ error: 'Attachment file missing.' });
    }
  });

  app.post('/api/support/reports/:reportId/approve', async (req, res) => {
    const authenticated = requireDeveloperSession(req, res);
    if (!authenticated) {
      return;
    }
    const { session: developer } = authenticated;

    const db = await loadSupportDb();
    const report = db.reports.find((entry) => entry.id === req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const owner = String(req.body?.repositoryOwner || report.repositoryOwner || '').trim();
    const repo = String(req.body?.repositoryName || report.repositoryName || '').trim();
    const labels = Array.isArray(req.body?.labels)
      ? req.body.labels.map((entry: unknown) => String(entry))
      : ['user-reported'];
    const milestone = req.body?.milestone ? Number(req.body.milestone) : undefined;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'repositoryOwner and repositoryName are required for approval.' });
    }

    const issueTitle = String(req.body?.title || report.translatedTitle || report.title).trim();
    const issueBody = String(req.body?.body || report.translatedDescription || report.description).trim();

    try {
      const labelIds = await ensureRepositoryLabels(developer, owner, repo, labels);

      const issueResponse = await axios.post(
        `${developer.baseUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        {
          title: issueTitle,
          body: issueBody,
          labels: labelIds,
          milestone,
        },
        {
          headers: {
            ...getDeveloperAuthHeaders(developer),
            'Content-Type': 'application/json',
          },
          responseType: 'json',
        },
      );

      report.status = 'converted';
      report.updatedAt = nowIso();
      report.approvedBy = developer.username;
      report.giteaIssue = {
        number: Number(issueResponse.data?.number || 0),
        url: issueResponse.data?.url,
        html_url: issueResponse.data?.html_url,
      };

      addProgress(report, {
        status: 'approved',
        note: `Approved by ${developer.username}.`,
        actorType: 'developer',
        actorName: developer.username,
      });
      addProgress(report, {
        status: 'converted',
        note: `Created Gitea issue #${report.giteaIssue.number} in ${owner}/${repo}.`,
        actorType: 'system',
        actorName: 'GitFlow',
      });

      await saveSupportDb(db);
      return res.json(report);
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message || 'Failed to create Gitea issue.';
      return res.status(status || 500).json({ error: message });
    }
  });

  // Gitea Proxy Route
  // This handles requests to Gitea instances to avoid CORS issues
  app.all('/api/proxy', async (req, res) => {
    const authenticated = requireDeveloperSession(req, res);
    if (!authenticated) {
      return;
    }
    const { session } = authenticated;

    let targetUrl = req.headers['x-target-url'] as string;
    const proxyMethod = req.headers['x-proxy-method'] as string | undefined;
    const proxyBodyType = req.headers['x-proxy-body-type'] as string | undefined;
    const method = (proxyMethod || req.method).toUpperCase();

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing x-target-url header' });
    }

    // Fix common swagger endpoint mismatches
    // gitea-js might try to access /api/swagger but Gitea uses /api/v1/swagger.v1.json
    if (targetUrl.endsWith('/api/swagger')) {
      targetUrl = targetUrl.replace('/api/swagger', '/api/v1/swagger.v1.json');
    }

    if (!targetUrl.startsWith(session.baseUrl)) {
      return res.status(403).json({ error: 'Proxy target is outside the configured Gitea instance.' });
    }

    try {
      const isMultipart = proxyBodyType === 'form-data';
      const response = await axios({
        method,
        url: targetUrl,
        data: ['GET', 'HEAD'].includes(method) ? undefined : isMultipart ? req : req.body,
        params: req.query,
        headers: {
          ...getDeveloperAuthHeaders(session),
          'Content-Type': isMultipart ? req.headers['content-type'] : 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        responseType: 'json',
      });

      if (response.status === 204 || response.data === '') {
        res.status(response.status).end();
        return;
      }

      res.status(response.status).json(response.data);
    } catch (error: any) {
      const status = error.response?.status as number | undefined;
      const shouldLogAsError = !status || status >= 500;

      if (shouldLogAsError) {
        console.error(`Proxy error (${method} ${targetUrl}):`, error.message);
      } else if (status !== 404 && status !== 401) {
        console.warn(`Proxy warning (${method} ${targetUrl}) [${status}]:`, error.message);
      }

      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: 'Internal server error during proxying' });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
