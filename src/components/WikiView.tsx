import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, BookOpen, Edit3, FileText, Plus, Save, Search, Trash2 } from 'lucide-react';
import { GiteaService, WikiPage, WikiPageMeta } from '@/src/lib/gitea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface WikiViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
}

function decodeBase64(content: string) {
  const binary = atob(content.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function pageContent(page: WikiPage | null) {
  if (!page) return '';
  if (page.content_base64) return decodeBase64(page.content_base64);
  return page.content || '';
}

export function WikiView({ gitea, owner, repo }: WikiViewProps) {
  const [pages, setPages] = useState<WikiPageMeta[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'list' | 'view' | 'edit' | 'create'>('list');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPages();
  }, [owner, repo]);

  const loadPages = async () => {
    setLoading(true);
    try {
      const data = await gitea.getWikiPages(owner, repo);
      setPages(data);
    } catch (error) {
      console.error('Failed to load wiki pages:', error);
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPages = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return pages.filter((page) => page.title.toLowerCase().includes(query));
  }, [pages, searchQuery]);

  const loadPage = async (pageName: string) => {
    setLoading(true);
    try {
      const page = await gitea.getWikiPage(owner, repo, pageName);
      setSelectedPage(page);
      setMode('view');
    } catch (error) {
      console.error('Failed to load wiki page:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setSelectedPage(null);
    setTitle('');
    setContent('');
    setMessage('');
    setMode('create');
  };

  const startEdit = () => {
    if (!selectedPage) return;
    setTitle(selectedPage.title);
    setContent(pageContent(selectedPage));
    setMessage(`Update ${selectedPage.title}`);
    setMode('edit');
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        const page = await gitea.createWikiPage(owner, repo, {
          title: title.trim(),
          content,
          message: message.trim() || `Create ${title.trim()}`,
        });
        setSelectedPage(page);
      } else if (selectedPage) {
        const page = await gitea.updateWikiPage(owner, repo, selectedPage.title, {
          title: title.trim(),
          content,
          message: message.trim() || `Update ${title.trim()}`,
        });
        setSelectedPage(page);
      }
      await loadPages();
      setMode('view');
    } catch (error) {
      console.error('Failed to save wiki page:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPage) return;
    setSaving(true);
    try {
      await gitea.deleteWikiPage(owner, repo, selectedPage.title);
      setSelectedPage(null);
      setMode('list');
      await loadPages();
    } catch (error) {
      console.error('Failed to delete wiki page:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading && mode === 'list') {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {mode === 'list' ? (
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search wiki pages..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 pl-10 bg-white border-slate-200 focus-visible:ring-sky-400"
              />
            </div>
            <Button onClick={startCreate} className="bg-sky-600 hover:bg-sky-700 text-white h-10">
              <Plus className="w-4 h-4 mr-2" /> New Page
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-8 max-w-4xl mx-auto space-y-3">
              {filteredPages.map((page) => (
                <button
                  key={page.title}
                  type="button"
                  onClick={() => loadPage(page.title)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-200 hover:shadow-sm transition-all flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{page.title}</div>
                    <div className="text-xs text-slate-400 truncate">{page.last_commit?.message || 'Wiki page'}</div>
                  </div>
                </button>
              ))}
              {filteredPages.length === 0 && (
                <div className="p-12 text-center space-y-3">
                  <BookOpen className="w-12 h-12 text-slate-200 mx-auto" />
                  <div className="text-slate-500 font-medium">No wiki pages found</div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : mode === 'view' && selectedPage ? (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => setMode('list')} className="h-8 w-8 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-base font-bold text-slate-900 truncate">{selectedPage.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={saving} className="h-8 border-red-100 text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </Button>
              <Button size="sm" onClick={startEdit} className="h-8 bg-slate-900 text-white hover:bg-slate-800">
                <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-8 max-w-4xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 prose prose-slate prose-sm max-w-none">
                <ReactMarkdown>{pageContent(selectedPage) || '_This page is empty._'}</ReactMarkdown>
              </div>
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex flex-col h-full bg-slate-50/30">
          <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-white">
            <Button variant="ghost" size="icon" onClick={() => selectedPage ? setMode('view') : setMode('list')} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-bold text-slate-900">{mode === 'create' ? 'Create Wiki Page' : 'Edit Wiki Page'}</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-8 max-w-5xl mx-auto space-y-5">
              <div className="grid grid-cols-[1fr_1fr] gap-4">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Page title" className="h-10 bg-white border-slate-200 font-medium" />
                <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Commit message" className="h-10 bg-white border-slate-200" />
              </div>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="h-[520px] w-full resize-none rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                spellCheck={false}
              />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={!title.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">
                  <Save className="w-3.5 h-3.5 mr-2" /> {saving ? 'Saving...' : 'Save Page'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
