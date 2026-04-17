import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Clock3, FileText, Inbox, Languages, LogOut, MessageSquare, RefreshCw, Search, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';

interface PortalUser {
  id: string;
  email: string;
  name: string;
}

interface PortalRepositoryOption {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  description?: string;
  private: boolean;
  archived?: boolean;
}

interface PortalMessage {
  id: string;
  authorType: 'user' | 'developer';
  authorName: string;
  body: string;
  createdAt: string;
}

interface PortalProgress {
  id: string;
  status: string;
  note: string;
  createdAt: string;
  actorType: 'user' | 'developer' | 'system';
  actorName?: string;
}

interface PortalAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedByName: string;
  uploadedAt: string;
}

interface AttachmentPreview {
  kind: 'image' | 'text' | 'other';
  loading: boolean;
  error?: string;
  url?: string;
  text?: string;
}

interface PortalReport {
  id: string;
  title: string;
  description: string;
  status: string;
  repositoryOwner: string;
  repositoryName: string;
  translatedTitle?: string;
  translatedDescription?: string;
  createdAt: string;
  updatedAt: string;
  messages: PortalMessage[];
  attachments: PortalAttachment[];
  progress: PortalProgress[];
  giteaIssue?: {
    number: number;
    html_url?: string;
  };
}

const TOKEN_KEY = 'gitflow_enduser_token';
const PREVIEW_CACHE_STORAGE_KEY = 'gitflow_enduser_preview_cache_v1';
const PREVIEW_CACHE_MAX_ENTRIES = 40;

