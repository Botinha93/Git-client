import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  Download,
  GitBranch,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import { Branch, GiteaService, Release, ReleaseAsset } from '@/src/lib/gitea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ReleasesViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
  defaultBranch: string;
}

function timeAgo(date?: string) {
  return date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : 'unpublished';
}

function formatBytes(size: number) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ReleasesView({ gitea, owner, repo, defaultBranch }: ReleasesViewProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newTarget, setNewTarget] = useState(defaultBranch);
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newDraft, setNewDraft] = useState(false);
  const [newPrerelease, setNewPrerelease] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingAssetName, setEditingAssetName] = useState('');

  useEffect(() => {
    loadReleases();
    loadBranches();
  }, [owner, repo]);

  useEffect(() => {
    setNewTarget(defaultBranch);
  }, [defaultBranch]);

  const loadReleases = async () => {
    setLoading(true);
    try {
      const data = await gitea.getReleases(owner, repo);
      setReleases(data);
    } catch (error) {
      console.error('Failed to load releases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await gitea.getBranches(owner, repo);
      setBranches(data);
    } catch (error) {
      console.error('Failed to load release branches:', error);
    }
  };

  const filteredReleases = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return releases.filter((release) => {
      const haystack = [release.name, release.tag_name, release.body, release.author?.login].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [releases, searchQuery]);

  const handleCreateRelease = async () => {
    if (!newTag.trim()) return;
    setSubmitting(true);
    try {
      const release = await gitea.createRelease(owner, repo, {
        tag_name: newTag.trim(),
        target_commitish: newTarget || defaultBranch,
        name: newName.trim() || newTag.trim(),
        body: newBody,
        draft: newDraft,
        prerelease: newPrerelease,
      });
      setReleases([release, ...releases]);
      setSelectedRelease(release);
      setIsCreating(false);
      setNewTag('');
      setNewName('');
      setNewBody('');
      setNewDraft(false);
      setNewPrerelease(false);
    } catch (error) {
      console.error('Failed to create release:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRelease = async () => {
    if (!selectedRelease) return;
    setSubmitting(true);
    try {
      await gitea.deleteRelease(owner, repo, selectedRelease.id);
      setReleases(releases.filter((release) => release.id !== selectedRelease.id));
      setSelectedRelease(null);
    } catch (error) {
      console.error('Failed to delete release:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const updateReleaseInState = (release: Release) => {
    setSelectedRelease(release);
    setReleases((current) => current.map((item) => item.id === release.id ? release : item));
  };

  const updateSelectedReleaseAssets = (assets: ReleaseAsset[]) => {
    if (!selectedRelease) return;
    updateReleaseInState({ ...selectedRelease, assets });
  };

  const handleUploadAsset = async (file?: File) => {
    if (!selectedRelease || !file) return;
    setUploadingAsset(true);
    try {
      const asset = await gitea.createReleaseAsset(owner, repo, selectedRelease.id, file);
      updateSelectedReleaseAssets([...(selectedRelease.assets || []), asset]);
    } catch (error) {
      console.error('Failed to upload release asset:', error);
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleRenameAsset = async (asset: ReleaseAsset) => {
    if (!selectedRelease || !editingAssetName.trim()) return;
    setSubmitting(true);
    try {
      const updated = await gitea.updateReleaseAsset(owner, repo, selectedRelease.id, asset.id, {
        name: editingAssetName.trim(),
      });
      updateSelectedReleaseAssets((selectedRelease.assets || []).map((item) => item.id === updated.id ? updated : item));
      setEditingAssetId(null);
      setEditingAssetName('');
    } catch (error) {
      console.error('Failed to rename release asset:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    if (!selectedRelease) return;
    setSubmitting(true);
    try {
      await gitea.deleteReleaseAsset(owner, repo, selectedRelease.id, assetId);
      updateSelectedReleaseAssets((selectedRelease.assets || []).filter((asset) => asset.id !== assetId));
    } catch (error) {
      console.error('Failed to delete release asset:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const branchPicker = (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" className="w-full justify-between h-10 bg-white border-slate-200 text-xs font-medium">
          <span className="flex items-center gap-2 truncate">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{newTarget || 'Select target'}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      } />
      <DropdownMenuContent align="start" className="w-64 bg-white max-h-80 overflow-y-auto">
        {branches.map((branch) => (
          <DropdownMenuItem key={branch.name} onClick={() => setNewTarget(branch.name)} className="text-xs">
            {branch.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {!selectedRelease && !isCreating ? (
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search releases..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 pl-10 bg-white border-slate-200 focus-visible:ring-sky-400"
              />
            </div>
            <Button onClick={() => setIsCreating(true)} className="bg-sky-600 hover:bg-sky-700 text-white h-10">
              <Plus className="w-4 h-4 mr-2" /> New Release
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-8 max-w-5xl mx-auto space-y-4">
              {filteredReleases.map((release) => (
                <button
                  type="button"
                  key={release.id}
                  onClick={() => setSelectedRelease(release)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl shadow-sm hover:border-sky-200 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-5 flex gap-5">
                    <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 truncate">{release.name || release.tag_name}</h3>
                        {release.draft && <Badge className="bg-slate-600 text-white text-[10px]">Draft</Badge>}
                        {release.prerelease && <Badge className="bg-amber-500 text-white text-[10px]">Prerelease</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{release.tag_name}</span>
                        <span>published {timeAgo(release.published_at || release.created_at)} by {release.author?.login}</span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2">{release.body || 'No release notes provided.'}</p>
                    </div>
                    <div className="text-right text-xs text-slate-400 shrink-0">
                      <div>{release.assets?.length || 0} assets</div>
                      <div>{release.target_commitish}</div>
                    </div>
                  </div>
                </button>
              ))}
              {filteredReleases.length === 0 && (
                <div className="p-12 text-center space-y-3">
                  <Package className="w-12 h-12 text-slate-200 mx-auto" />
                  <div className="text-slate-500 font-medium">No releases found</div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : isCreating ? (
        <div className="flex flex-col h-full bg-slate-50/30">
          <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-white">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-bold text-slate-900">Create Release</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tag</label>
                  <Input
                    placeholder="v1.0.0"
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    className="h-10 bg-white border-slate-200 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target</label>
                  {branchPicker}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title</label>
                <Input
                  placeholder="Release title"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="h-11 bg-white border-slate-200 text-base font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Release Notes</label>
                <textarea
                  placeholder="Describe what changed"
                  value={newBody}
                  onChange={(event) => setNewBody(event.target.value)}
                  className="w-full h-72 p-4 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-sm font-medium resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewDraft(!newDraft)}
                  className={cn("border-slate-200", newDraft && "bg-slate-900 text-white hover:bg-slate-800")}
                >
                  Draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewPrerelease(!newPrerelease)}
                  className={cn("border-slate-200", newPrerelease && "bg-amber-500 text-white hover:bg-amber-600")}
                >
                  Prerelease
                </Button>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button onClick={handleCreateRelease} disabled={!newTag.trim() || submitting} className="bg-green-600 hover:bg-green-700 text-white px-6">
                  <Package className="w-3.5 h-3.5 mr-2" /> {submitting ? 'Creating...' : 'Create Release'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      ) : selectedRelease && (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => setSelectedRelease(null)} className="h-8 w-8 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">{selectedRelease.name || selectedRelease.tag_name}</h2>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{selectedRelease.tag_name}</span>
                  <span>published {timeAgo(selectedRelease.published_at || selectedRelease.created_at)}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDeleteRelease} disabled={submitting} className="h-8 border-red-100 text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </Button>
          </div>

          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-8 max-w-6xl mx-auto flex gap-8">
              <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-0">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-900">Release notes</span>
                </div>
                <div className="p-6 prose prose-slate prose-sm max-w-none">
                  <ReactMarkdown>{selectedRelease.body || '_No release notes provided._'}</ReactMarkdown>
                </div>
              </div>

              <div className="w-72 space-y-6 shrink-0">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Downloads</div>
                    <label className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-sky-600">
                      <Upload className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingAsset}
                        onChange={(event) => {
                          handleUploadAsset(event.target.files?.[0]);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <a href={selectedRelease.zipball_url} className="flex items-center justify-between text-xs text-slate-700 hover:text-sky-600">
                    <span className="flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Source code (ZIP)</span>
                  </a>
                  <a href={selectedRelease.tarball_url} className="flex items-center justify-between text-xs text-slate-700 hover:text-sky-600">
                    <span className="flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Source code (TAR.GZ)</span>
                  </a>
                  {(selectedRelease.assets || []).map((asset) => (
                    <div key={asset.id} className="rounded-lg border border-slate-100 p-2">
                      {editingAssetId === asset.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingAssetName}
                            onChange={(event) => setEditingAssetName(event.target.value)}
                            className="h-8 text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingAssetId(null)} className="h-7 px-2 text-xs">Cancel</Button>
                            <Button size="sm" disabled={submitting || !editingAssetName.trim()} onClick={() => handleRenameAsset(asset)} className="h-7 bg-sky-600 px-2 text-xs text-white hover:bg-sky-700">Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <a href={asset.browser_download_url} className="flex items-center justify-between gap-3 text-xs text-slate-700 hover:text-sky-600">
                            <span className="flex min-w-0 items-center gap-2"><Package className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{asset.name}</span></span>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(asset.size)}</span>
                          </a>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400">{asset.download_count || 0} downloads</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingAssetId(asset.id);
                                  setEditingAssetName(asset.name);
                                }}
                                className="h-6 w-6 text-slate-400 hover:text-sky-600"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" disabled={submitting} onClick={() => handleDeleteAsset(asset.id)} className="h-6 w-6 text-slate-400 hover:text-red-600">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {uploadingAsset && <div className="text-xs text-sky-600">Uploading asset...</div>}
                  {(selectedRelease.assets || []).length === 0 && <div className="text-xs text-slate-400 italic">No binary assets</div>}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Details</div>
                  <div className="text-xs text-slate-600 space-y-2">
                    <div className="flex justify-between gap-3"><span>Target</span><span className="font-mono truncate">{selectedRelease.target_commitish}</span></div>
                    <div className="flex justify-between gap-3"><span>Author</span><span className="truncate">{selectedRelease.author?.login}</span></div>
                    <div className="flex gap-2 pt-1">
                      {selectedRelease.draft && <Badge className="bg-slate-600 text-white text-[10px]">Draft</Badge>}
                      {selectedRelease.prerelease && <Badge className="bg-amber-500 text-white text-[10px]">Prerelease</Badge>}
                      {!selectedRelease.draft && !selectedRelease.prerelease && <Badge className="bg-green-600 text-white text-[10px]">Stable</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
