import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PortalUser {
  id: string;
  email: string;
  name: string;
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
      await loadReports(token);
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
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-lg">
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle>User Support Portal</CardTitle>
              <CardDescription>Report issues and track progress until they become Gitea tickets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant={authMode === 'login' ? 'default' : 'outline'} onClick={() => setAuthMode('login')}>Login</Button>
                <Button variant={authMode === 'register' ? 'default' : 'outline'} onClick={() => setAuthMode('register')}>Register</Button>
              </div>
              {authMode === 'register' && (
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
              )}
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
              {error && <div className="text-sm text-rose-600">{error}</div>}
              <Button className="w-full bg-sky-600 text-white hover:bg-sky-700" onClick={handleAuthSubmit} disabled={loading}>
                {loading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Register and Login'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Support Portal</h1>
            <p className="text-sm text-slate-500">Logged in as {user.name} ({user.email})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadReports()} disabled={loading}>Refresh</Button>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>

        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Report New Problem</CardTitle>
              <CardDescription>Send context in your own language, developers can answer before creating a repository issue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={repoOwner} onChange={(event) => setRepoOwner(event.target.value)} placeholder="Repository owner" />
              <Input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="Repository name" />
              <Input value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} placeholder="Language, e.g. pt-BR" />
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short title" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue and expected behavior" className="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              <div
                className={`rounded-md border-2 border-dashed p-4 transition-colors ${isDropzoneActive ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
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
                <div className="text-sm font-medium text-slate-700">Drag and drop attachments here</div>
                <div className="mt-1 text-xs text-slate-500">or select files manually (max 10 MB each)</div>
                <Input
                  className="mt-3"
                  type="file"
                  multiple
                  onChange={(event) => appendReportFiles(Array.from(event.target.files || []))}
                />
              </div>
              {reportFiles.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                  {reportFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 py-1">
                      <span>{file.name} ({formatBytes(file.size)})</span>
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => removeReportFile(file)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full bg-sky-600 text-white hover:bg-sky-700" onClick={handleCreateReport} disabled={loading}>
                Submit report
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <Card className="bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Your reports</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[540px]">
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => setSelectedReportId(report.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left ${selectedReport?.id === report.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <div className="text-sm font-medium text-slate-900">{report.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{report.repositoryOwner}/{report.repositoryName}</div>
                        <Badge className={`mt-2 ${statusTone(report.status)}`}>{report.status}</Badge>
                      </button>
                    ))}
                    {reports.length === 0 && <div className="text-sm text-slate-500">No reports yet.</div>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm">
              <CardHeader>
                <CardTitle>{selectedReport?.title || 'Select a report'}</CardTitle>
                {selectedReport && (
                  <CardDescription>
                    {selectedReport.repositoryOwner}/{selectedReport.repositoryName}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!selectedReport ? (
                  <div className="text-sm text-slate-500">Choose a report to see discussion and progress.</div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs uppercase text-slate-500">Original description</div>
                      <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{selectedReport.description}</div>
                    </div>
                    {selectedReport.translatedDescription && (
                      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                        <div className="text-xs uppercase text-indigo-600">Translated / developer-ready</div>
                        <div className="mt-1 text-sm text-indigo-800 whitespace-pre-wrap">{selectedReport.translatedDescription}</div>
                      </div>
                    )}
                    {selectedReport.giteaIssue?.number && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        Created as Gitea issue #{selectedReport.giteaIssue.number}
                        {selectedReport.giteaIssue.html_url && (
                          <a className="ml-2 underline" href={selectedReport.giteaIssue.html_url} target="_blank" rel="noreferrer">Open</a>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="mb-2 text-xs uppercase text-slate-500">Attachments</div>
                      <div
                        className={`mb-3 rounded-md border-2 border-dashed p-3 transition-colors ${isThreadDropzoneActive ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
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
                          <div className="mt-2 space-y-1 rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">
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
                          <div key={attachment.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
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
                      <div className="mb-2 text-xs uppercase text-slate-500">Progress timeline</div>
                      <div className="space-y-2">
                        {selectedReport.progress.map((entry) => (
                          <div key={entry.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{entry.status}</span>
                              <span>{new Date(entry.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="text-sm text-slate-700 mt-1">{entry.note}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs uppercase text-slate-500">Conversation</div>
                      <div className="space-y-2 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
                        {selectedReport.messages.map((message) => (
                          <div key={message.id} className="rounded-md bg-white border border-slate-200 px-3 py-2">
                            <div className="text-xs text-slate-500">{message.authorName} · {new Date(message.createdAt).toLocaleString()}</div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap">{message.body}</div>
                          </div>
                        ))}
                        {selectedReport.messages.length === 0 && <div className="text-sm text-slate-500">No messages yet.</div>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Input value={newMessage} onChange={(event) => setNewMessage(event.target.value)} placeholder="Send a follow-up message" />
                      <Button onClick={handleSendMessage} disabled={!newMessage.trim() || loading} className="bg-sky-600 text-white hover:bg-sky-700">Send</Button>
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
