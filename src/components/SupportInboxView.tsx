import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SupportInboxViewProps {
  giteaBaseUrl: string;
  giteaToken: string;
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

async function developerRequest<T>(path: string, baseUrl: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('x-gitea-token', token);
  headers.set('x-gitea-base-url', baseUrl);

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

const STATUS_OPTIONS = ['submitted', 'triaged', 'translated', 'in-review', 'approved', 'converted', 'rejected'];

export function SupportInboxView({ giteaBaseUrl, giteaToken }: SupportInboxViewProps) {
  const [reports, setReports] = useState<InboxReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [translatedDescription, setTranslatedDescription] = useState('');
  const [developerMessage, setDeveloperMessage] = useState('');
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, AttachmentPreview>>({});

  const selected = useMemo(() => reports.find((entry) => entry.id === selectedId) || reports[0] || null, [reports, selectedId]);

  useEffect(() => {
    void loadReports();
  }, [statusFilter]);

  useEffect(() => {
    if (selected) {
      setTranslatedTitle(selected.translatedTitle || '');
      setTranslatedDescription(selected.translatedDescription || '');
    }
  }, [selected?.id]);

  async function loadReports() {
    try {
      setLoading(true);
      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const data = await developerRequest<InboxReport[]>(`/api/support/reports${query}`, giteaBaseUrl, giteaToken, { method: 'GET' });
      setReports(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
      setError(null);
    } catch (loadError: any) {
      setError(loadError.message || 'Failed to load support inbox');
    } finally {
      setLoading(false);
    }
  }

  async function updateReportStatus(status: string, note?: string) {
    if (!selected) {
      return;
    }
    try {
      setLoading(true);
      await developerRequest(`/api/support/reports/${selected.id}`, giteaBaseUrl, giteaToken, {
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
      await developerRequest(`/api/support/reports/${selected.id}/messages`, giteaBaseUrl, giteaToken, {
        method: 'POST',
        body: JSON.stringify({ body: developerMessage }),
      });
      setDeveloperMessage('');
      await loadReports();
    } catch (messageError: any) {
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
      await developerRequest(`/api/support/reports/${selected.id}/approve`, giteaBaseUrl, giteaToken, {
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
      setError(approveError.message || 'Failed to approve and create issue');
    } finally {
      setLoading(false);
    }
  }

  async function downloadAttachment(attachmentId: string, fileName: string) {
    if (!selected) {
      return;
    }
    try {
      const response = await fetch(`/api/support/reports/${selected.id}/attachments/${attachmentId}`, {
        method: 'GET',
        headers: {
          'x-gitea-token': giteaToken,
          'x-gitea-base-url': giteaBaseUrl,
        },
      });

      if (!response.ok) {
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
        headers: {
          'x-gitea-token': giteaToken,
          'x-gitea-base-url': giteaBaseUrl,
        },
      });

      if (!response.ok) {
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
            <CardTitle>Support Inbox</CardTitle>
            <CardDescription>Review user reports, respond, and convert approved reports into Gitea issues.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm h-full">
          <CardHeader>
            <CardTitle>{selected?.title || 'Select a report'}</CardTitle>
            {selected && <CardDescription>{selected.userName} ({selected.userEmail})</CardDescription>}
          </CardHeader>
          <CardContent>
            {!selected ? (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
