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
  expiresAt: number;
}

const SUPPORT_DB_PATH = path.join(process.cwd(), '.data', 'support-workflow.json');
const SUPPORT_ATTACHMENTS_DIR = path.join(process.cwd(), '.data', 'support-attachments');
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const USER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const DEVELOPER_SESSION_TTL_MS = 1000 * 60 * 5;

const userSessions = new Map<string, EndUserSession>();
const developerSessions = new Map<string, DeveloperSession>();

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

function sanitizeForUser(report: SupportReport, userId: string) {
  if (report.userId !== userId) {
    return null;
  }
  return report;
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

  app.use(express.json());

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

  async function authenticateDeveloper(giteaBaseUrl: string, giteaToken: string) {
    const normalizedBaseUrl = normalizeBaseUrl(giteaBaseUrl);
    const cacheKey = `${normalizedBaseUrl}:${giteaToken}`;
    const cached = developerSessions.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { username: cached.username, baseUrl: normalizedBaseUrl };
    }

    const response = await axios.get(`${normalizedBaseUrl}/api/v1/user`, {
      headers: {
        Authorization: `token ${giteaToken}`,
      },
      responseType: 'json',
    });

    const username = response.data?.login || response.data?.username;
    if (!username) {
      throw new Error('Unable to authenticate developer identity.');
    }

    developerSessions.set(cacheKey, {
      username,
      expiresAt: Date.now() + DEVELOPER_SESSION_TTL_MS,
    });

    return { username, baseUrl: normalizedBaseUrl };
  }

  app.get('/api/support/reports', async (req, res) => {
    const giteaToken = String(req.headers['x-gitea-token'] || '');
    const giteaBaseUrl = String(req.headers['x-gitea-base-url'] || '');

    if (!giteaToken || !giteaBaseUrl) {
      return res.status(401).json({ error: 'Developer authentication headers are required.' });
    }

    try {
      await authenticateDeveloper(giteaBaseUrl, giteaToken);
    } catch {
      return res.status(401).json({ error: 'Invalid developer credentials.' });
    }

    const statusFilter = String(req.query.status || '').trim();
    const db = await loadSupportDb();
    const reports = db.reports
      .filter((report) => (statusFilter ? report.status === statusFilter : true))
      .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));

    return res.json(reports);
  });

  app.patch('/api/support/reports/:reportId', async (req, res) => {
    const giteaToken = String(req.headers['x-gitea-token'] || '');
    const giteaBaseUrl = String(req.headers['x-gitea-base-url'] || '');

    if (!giteaToken || !giteaBaseUrl) {
      return res.status(401).json({ error: 'Developer authentication headers are required.' });
    }

    let developer;
    try {
      developer = await authenticateDeveloper(giteaBaseUrl, giteaToken);
    } catch {
      return res.status(401).json({ error: 'Invalid developer credentials.' });
    }

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
    const giteaToken = String(req.headers['x-gitea-token'] || '');
    const giteaBaseUrl = String(req.headers['x-gitea-base-url'] || '');
    const body = String(req.body?.body || '').trim();

    if (!giteaToken || !giteaBaseUrl) {
      return res.status(401).json({ error: 'Developer authentication headers are required.' });
    }
    if (!body) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    let developer;
    try {
      developer = await authenticateDeveloper(giteaBaseUrl, giteaToken);
    } catch {
      return res.status(401).json({ error: 'Invalid developer credentials.' });
    }

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
    const giteaToken = String(req.headers['x-gitea-token'] || '');
    const giteaBaseUrl = String(req.headers['x-gitea-base-url'] || '');

    if (!giteaToken || !giteaBaseUrl) {
      return res.status(401).json({ error: 'Developer authentication headers are required.' });
    }

    try {
      await authenticateDeveloper(giteaBaseUrl, giteaToken);
    } catch {
      return res.status(401).json({ error: 'Invalid developer credentials.' });
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
    const giteaToken = String(req.headers['x-gitea-token'] || '');
    const giteaBaseUrl = String(req.headers['x-gitea-base-url'] || '');

    if (!giteaToken || !giteaBaseUrl) {
      return res.status(401).json({ error: 'Developer authentication headers are required.' });
    }

    let developer;
    try {
      developer = await authenticateDeveloper(giteaBaseUrl, giteaToken);
    } catch {
      return res.status(401).json({ error: 'Invalid developer credentials.' });
    }

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
      const issueResponse = await axios.post(
        `${normalizeBaseUrl(giteaBaseUrl)}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        {
          title: issueTitle,
          body: issueBody,
          labels,
          milestone,
        },
        {
          headers: {
            Authorization: `token ${giteaToken}`,
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
    let targetUrl = req.headers['x-target-url'] as string;
    const token = req.headers['x-gitea-token'] as string;
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

    try {
      const isMultipart = proxyBodyType === 'form-data';
      const response = await axios({
        method,
        url: targetUrl,
        data: ['GET', 'HEAD'].includes(method) ? undefined : isMultipart ? req : req.body,
        params: req.query,
        headers: {
          'Authorization': token ? `token ${token}` : undefined,
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
