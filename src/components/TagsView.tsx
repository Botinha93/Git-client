import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronDown, Download, GitBranch, GitCommit, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { Branch, GiteaService, RepositoryTag } from '@/src/lib/gitea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface TagsViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
  branches: Branch[];
  defaultBranch: string;
}

export function TagsView({ gitea, owner, repo, branches, defaultBranch }: TagsViewProps) {
  const [tags, setTags] = useState<RepositoryTag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [target, setTarget] = useState(defaultBranch);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadTags();
  }, [owner, repo]);

  useEffect(() => {
    setTarget(defaultBranch);
  }, [defaultBranch]);

  const loadTags = async () => {
    setLoading(true);
    try {
      const data = await gitea.getTags(owner, repo);
      setTags(data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return tags.filter((tag) => {
      const haystack = [tag.name, tag.message, tag.commit?.sha].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [tags, searchQuery]);

  const handleCreateTag = async () => {
    if (!tagName.trim()) return;
    setSaving(true);
    try {
      const tag = await gitea.createTag(owner, repo, {
        tag_name: tagName.trim(),
        target,
        message: message.trim() || undefined,
      });
      setTags([tag, ...tags.filter((item) => item.name !== tag.name)]);
      setTagName('');
      setMessage('');
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (name: string) => {
    setSaving(true);
    try {
      await gitea.deleteTag(owner, repo, name);
      setTags(tags.filter((tag) => tag.name !== name));
    } catch (error) {
      console.error('Failed to delete tag:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 pl-10 bg-white border-slate-200 focus-visible:ring-sky-400"
          />
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={
            <Button className="bg-sky-600 hover:bg-sky-700 text-white h-10">
              <Plus className="w-4 h-4 mr-2" /> New Tag
            </Button>
          } />
          <DialogContent className="sm:max-w-xl bg-white">
            <DialogHeader>
              <DialogTitle>Create Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</label>
                <Input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="v1.0.0" className="h-10 border-slate-200 font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target</label>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" className="w-full justify-between h-10 bg-white border-slate-200 text-xs font-medium">
                      <span className="flex items-center gap-2 truncate">
                        <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{target || 'Select branch'}</span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                    </Button>
                  } />
                  <DropdownMenuContent align="start" className="w-64 bg-white max-h-80 overflow-y-auto">
                    {branches.map((branch) => (
                      <DropdownMenuItem key={branch.name} onClick={() => setTarget(branch.name)} className="text-xs">
                        {branch.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message</label>
                <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Optional annotated tag message" className="h-10 border-slate-200" />
              </div>
            </div>
            <DialogFooter className="bg-white border-slate-100">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTag} disabled={!tagName.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">
                <Tag className="w-3.5 h-3.5 mr-2" /> {saving ? 'Creating...' : 'Create Tag'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 max-w-5xl mx-auto space-y-3">
          {filteredTags.map((tag) => (
            <div key={tag.name} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 truncate">{tag.name}</span>
                    <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">Tag</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <GitCommit className="w-3.5 h-3.5" />
                    <span className="font-mono">{tag.commit?.sha?.substring(0, 12)}</span>
                  </div>
                  {tag.message && <div className="text-xs text-slate-400 truncate">{tag.message}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={tag.zipball_url} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[0.8rem] font-medium text-slate-600 hover:bg-slate-50">
                  <Download className="w-3.5 h-3.5 mr-2" /> ZIP
                </a>
                <a href={tag.tarball_url} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[0.8rem] font-medium text-slate-600 hover:bg-slate-50">
                  <Archive className="w-3.5 h-3.5 mr-2" /> TAR
                </a>
                <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteTag(tag.name)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filteredTags.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <Tag className="w-12 h-12 text-slate-200 mx-auto" />
              <div className="text-slate-500 font-medium">No tags found</div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
