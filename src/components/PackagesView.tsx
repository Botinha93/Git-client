import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Box,
  ChevronDown,
  Download,
  Link as LinkIcon,
  Package as PackageIcon,
  Search,
  Trash2,
  Unlink,
} from 'lucide-react';
import { GiteaService, GiteaUser, PackageFile, PackageVersion } from '@/src/lib/gitea';
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

interface PackagesViewProps {
  gitea: GiteaService;
  user: GiteaUser;
}

const PACKAGE_TYPES = ['all', 'alpine', 'cargo', 'chef', 'composer', 'conan', 'container', 'cran', 'debian', 'generic', 'go', 'helm', 'maven', 'npm', 'nuget', 'pub', 'pypi', 'rpm', 'rubygems', 'swift', 'vagrant'];

function formatBytes(size?: number) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function timeAgo(date?: string) {
  return date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : 'unknown';
}

export function PackagesView({ gitea, user }: PackagesViewProps) {
  const [owner, setOwner] = useState(user.login || user.username || '');
  const [ownerInput, setOwnerInput] = useState(user.login || user.username || '');
  const [packages, setPackages] = useState<PackageVersion[]>([]);
  const [versions, setVersions] = useState<PackageVersion[]>([]);
  const [files, setFiles] = useState<PackageFile[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageVersion | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PackageVersion | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [linkRepoName, setLinkRepoName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPackages();
  }, [owner, typeFilter]);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const data = await gitea.getPackages(owner, {
        type: typeFilter === 'all' ? undefined : typeFilter,
        q: searchQuery.trim() || undefined,
        limit: 50,
      });
      setPackages(data);
      if (selectedPackage && !data.some((item) => item.id === selectedPackage.id)) {
        setSelectedPackage(null);
        setSelectedVersion(null);
        setVersions([]);
        setFiles([]);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPackageDetails = async (pkg: PackageVersion) => {
    setSelectedPackage(pkg);
    setSelectedVersion(pkg);
    setLoadingDetail(true);
    try {
      const [versionData, fileData] = await Promise.all([
        gitea.getPackageVersions(owner, pkg.type, pkg.name, { limit: 50 }),
        gitea.getPackageFiles(owner, pkg.type, pkg.name, pkg.version),
      ]);
      setVersions(versionData);
      setFiles(fileData);
    } catch (error) {
      console.error('Failed to load package details:', error);
      setVersions([]);
      setFiles([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadVersionFiles = async (version: PackageVersion) => {
    if (!selectedPackage) return;
    setSelectedVersion(version);
    setLoadingDetail(true);
    try {
      const fileData = await gitea.getPackageFiles(owner, selectedPackage.type, selectedPackage.name, version.version);
      setFiles(fileData);
    } catch (error) {
      console.error('Failed to load package version files:', error);
      setFiles([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSearch = () => {
    setOwner(ownerInput.trim() || user.login || user.username || owner);
    loadPackages();
  };

  const handleLinkRepository = async () => {
    if (!selectedPackage || !linkRepoName.trim()) return;
    setSaving(true);
    try {
      await gitea.linkPackageRepository(owner, selectedPackage.type, selectedPackage.name, linkRepoName.trim());
      const updated = await gitea.getPackage(owner, selectedPackage.type, selectedPackage.name, selectedPackage.version);
      setSelectedPackage(updated);
      setSelectedVersion((current) => current?.version === updated.version ? updated : current);
      setLinkRepoName('');
    } catch (error) {
      console.error('Failed to link package repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkRepository = async () => {
    if (!selectedPackage) return;
    setSaving(true);
    try {
      await gitea.unlinkPackageRepository(owner, selectedPackage.type, selectedPackage.name);
      setSelectedPackage({ ...selectedPackage, repository: undefined });
    } catch (error) {
      console.error('Failed to unlink package repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVersion = async (version: PackageVersion) => {
    if (!selectedPackage) return;
    setSaving(true);
    try {
      await gitea.deletePackageVersion(owner, selectedPackage.type, selectedPackage.name, version.version);
      const nextVersions = versions.filter((item) => item.version !== version.version);
      setVersions(nextVersions);
      if (selectedVersion?.version === version.version) {
        setSelectedVersion(nextVersions[0] || null);
        if (nextVersions[0]) {
          const fileData = await gitea.getPackageFiles(owner, selectedPackage.type, selectedPackage.name, nextVersions[0].version);
          setFiles(fileData);
        } else {
          setFiles([]);
          setSelectedPackage(null);
          await loadPackages();
        }
      }
    } catch (error) {
      console.error('Failed to delete package version:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePackage = async () => {
    if (!selectedPackage) return;
    setSaving(true);
    try {
      await gitea.deletePackage(owner, selectedPackage.type, selectedPackage.name);
      setSelectedPackage(null);
      setSelectedVersion(null);
      setVersions([]);
      setFiles([]);
      await loadPackages();
    } catch (error) {
      console.error('Failed to delete package:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredPackages = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return packages.filter((pkg) => {
      const haystack = [pkg.name, pkg.version, pkg.type, pkg.repository?.full_name, pkg.creator?.login].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [packages, searchQuery]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {!selectedPackage ? (
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <Box className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-slate-900">Packages</h1>
                <div className="text-xs text-slate-500 truncate">Registry packages owned by {owner}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input value={ownerInput} onChange={(event) => setOwnerInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleSearch()} className="h-10 w-44 border-slate-200 bg-white" placeholder="owner" />
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && loadPackages()} className="h-10 pl-10 border-slate-200 bg-white" placeholder="Search packages" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-10 w-40 justify-between border-slate-200 bg-white text-xs capitalize">
                    {typeFilter}
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  </Button>
                } />
                <DropdownMenuContent align="end" className="max-h-80 w-48 overflow-y-auto bg-white">
                  {PACKAGE_TYPES.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => setTypeFilter(type)} className="text-xs capitalize">
                      {type}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleSearch} className="h-10 bg-sky-600 text-white hover:bg-sky-700">Refresh</Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-slate-100">
              {filteredPackages.map((pkg) => (
                <button key={`${pkg.type}/${pkg.name}/${pkg.version}/${pkg.id}`} type="button" onClick={() => loadPackageDetails(pkg)} className="w-full text-left p-5 hover:bg-slate-50 transition-colors flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <PackageIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{pkg.name}</span>
                      <Badge variant="outline" className="border-slate-200 text-[10px] uppercase text-slate-500">{pkg.type}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {pkg.version} · published {timeAgo(pkg.created_at)} {pkg.creator?.login ? `by ${pkg.creator.login}` : ''}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400 shrink-0">
                    <div>{pkg.repository?.full_name || 'No repository'}</div>
                  </div>
                </button>
              ))}
              {filteredPackages.length === 0 && (
                <div className="p-12 text-center space-y-3">
                  <PackageIcon className="w-12 h-12 text-slate-200 mx-auto" />
                  <div className="text-slate-500 font-medium">No packages found</div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => setSelectedPackage(null)} className="h-8 w-8 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">{selectedPackage.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <Badge variant="outline" className="border-slate-200 text-[10px] uppercase text-slate-500">{selectedPackage.type}</Badge>
                  <span>{selectedVersion?.version || selectedPackage.version}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDeletePackage} disabled={saving} className="h-8 border-red-100 text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Package
            </Button>
          </div>

          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-8 max-w-6xl mx-auto grid grid-cols-[1fr_320px] gap-8">
              <div className="space-y-6 min-w-0">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <Download className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-bold text-slate-900">Files</span>
                  </div>
                  {loadingDetail ? (
                    <div className="p-5 space-y-3">
                      {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full bg-slate-200" />)}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {files.map((file) => (
                        <div key={file.id} className="px-5 py-4 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{file.name}</div>
                            <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">{file.sha256 || file.sha1 || file.md5 || 'No digest'}</div>
                          </div>
                          <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">{formatBytes(file.size ?? file.Size)}</Badge>
                        </div>
                      ))}
                      {files.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No files for this version</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">Versions</div>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {versions.map((version) => (
                      <button key={version.id} type="button" onClick={() => loadVersionFiles(version)} className={cn("w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between gap-3", selectedVersion?.version === version.version && "bg-sky-50")}>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{version.version}</div>
                          <div className="text-[10px] text-slate-400">{timeAgo(version.created_at)}</div>
                        </div>
                        <Button variant="ghost" size="icon" disabled={saving} onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteVersion(version);
                        }} className="h-7 w-7 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </button>
                    ))}
                    {versions.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No versions</div>}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repository link</div>
                  {selectedPackage.repository ? (
                    <div className="rounded-lg border border-slate-100 p-3">
                      <div className="text-sm font-bold text-slate-900 truncate">{selectedPackage.repository.full_name}</div>
                      <Button variant="ghost" size="sm" onClick={handleUnlinkRepository} disabled={saving} className="mt-2 h-8 px-2 text-xs text-red-600 hover:bg-red-50">
                        <Unlink className="w-3.5 h-3.5 mr-2" /> Unlink
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input value={linkRepoName} onChange={(event) => setLinkRepoName(event.target.value)} placeholder="repository-name" className="h-9 text-xs" />
                      <Button onClick={handleLinkRepository} disabled={!linkRepoName.trim() || saving} className="w-full h-9 bg-sky-600 text-white hover:bg-sky-700">
                        <LinkIcon className="w-3.5 h-3.5 mr-2" /> Link Repository
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