function statusTone(status: string) {
  switch (status) {
    case 'submitted':
      return 'bg-slate-100 text-slate-700';
    case 'triaged':
    case 'translated':
      return 'bg-indigo-50 text-indigo-700';
    case 'in-review':
      return 'bg-amber-50 text-amber-700';
    case 'approved':
      return 'bg-emerald-50 text-emerald-700';
    case 'converted':
      return 'bg-sky-50 text-sky-700';
    case 'rejected':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

async function portalRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body as T;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function EndUserPortalView() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<PortalUser | null>(null);
  const [reports, setReports] = useState<PortalReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [availableRepositories, setAvailableRepositories] = useState<PortalRepositoryOption[]>([]);
  const [repositorySearch, setRepositorySearch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('pt-BR');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [threadFiles, setThreadFiles] = useState<File[]>([]);
  const [isThreadDropzoneActive, setIsThreadDropzoneActive] = useState(false);
  const [uploadingThreadFiles, setUploadingThreadFiles] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, AttachmentPreview>>(() => {
    try {
      const raw = sessionStorage.getItem(PREVIEW_CACHE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, AttachmentPreview>;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch {
      return {};
    }
  });
  const [newMessage, setNewMessage] = useState('');
  const previewOrderRef = useRef<string[]>([]);
  const previewsRef = useRef<Record<string, AttachmentPreview>>({});

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) || reports[0] || null,
    [reports, selectedReportId],
  );
  const selectedRepositoryValue = repoOwner && repoName ? `${repoOwner}/${repoName}` : '';
  const filteredRepositories = useMemo(() => {
    const query = repositorySearch.trim().toLowerCase();
    if (!query) {
      return availableRepositories;
    }

    return availableRepositories.filter((repository) => {
      const haystack = [repository.fullName, repository.description].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [availableRepositories, repositorySearch]);
  const reportStats = useMemo(() => ({
    total: reports.length,
    active: reports.filter((report) => !['converted', 'rejected'].includes(report.status)).length,
    converted: reports.filter((report) => report.status === 'converted').length,
    unreadConversation: reports.filter((report) => report.messages.length > 0).length,
  }), [reports]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setReports([]);
      return;
    }
    void loadSession();
    const poll = setInterval(() => {
      void loadReports(token);
    }, 10000);
    return () => clearInterval(poll);
  }, [token]);

  useEffect(() => {
    setThreadFiles([]);
    setIsThreadDropzoneActive(false);
  }, [selectedReportId]);

  useEffect(() => {
    previewsRef.current = attachmentPreviews;
    const serializable: Record<string, AttachmentPreview> = {};
    Object.entries(attachmentPreviews).forEach(([key, preview]) => {
      if (preview.loading) {
        return;
      }
      if (preview.kind === 'text') {
        serializable[key] = { kind: 'text', loading: false, text: preview.text };
      } else if (preview.kind === 'other' && !preview.url) {
        serializable[key] = { kind: 'other', loading: false, error: preview.error };
      }
    });
    try {
      sessionStorage.setItem(PREVIEW_CACHE_STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore cache persistence failures.
    }
  }, [attachmentPreviews]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((preview) => {
        if (preview.url) {
          URL.revokeObjectURL(preview.url);
        }
      });
    };
  }, []);

  async function loadSession() {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      const me = await portalRequest<PortalUser>('/api/enduser/me', { method: 'GET' }, token);
      setUser(me);
      await Promise.all([loadReports(token), loadRepositories()]);
      setError(null);
    } catch (sessionError: any) {
      setError(sessionError.message || 'Session error');
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function loadReports(currentToken = token) {
    if (!currentToken) {
      return;
    }
    const fetched = await portalRequest<PortalReport[]>('/api/enduser/reports', { method: 'GET' }, currentToken);
    setReports(fetched);
    if (!selectedReportId && fetched.length > 0) {
      setSelectedReportId(fetched[0].id);
    }
  }

  async function loadRepositories() {
    const fetched = await portalRequest<PortalRepositoryOption[] | null>('/api/enduser/repositories', { method: 'GET' });
    setAvailableRepositories(Array.isArray(fetched) ? fetched : []);
  }

  async function handleAuthSubmit() {
    try {
      setLoading(true);
      setError(null);
      if (authMode === 'register') {
        await portalRequest('/api/enduser/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, name }),
        });
      }

      const login = await portalRequest<{ token: string; user: PortalUser }>('/api/enduser/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, login.token);
      setToken(login.token);
      setUser(login.user);
      setPassword('');
      await loadRepositories();
    } catch (authError: any) {
      setError(authError.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateReport() {
    if (!token) {
      return;
    }
    if (!title.trim() || !description.trim() || !repoOwner.trim() || !repoName.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const report = await portalRequest<PortalReport>('/api/enduser/reports', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          repositoryOwner: repoOwner,
          repositoryName: repoName,
          sourceLanguage,
        }),
      }, token);

      for (const file of reportFiles) {
        const base64 = await fileToBase64(file);
        await portalRequest(`/api/enduser/reports/${report.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            contentBase64: base64,
          }),
        }, token);
      }

      await loadReports(token);
      setSelectedReportId(report.id);
      setTitle('');
      setDescription('');
      setReportFiles([]);
    } catch (createError: any) {
      setError(createError.message || 'Failed to create report');
    } finally {
      setLoading(false);
    }
  }

  function appendReportFiles(nextFiles: File[]) {
    setReportFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const merged = [...current];
      for (const file of nextFiles) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!existing.has(key)) {
          merged.push(file);
          existing.add(key);
        }
      }
      return merged;
    });
  }

  function removeReportFile(target: File) {
    const key = `${target.name}:${target.size}:${target.lastModified}`;
    setReportFiles((current) => current.filter((file) => `${file.name}:${file.size}:${file.lastModified}` !== key));
  }

  function appendThreadFiles(nextFiles: File[]) {
    setThreadFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const merged = [...current];
      for (const file of nextFiles) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!existing.has(key)) {
          merged.push(file);
          existing.add(key);
        }
      }
      return merged;
    });
  }

  function removeThreadFile(target: File) {
    const key = `${target.name}:${target.size}:${target.lastModified}`;
    setThreadFiles((current) => current.filter((file) => `${file.name}:${file.size}:${file.lastModified}` !== key));
  }

  function setPreviewCache(previewKey: string, preview: AttachmentPreview) {
    setAttachmentPreviews((current) => {
      const next = { ...current };
      const existing = next[previewKey];
      if (existing?.url && existing.url !== preview.url) {
        URL.revokeObjectURL(existing.url);
      }
      next[previewKey] = preview;

      previewOrderRef.current = [...previewOrderRef.current.filter((key) => key !== previewKey), previewKey];
      while (previewOrderRef.current.length > PREVIEW_CACHE_MAX_ENTRIES) {
        const evictKey = previewOrderRef.current.shift();
        if (!evictKey || evictKey === previewKey) {
          continue;
        }
        const evicted = next[evictKey];
        if (evicted?.url) {
          URL.revokeObjectURL(evicted.url);
        }
        delete next[evictKey];
      }

      return next;
    });
  }

  async function uploadThreadAttachments() {
    if (!token || !selectedReport || threadFiles.length === 0) {
      return;
    }

    try {
      setUploadingThreadFiles(true);
      setError(null);
      for (const file of threadFiles) {
        const base64 = await fileToBase64(file);
        await portalRequest(`/api/enduser/reports/${selectedReport.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            contentBase64: base64,
          }),
        }, token);
      }
      setThreadFiles([]);
      await loadReports(token);
    } catch (uploadError: any) {
      setError(uploadError.message || 'Failed to upload attachments');
    } finally {
      setUploadingThreadFiles(false);
    }
  }

  async function handleSendMessage() {
    if (!token || !selectedReport || !newMessage.trim()) {
      return;
    }
    try {
      setLoading(true);
      await portalRequest(`/api/enduser/reports/${selectedReport.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: newMessage }),
      }, token);
      setNewMessage('');
      await loadReports(token);
    } catch (messageError: any) {
      setError(messageError.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  async function downloadAttachment(reportId: string, attachment: PortalAttachment) {
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`/api/enduser/reports/${reportId}/attachments/${attachment.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Unable to download attachment');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      setError(downloadError.message || 'Failed to download attachment');
    }
  }

  async function previewAttachment(reportId: string, attachment: PortalAttachment) {
    if (!token) {
      return;
    }

    const previewKey = `${reportId}:${attachment.id}`;
    const cached = attachmentPreviews[previewKey];
    if (cached && !cached.loading && (cached.kind !== 'image' || Boolean(cached.url))) {
      return;
    }

    setPreviewCache(previewKey, { kind: 'other', loading: true });

    try {
      const response = await fetch(`/api/enduser/reports/${reportId}/attachments/${attachment.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Unable to preview attachment');
      }

      const blob = await response.blob();
      const mimeType = attachment.mimeType || blob.type || 'application/octet-stream';

      if (mimeType.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(blob);
        setPreviewCache(previewKey, { kind: 'image', loading: false, url: objectUrl });
        return;
      }

      if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('yaml') || mimeType.includes('javascript')) {
        const text = await blob.text();
        setPreviewCache(previewKey, { kind: 'text', loading: false, text: text.slice(0, 5000) });
        return;
      }

      setPreviewCache(previewKey, { kind: 'other', loading: false });
    } catch (previewError: any) {
      setPreviewCache(previewKey, { kind: 'other', loading: false, error: previewError.message || 'Preview failed' });
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setReports([]);
    setSelectedReportId(null);
  }

  if (!token || !user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.14),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-4 sm:p-6">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_440px]">
          <div className="hidden rounded-[2rem] border border-white/60 bg-white/70 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
              <Sparkles className="h-3.5 w-3.5" /> Support Portal
            </div>
            <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-tight text-slate-950">
              Report product issues without losing the thread.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Send a problem report in your own language, attach context, and follow the discussion until the team converts it into a repository issue.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <Languages className="h-5 w-5 text-indigo-500" />
                <div className="mt-4 text-sm font-semibold text-slate-900">Native-language intake</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">Users can explain the issue naturally before engineering rewrites it.</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <UploadCloud className="h-5 w-5 text-sky-500" />
                <div className="mt-4 text-sm font-semibold text-slate-900">Attachments and follow-up</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">Logs, screenshots, and later clarifications stay attached to one report thread.</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <div className="mt-4 text-sm font-semibold text-slate-900">Traceable delivery</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">See when triage happens, when a report is approved, and when it becomes a Gitea issue.</div>
              </div>
            </div>
          </div>

          <Card className="border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <CardHeader className="space-y-5 p-8 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                  <Inbox className="h-5 w-5" />
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 p-1">
                  <div className="flex gap-1">
                    <Button variant={authMode === 'login' ? 'default' : 'ghost'} size="sm" className={authMode === 'login' ? 'bg-slate-950 text-white hover:bg-slate-800' : 'text-slate-600'} onClick={() => setAuthMode('login')}>Login</Button>
                    <Button variant={authMode === 'register' ? 'default' : 'ghost'} size="sm" className={authMode === 'register' ? 'bg-slate-950 text-white hover:bg-slate-800' : 'text-slate-600'} onClick={() => setAuthMode('register')}>Register</Button>
                  </div>
                </div>
              </div>
              <div>
                <CardTitle className="text-3xl tracking-tight text-slate-950">
                  {authMode === 'login' ? 'Welcome back' : 'Create your portal account'}
                </CardTitle>
                <CardDescription className="mt-2 text-base leading-7 text-slate-500">
                  {authMode === 'login'
                    ? 'Sign in to review updates, upload more evidence, and keep the conversation moving.'
                    : 'Register once so your reports, files, and follow-up messages stay attached to one timeline.'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-8 pt-2">
              {authMode === 'register' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name</label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="h-11 border-slate-200 bg-slate-50" />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-11 border-slate-200 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Password</label>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 border-slate-200 bg-slate-50" />
              </div>
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
              <Button className="h-11 w-full bg-slate-950 text-white hover:bg-slate-800" onClick={handleAuthSubmit} disabled={loading}>
                {loading ? 'Please wait...' : authMode === 'login' ? 'Access support portal' : 'Register and continue'}
              </Button>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">
                Reports stay private to your account. You can come back later, add screenshots or logs, and see when support turns your report into a tracked engineering issue.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.12),_transparent_20%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <div className="rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Customer Support</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Support Portal</h1>
              <p className="mt-2 text-sm text-slate-500">Logged in as {user.name} ({user.email})</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-slate-200 bg-white" onClick={() => void loadReports()} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button variant="outline" className="border-slate-200 bg-white" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400"><FileText className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.2em]">Reports</span></div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{reportStats.total}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-500"><Clock3 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Active</span></div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{reportStats.active}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-500"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Converted</span></div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{reportStats.converted}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-sky-500"><MessageSquare className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Threads</span></div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{reportStats.unreadConversation}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Your workspace</h2>
            <p className="text-sm text-slate-500">Create a new report on the left and track every reply, file, and status update on the right.</p>
          </div>
        </div>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-6 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
          <Card className="border-white/60 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)] xl:sticky xl:top-6 xl:self-start">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Report New Problem</CardTitle>
                  <CardDescription>Capture the issue clearly and choose the repository it belongs to.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Repository</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={repositorySearch} onChange={(event) => setRepositorySearch(event.target.value)} placeholder="Search repository" className="pl-9 border-slate-200 bg-slate-50" />
                </div>
              </div>
              <select
                value={selectedRepositoryValue}
                onChange={(event) => {
                  const [owner, name] = event.target.value.split('/');
                  setRepoOwner(owner || '');
                  setRepoName(name || '');
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="">{availableRepositories.length === 0 ? 'No repositories available' : 'Select repository'}</option>
                {filteredRepositories.map((repository) => (
                  <option key={repository.id} value={`${repository.owner}/${repository.name}`}>
                    {repository.fullName}{repository.archived ? ' (Archived)' : ''}{repository.description ? ` - ${repository.description}` : ''}
                  </option>
                ))}
              </select>
              {availableRepositories.length === 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No repositories are visible to the portal right now. If your repositories are private, add `GITEA_SERVICE_TOKEN` to the backend environment so the portal can list them.
                </div>
              )}
              {selectedRepositoryValue && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Sending this report to <span className="font-medium text-slate-900">{selectedRepositoryValue}</span>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Language</label>
                <Input value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} placeholder="Language, e.g. pt-BR" className="border-slate-200 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Title</label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short title" className="border-slate-200 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Description</label>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue, impact, and expected behavior" className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-300" />
              </div>
              <div
                className={`rounded-3xl border-2 border-dashed p-4 transition-colors ${isDropzoneActive ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDropzoneActive(true);
                }}
                onDragLeave={() => setIsDropzoneActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDropzoneActive(false);
                  appendReportFiles(Array.from(event.dataTransfer.files || []));
                }}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><UploadCloud className="h-4 w-4 text-sky-500" /> Drag and drop attachments here</div>
                <div className="mt-1 text-xs text-slate-500">Add screenshots, logs, or recordings. Maximum 10 MB per file.</div>
                <Input
                  className="mt-3"
                  type="file"
                  multiple
                  onChange={(event) => appendReportFiles(Array.from(event.target.files || []))}
                />
              </div>
              {reportFiles.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                  {reportFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 py-1">
                      <span>{file.name} ({formatBytes(file.size)})</span>
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => removeReportFile(file)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
              <Button className="h-11 w-full bg-slate-950 text-white hover:bg-slate-800" onClick={handleCreateReport} disabled={loading}>
                Submit report
              </Button>
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="border-white/60 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <CardHeader>
                <CardTitle>Your reports</CardTitle>
                <CardDescription>Select a report to inspect its thread and timeline.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[60vh] pr-3 2xl:h-[calc(100vh-16rem)] 2xl:max-h-none">
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => setSelectedReportId(report.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedReport?.id === report.id ? 'border-sky-300 bg-sky-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">{report.title}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">{report.repositoryOwner}/{report.repositoryName}</div>
                          </div>
                          <Badge className={`shrink-0 ${statusTone(report.status)}`}>{report.status}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                          <span>{report.messages.length} messages</span>
                          <span>{new Date(report.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))}
                    {reports.length === 0 && <div className="text-sm text-slate-500">No reports yet.</div>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-white/60 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <CardHeader>
                <CardTitle>{selectedReport?.title || 'Select a report'}</CardTitle>
                {selectedReport && (
                  <CardDescription>
                    {selectedReport.repositoryOwner}/{selectedReport.repositoryName}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="min-w-0">
                {!selectedReport ? (
                  <div className="text-sm text-slate-500">Choose a report to see discussion and progress.</div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Status</div>
                        <Badge className={`mt-3 ${statusTone(selectedReport.status)}`}>{selectedReport.status}</Badge>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Repository</div>
                        <div className="mt-3 text-sm font-medium text-slate-900">{selectedReport.repositoryOwner}/{selectedReport.repositoryName}</div>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Last updated</div>
                        <div className="mt-3 text-sm font-medium text-slate-900">{new Date(selectedReport.updatedAt).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Original description</div>
                      <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{selectedReport.description}</div>
                    </div>
                    {selectedReport.translatedDescription && (
                      <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Translated / developer-ready</div>
                        <div className="mt-1 text-sm text-indigo-800 whitespace-pre-wrap">{selectedReport.translatedDescription}</div>
                      </div>
                    )}
                    {selectedReport.giteaIssue?.number && (
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        Created as Gitea issue #{selectedReport.giteaIssue.number}
                        {selectedReport.giteaIssue.html_url && (
                          <a className="ml-2 underline" href={selectedReport.giteaIssue.html_url} target="_blank" rel="noreferrer">Open</a>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Attachments</div>
                      <div
                        className={`mb-3 rounded-3xl border-2 border-dashed p-4 transition-colors ${isThreadDropzoneActive ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setIsThreadDropzoneActive(true);
                        }}
                        onDragLeave={() => setIsThreadDropzoneActive(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          setIsThreadDropzoneActive(false);
                          appendThreadFiles(Array.from(event.dataTransfer.files || []));
                        }}
                      >
                        <div className="text-xs text-slate-600">Drag and drop follow-up files here or choose files below.</div>
                        <Input className="mt-2" type="file" multiple onChange={(event) => appendThreadFiles(Array.from(event.target.files || []))} />
                        {threadFiles.length > 0 && (
                          <div className="mt-2 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 text-xs text-slate-600">
                            {threadFiles.map((file) => (
                              <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2">
                                <span>{file.name} ({formatBytes(file.size)})</span>
                                <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => removeThreadFile(file)}>Remove</Button>
                              </div>
                            ))}
                            <Button className="mt-2 h-8 bg-sky-600 px-3 text-xs text-white hover:bg-sky-700" disabled={uploadingThreadFiles} onClick={() => void uploadThreadAttachments()}>
                              {uploadingThreadFiles ? 'Uploading...' : 'Upload to this report'}
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {selectedReport.attachments.map((attachment) => (
                          <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm text-slate-700">
                                <div>{attachment.fileName}</div>
                                <div className="text-xs text-slate-500">{formatBytes(attachment.size)} · {new Date(attachment.uploadedAt).toLocaleString()}</div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => void previewAttachment(selectedReport.id, attachment)}>
                                  Preview
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => void downloadAttachment(selectedReport.id, attachment)}>
                                  Download
                                </Button>
                              </div>
                            </div>
                            {(() => {
                              const preview = attachmentPreviews[`${selectedReport.id}:${attachment.id}`];
                              if (!preview) return null;
                              if (preview.loading) {
                                return <div className="mt-2 text-xs text-slate-500">Generating preview...</div>;
                              }
                              if (preview.error) {
                                return <div className="mt-2 text-xs text-rose-600">{preview.error}</div>;
                              }
                              if (preview.kind === 'image' && preview.url) {
                                return <img src={preview.url} alt={attachment.fileName} className="mt-2 max-h-64 w-auto rounded border border-slate-200" />;
                              }
                              if (preview.kind === 'text' && preview.text !== undefined) {
                                return <pre className="mt-2 max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 whitespace-pre-wrap">{preview.text}</pre>;
                              }
                              return <div className="mt-2 text-xs text-slate-500">Preview not available for this file type.</div>;
                            })()}
                          </div>
                        ))}
                        {selectedReport.attachments.length === 0 && <div className="text-sm text-slate-500">No attachments.</div>}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Progress timeline</div>
                      <div className="space-y-3">
                        {selectedReport.progress.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="font-semibold uppercase tracking-[0.16em]">{entry.status}</span>
                              <span>{new Date(entry.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="text-sm text-slate-700 mt-1">{entry.note}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Conversation</div>
                      <ScrollArea className="max-h-72 rounded-3xl border border-slate-200 bg-slate-50 p-3 xl:max-h-96">
                        <div className="space-y-2 pr-3">
                          {selectedReport.messages.map((message) => (
                            <div key={message.id} className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
                              <div className="text-xs text-slate-500">{message.authorName} · {new Date(message.createdAt).toLocaleString()}</div>
                              <div className="text-sm text-slate-700 whitespace-pre-wrap">{message.body}</div>
                            </div>
                          ))}
                          {selectedReport.messages.length === 0 && <div className="text-sm text-slate-500">No messages yet.</div>}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Reply</div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input value={newMessage} onChange={(event) => setNewMessage(event.target.value)} placeholder="Send a follow-up message" className="min-w-0 border-slate-200 bg-white" />
                        <Button onClick={handleSendMessage} disabled={!newMessage.trim() || loading} className="bg-slate-950 text-white hover:bg-slate-800">Send</Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
