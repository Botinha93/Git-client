import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SupportInboxViewProps {
  onUnauthorized?: () => void;
}

interface InboxReport {
  id: string;
  userName: string;
  userEmail: string;
  title: string;
  description: string;
  repositoryOwner: string;
  repositoryName: string;
  translatedTitle?: string;
  translatedDescription?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorName: string;
    body: string;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedByName: string;
    uploadedAt: string;
  }>;
  progress: Array<{
    id: string;
    status: string;
    note: string;
    createdAt: string;
  }>;
  giteaIssue?: {
    number: number;
    html_url?: string;
  };
}

interface AttachmentPreview {
  kind: 'image' | 'text' | 'other';
  loading: boolean;
  error?: string;
  url?: string;
  text?: string;
}

interface SupportUserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  reportCount: number;
  lastReportAt?: string;
}

type SupportWorkspaceView = 'reports' | 'users';

async function developerRequest<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `Request failed (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_OPTIONS = ['submitted', 'triaged', 'translated', 'in-review', 'approved', 'converted', 'rejected'];

export function SupportInboxView({ onUnauthorized }: SupportInboxViewProps) {
  const [viewMode, setViewMode] = useState<SupportWorkspaceView>('reports');
  const [reports, setReports] = useState<InboxReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [translatedDescription, setTranslatedDescription] = useState('');
  const [developerMessage, setDeveloperMessage] = useState('');
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, AttachmentPreview>>({});
  const [users, setUsers] = useState<SupportUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  const selected = useMemo(() => reports.find((entry) => entry.id === selectedId) || reports[0] || null, [reports, selectedId]);
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) {
      return users;
    }

    return users.filter((user) => [user.name, user.email].join(' ').toLowerCase().includes(query));
  }, [users, userSearch]);
  const selectedUser = useMemo(() => users.find((entry) => entry.id === selectedUserId) || filteredUsers[0] || null, [users, filteredUsers, selectedUserId]);

  useEffect(() => {
    void loadReports();
  }, [statusFilter]);

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (selected) {
      setTranslatedTitle(selected.translatedTitle || '');
      setTranslatedDescription(selected.translatedDescription || '');
    }
  }, [selected?.id]);

  useEffect(() => {
    if (selectedUser) {
      setEditingUserName(selectedUser.name);
      setEditingUserEmail(selectedUser.email);
    }
  }, [selectedUser?.id]);

  async function loadReports() {
    try {
      setLoading(true);
      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const data = await developerRequest<InboxReport[]>(`/api/support/reports${query}`, { method: 'GET' });
      setReports(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
      setError(null);
    } catch (loadError: any) {
      if (loadError.status === 401) {
        onUnauthorized?.();
      }
      setError(loadError.message || 'Failed to load support inbox');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await developerRequest<SupportUserSummary[]>('/api/support/users', { method: 'GET' });
      setUsers(data);
      if (!selectedUserId && data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (loadError: any) {
      if (loadError.status === 401) {
        onUnauthorized?.();
      }
      setError(loadError.message || 'Failed to load support users');
    }
  }

  async function updateReportStatus(status: string, note?: string) {
    if (!selected) {
      return;
    }
    try {
      setLoading(true);
      await developerRequest(`/api/support/reports/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          translatedTitle,
          translatedDescription,
          note,
        }),
      });
      await loadReports();
    } catch (updateError: any) {
      if (updateError.status === 401) {
        onUnauthorized?.();
      }
      setError(updateError.message || 'Failed to update report');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!selected || !developerMessage.trim()) {
      return;
    }
    try {
      setLoading(true);
      await developerRequest(`/api/support/reports/${selected.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: developerMessage }),
      });
      setDeveloperMessage('');
      await loadReports();
    } catch (messageError: any) {
      if (messageError.status === 401) {
        onUnauthorized?.();
      }
      setError(messageError.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  async function approveAndCreateIssue() {
    if (!selected) {
      return;
    }
    try {
      setLoading(true);
      await developerRequest(`/api/support/reports/${selected.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          repositoryOwner: selected.repositoryOwner,
          repositoryName: selected.repositoryName,
          title: translatedTitle || selected.title,
          body: translatedDescription || selected.description,
          labels: ['user-reported'],
        }),
      });
      await loadReports();
    } catch (approveError: any) {
      if (approveError.status === 401) {
        onUnauthorized?.();
      }
      setError(approveError.message || 'Failed to approve and create issue');
    } finally {
      setLoading(false);
    }
  }

  async function createSupportUser() {
    if (!newUserName.trim() || !newUserEmail.trim() || newUserPassword.trim().length < 6) {
      return;
    }

    try {
      setSavingUser(true);
      setError(null);
      const created = await developerRequest<SupportUserSummary>('/api/support/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
        }),
      });
      setUsers((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedUserId(created.id);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (saveError: any) {
      if (saveError.status === 401) {
        onUnauthorized?.();
      }
      setError(saveError.message || 'Failed to create support user');
    } finally {
      setSavingUser(false);
    }
  }

  async function saveSupportUser() {
    if (!selectedUser || !editingUserName.trim() || !editingUserEmail.trim()) {
      return;
    }

    try {
      setSavingUser(true);
      setError(null);
      const updated = await developerRequest<SupportUserSummary>(`/api/support/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editingUserName,
          email: editingUserEmail,
        }),
      });
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (saveError: any) {
      if (saveError.status === 401) {
        onUnauthorized?.();
      }
      setError(saveError.message || 'Failed to update support user');
    } finally {
      setSavingUser(false);
    }
  }

  async function resetSupportUserPassword() {
    if (!selectedUser || resetPassword.trim().length < 6) {
      return;
    }

    try {
      setSavingUser(true);
      setError(null);
      await developerRequest(`/api/support/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword }),
      });
      setResetPassword('');
    } catch (saveError: any) {
      if (saveError.status === 401) {
        onUnauthorized?.();
      }
      setError(saveError.message || 'Failed to reset password');
    } finally {
      setSavingUser(false);
    }
  }

  async function downloadAttachment(attachmentId: string, fileName: string) {
    if (!selected) {
      return;
    }
    try {
      const response = await fetch(`/api/support/reports/${selected.id}/attachments/${attachmentId}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        if (response.status === 401) {
          onUnauthorized?.();
        }
        throw new Error('Unable to download attachment');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      setError(downloadError.message || 'Failed to download attachment');
    }
  }

  async function previewAttachment(attachmentId: string, mimeType: string) {
    if (!selected) {
      return;
    }

    const previewKey = `${selected.id}:${attachmentId}`;
    setAttachmentPreviews((current) => ({
      ...current,
      [previewKey]: { kind: 'other', loading: true },
    }));

    try {
      const response = await fetch(`/api/support/reports/${selected.id}/attachments/${attachmentId}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        if (response.status === 401) {
          onUnauthorized?.();
        }
        throw new Error('Unable to preview attachment');
      }

      const blob = await response.blob();
      const effectiveType = mimeType || blob.type || 'application/octet-stream';

      if (effectiveType.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(blob);
        setAttachmentPreviews((current) => ({
          ...current,
          [previewKey]: { kind: 'image', loading: false, url: objectUrl },
        }));
        return;
      }

      if (effectiveType.startsWith('text/') || effectiveType.includes('json') || effectiveType.includes('xml') || effectiveType.includes('yaml') || effectiveType.includes('javascript')) {
        const text = await blob.text();
        setAttachmentPreviews((current) => ({
          ...current,
          [previewKey]: { kind: 'text', loading: false, text: text.slice(0, 5000) },
        }));
        return;
      }

      setAttachmentPreviews((current) => ({
        ...current,
        [previewKey]: { kind: 'other', loading: false },
      }));
    } catch (previewError: any) {
      setAttachmentPreviews((current) => ({
        ...current,
        [previewKey]: { kind: 'other', loading: false, error: previewError.message || 'Preview failed' },
      }));
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden bg-slate-100 p-6">
      <div className="h-full grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="bg-white shadow-sm h-full">
          <CardHeader>
            <CardTitle>Support Workspace</CardTitle>
            <CardDescription>Review reports or manage support portal users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant={viewMode === 'reports' ? 'default' : 'outline'} onClick={() => setViewMode('reports')} className={viewMode === 'reports' ? 'bg-sky-600 text-white hover:bg-sky-700' : ''}>
                Inbox
              </Button>
              <Button variant={viewMode === 'users' ? 'default' : 'outline'} onClick={() => setViewMode('users')} className={viewMode === 'users' ? 'bg-sky-600 text-white hover:bg-sky-700' : ''}>
                Users
              </Button>
            </div>
            {viewMode === 'reports' ? (
              <>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <Button variant="outline" onClick={() => void loadReports()} disabled={loading}>Refresh</Button>
            </div>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-2 pr-2">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedId(report.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left ${selected?.id === report.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <div className="text-sm font-medium text-slate-900">{report.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{report.userName} · {report.repositoryOwner}/{report.repositoryName}</div>
                    <Badge className="mt-2 bg-slate-100 text-slate-700">{report.status}</Badge>
                  </button>
                ))}
                {reports.length === 0 && <div className="text-sm text-slate-500">No reports found.</div>}
              </div>
            </ScrollArea>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users by name or email" />
                  <Button variant="outline" onClick={() => void loadUsers()} disabled={savingUser}>Refresh</Button>
                </div>
                {error && <div className="text-sm text-rose-600">{error}</div>}
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-2 pr-2">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left ${selectedUser?.id === user.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <div className="text-sm font-medium text-slate-900">{user.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{user.email}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                          <span>{user.reportCount} reports</span>
                          <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && <div className="text-sm text-slate-500">No support users found.</div>}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm h-full">
          <CardHeader>
            <CardTitle>{viewMode === 'reports' ? (selected?.title || 'Select a report') : (selectedUser?.name || 'Manage support users')}</CardTitle>
            {viewMode === 'reports'
              ? selected && <CardDescription>{selected.userName} ({selected.userEmail})</CardDescription>
              : <CardDescription>Create portal accounts, edit user information, and reset passwords.</CardDescription>}
          </CardHeader>
          <CardContent>
            {viewMode === 'reports' ? (!selected ? (
              <div className="text-sm text-slate-500">Select a report from the inbox.</div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase text-slate-500">User description</div>
                  <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{selected.description}</div>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase text-slate-500">Attachments</div>
                  <div className="mt-2 space-y-2">
                    {selected.attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-slate-700">
                            <div>{attachment.fileName}</div>
                            <div className="text-xs text-slate-500">{formatBytes(attachment.size)} · {attachment.uploadedByName}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => void previewAttachment(attachment.id, attachment.mimeType)}>Preview</Button>
                            <Button variant="outline" size="sm" onClick={() => void downloadAttachment(attachment.id, attachment.fileName)}>Download</Button>
                          </div>
                        </div>
                        {(() => {
                          const preview = attachmentPreviews[`${selected.id}:${attachment.id}`];
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
                    {selected.attachments.length === 0 && <div className="text-sm text-slate-500">No attachments.</div>}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-500">Translated title</label>
                    <Input value={translatedTitle} onChange={(event) => setTranslatedTitle(event.target.value)} placeholder="Developer-ready title" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-500">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((status) => (
                        <Button key={status} variant="outline" size="sm" onClick={() => void updateReportStatus(status)} disabled={loading}>{status}</Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-500">Translated / normalized description</label>
                  <textarea
                    value={translatedDescription}
                    onChange={(event) => setTranslatedDescription(event.target.value)}
                    className="min-h-[130px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Translate and restructure details before approving"
                  />
                  <Button variant="outline" onClick={() => void updateReportStatus(selected.status, 'Updated translation details.')} disabled={loading}>Save translation</Button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-500">Developer reply (visible to user before issue creation)</label>
                  <div className="flex gap-2">
                    <Input value={developerMessage} onChange={(event) => setDeveloperMessage(event.target.value)} placeholder="Ask for logs, environment details, or repro steps" />
                    <Button onClick={() => void sendMessage()} disabled={loading || !developerMessage.trim()} className="bg-sky-600 text-white hover:bg-sky-700">Send</Button>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase text-slate-500">Conversation</div>
                  <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                    {selected.messages.map((message) => (
                      <div key={message.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs text-slate-500">{message.authorName} · {new Date(message.createdAt).toLocaleString()}</div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{message.body}</div>
                      </div>
                    ))}
                    {selected.messages.length === 0 && <div className="text-sm text-slate-500">No messages yet.</div>}
                  </div>
                </div>

                {selected.giteaIssue?.number ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    Converted to Gitea issue #{selected.giteaIssue.number}
                    {selected.giteaIssue.html_url && (
                      <a className="ml-2 underline" href={selected.giteaIssue.html_url} target="_blank" rel="noreferrer">Open</a>
                    )}
                  </div>
                ) : (
                  <Button onClick={() => void approveAndCreateIssue()} disabled={loading} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    Approve and create Gitea issue
                  </Button>
                )}
              </div>
            )) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-5">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase text-slate-500">Register support user</div>
                    <div className="mt-3 space-y-3">
                      <Input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="Full name" />
                      <Input value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} placeholder="Email address" />
                      <Input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} placeholder="Temporary password (min 6 chars)" />
                      <Button onClick={() => void createSupportUser()} disabled={savingUser || !newUserName.trim() || !newUserEmail.trim() || newUserPassword.trim().length < 6} className="bg-sky-600 text-white hover:bg-sky-700">
                        Create user
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  {!selectedUser ? (
                    <div className="text-sm text-slate-500">Select a user to edit their account.</div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase text-slate-500">User details</div>
                        <div className="mt-2 text-sm text-slate-500">
                          Created {new Date(selectedUser.createdAt).toLocaleString()}
                          {selectedUser.lastReportAt ? ` · Last report ${new Date(selectedUser.lastReportAt).toLocaleString()}` : ' · No reports yet'}
                        </div>
                        <div className="mt-3 space-y-3">
                          <Input value={editingUserName} onChange={(event) => setEditingUserName(event.target.value)} placeholder="Full name" />
                          <Input value={editingUserEmail} onChange={(event) => setEditingUserEmail(event.target.value)} placeholder="Email address" />
                          <Button variant="outline" onClick={() => void saveSupportUser()} disabled={savingUser || !editingUserName.trim() || !editingUserEmail.trim()}>
                            Save user details
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase text-slate-500">Reset password</div>
                        <div className="mt-3 space-y-3">
                          <Input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="New password (min 6 chars)" />
                          <Button onClick={() => void resetSupportUserPassword()} disabled={savingUser || resetPassword.trim().length < 6} className="bg-amber-600 text-white hover:bg-amber-700">
                            Reset password
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
