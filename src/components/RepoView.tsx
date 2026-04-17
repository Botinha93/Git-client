import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GiteaService, Repository, FileContent, Branch, Commit, GitTreeItem, CommitStatus, CommitStatusState } from '@/src/lib/gitea';
import { 
  Activity,
  File, 
  FolderClosed,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  ChevronRight, 
  GitBranch, 
  GitFork,
  History as HistoryIcon, 
  MessageSquare, 
  GitPullRequest, 
  Star, 
  Eye, 
  Copy, 
  Check, 
  Plus, 
  Save, 
  ArrowLeft,
  Layout as LayoutIcon,
  Clock,
  Search,
  Package,
  Trash2,
  Settings,
  BookOpen,
  Tag,
  ExternalLink,
  XCircle,
  Download
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import Editor from '@monaco-editor/react';
import { GitGraph } from './GitGraph';
import { IssuesView } from './IssuesView';
import { PullRequestsView } from './PullRequestsView';
import { ReleasesView } from './ReleasesView';
import { RepositorySettingsView } from './RepositorySettingsView';
import { WikiView } from './WikiView';
import { TagsView } from './TagsView';
import { RepositoryInsightsView } from './RepositoryInsightsView';
import { RepositoryActivityView } from './RepositoryActivityView';
import { MarkdownRenderer } from './MarkdownRenderer';

interface RepoViewProps {
  gitea: GiteaService;
}

function encodeBase64(content: string) {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(content: string) {
  const binary = atob(content.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const statusLabels: Record<CommitStatusState, string> = {
  pending: 'Pending',
  success: 'Success',
  error: 'Error',
  failure: 'Failure',
  warning: 'Warning',
};

const statusClasses: Record<CommitStatusState, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  success: 'bg-green-50 text-green-700 border-green-100',
  error: 'bg-red-50 text-red-700 border-red-100',
  failure: 'bg-red-50 text-red-700 border-red-100',
  warning: 'bg-orange-50 text-orange-700 border-orange-100',
};

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'cc',
  'h', 'hpp', 'cs', 'php', 'rb', 'swift', 'kt', 'kts', 'scala', 'sql', 'sh', 'bash',
  'zsh', 'ps1', 'bat', 'vue', 'svelte', 'css', 'scss', 'sass', 'less', 'html', 'xml'
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2', 'xz']);
const SPREADSHEET_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx', 'ods']);
const TEXT_EXTENSIONS = new Set(['md', 'mdx', 'txt', 'rst', 'adoc']);
const DATA_EXTENSIONS = new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'conf']);

function getFileName(pathOrName: string) {
  return pathOrName.split('/').pop() || pathOrName;
}

function getFileExtension(pathOrName: string) {
  const fileName = getFileName(pathOrName).toLowerCase();
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1);
}

function getFileBadgeLabel(pathOrName: string, type: 'file' | 'dir') {
  if (type === 'dir') {
    return 'DIR';
  }

  const fileName = getFileName(pathOrName).toLowerCase();
  const extension = getFileExtension(pathOrName);

  if (fileName === 'dockerfile') return 'DOCKER';
  if (fileName === 'makefile') return 'MAKE';
  if (fileName.startsWith('readme')) return 'README';
  if (fileName === 'license') return 'LICENSE';
  if (!extension) return 'FILE';
  return extension.toUpperCase();
}

function getExplorerIcon(pathOrName: string, type: 'file' | 'dir', className: string) {
  if (type === 'dir') {
    return <FolderClosed className={cn(className, 'text-amber-500')} />;
  }

  const fileName = getFileName(pathOrName).toLowerCase();
  const extension = getFileExtension(pathOrName);

  if (fileName === 'dockerfile' || fileName === 'makefile') {
    return <FileCode2 className={cn(className, 'text-sky-500')} />;
  }

  if (fileName.startsWith('readme') || fileName === 'license' || TEXT_EXTENSIONS.has(extension)) {
    return <FileText className={cn(className, 'text-emerald-600')} />;
  }

  if (DATA_EXTENSIONS.has(extension)) {
    return <FileJson className={cn(className, 'text-cyan-600')} />;
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return <FileSpreadsheet className={cn(className, 'text-lime-600')} />;
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return <FileImage className={cn(className, 'text-fuchsia-500')} />;
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return <FileVideo className={cn(className, 'text-violet-500')} />;
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return <FileAudio className={cn(className, 'text-rose-500')} />;
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return <FileArchive className={cn(className, 'text-amber-600')} />;
  }

  if (CODE_EXTENSIONS.has(extension)) {
    return <FileCode2 className={cn(className, 'text-sky-500')} />;
  }

  return <File className={cn(className, 'text-slate-500')} />;
}

export function RepoView({ gitea }: RepoViewProps) {
  const { owner, repo: repoName } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [contents, setContents] = useState<FileContent[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [forks, setForks] = useState<Repository[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [commitStatuses, setCommitStatuses] = useState<CommitStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [newStatusState, setNewStatusState] = useState<CommitStatusState>('success');
  const [newStatusContext, setNewStatusContext] = useState('manual/check');
  const [newStatusDescription, setNewStatusDescription] = useState('');
  const [newStatusTargetUrl, setNewStatusTargetUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [commitSearchQuery, setCommitSearchQuery] = useState('');
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>(searchParams.get('path') || '');
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<'https' | 'ssh' | null>(null);
  const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
  const [isGoToFileOpen, setIsGoToFileOpen] = useState(false);
  const [isForkDialogOpen, setIsForkDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [newFileMessage, setNewFileMessage] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [readmeName, setReadmeName] = useState('');
  const [readmeContent, setReadmeContent] = useState('');
  const [repoTree, setRepoTree] = useState<GitTreeItem[]>([]);
  const [goToFileQuery, setGoToFileQuery] = useState('');
  const [loadingTree, setLoadingTree] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [engagementSaving, setEngagementSaving] = useState<'star' | 'watch' | null>(null);
  const [forkOrganization, setForkOrganization] = useState('');
  const [forkName, setForkName] = useState('');
  const [activeTab, setActiveTab] = useState('code');

  useEffect(() => {
    if (owner && repoName) {
      loadRepo();
    }
  }, [owner, repoName]);

  useEffect(() => {
    if (repository && currentBranch) {
      loadContents(currentPath);
    }
  }, [repository, currentBranch, currentPath]);

  useEffect(() => {
    if (repository && currentBranch) {
      loadCommits();
      loadReadme();
    }
  }, [repository, currentBranch]);

  useEffect(() => {
    if (selectedCommit) {
      loadCommitStatuses(selectedCommit.sha);
    } else {
      setCommitStatuses([]);
    }
  }, [selectedCommit]);

  const loadRepo = async () => {
    setLoading(true);
    try {
      const [repoData, branchData] = await Promise.all([
        gitea.getRepository(owner!, repoName!),
        gitea.getBranches(owner!, repoName!)
      ]);
      setRepository(repoData);
      setBranches(branchData);
      setCurrentBranch(repoData.default_branch);
      loadEngagementState();
      loadForks();
    } catch (error) {
      console.error('Failed to load repo:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEngagementState = async () => {
    if (!owner || !repoName) return;
    const [starredResult, watchingResult] = await Promise.allSettled([
      gitea.isStarred(owner, repoName),
      gitea.isWatching(owner, repoName),
    ]);
    if (starredResult.status === 'fulfilled') setIsStarred(starredResult.value);
    if (watchingResult.status === 'fulfilled') setIsWatching(watchingResult.value);
  };

  const loadForks = async () => {
    if (!owner || !repoName) return;
    try {
      const data = await gitea.getRepositoryForks(owner, repoName);
      setForks(data);
    } catch (error) {
      console.error('Failed to load repository forks:', error);
      setForks([]);
    }
  };

  const loadCommits = async () => {
    try {
      const commitData = await gitea.getCommits(owner!, repoName!, currentBranch);
      setCommits(commitData);
    } catch (error) {
      console.error('Failed to load commits:', error);
    }
  };

  const loadCommitStatuses = async (sha: string) => {
    if (!owner || !repoName) return;
    setLoadingStatuses(true);
    try {
      const statuses = await gitea.getCommitStatuses(owner, repoName, sha);
      setCommitStatuses(statuses);
    } catch (error) {
      console.error('Failed to load commit statuses:', error);
      setCommitStatuses([]);
    } finally {
      setLoadingStatuses(false);
    }
  };

  const loadContents = async (path: string) => {
    try {
      const data = await gitea.getContents(owner!, repoName!, path, currentBranch);
      if (Array.isArray(data)) {
        setContents(data);
        setSelectedFile(null);
      } else {
        // It's a file
        setSelectedFile(data);
        setCommitMessage(`Update ${data.name}`);
        if (data.content) {
          setFileContent(decodeBase64(data.content));
        } else if (data.download_url) {
          const res = await fetch(data.download_url);
          const text = await res.text();
          setFileContent(text);
        }
      }
    } catch (error) {
      console.error('Failed to load contents:', error);
    }
  };

  const loadReadme = async () => {
    if (!owner || !repoName) return;
    const candidates = ['README.md', 'README.MD', 'Readme.md', 'README'];
    for (const candidate of candidates) {
      try {
        const data = await gitea.getContents(owner, repoName, candidate, currentBranch);
        if (!Array.isArray(data) && data.type === 'file') {
          setReadmeName(data.name);
          if (data.content) {
            setReadmeContent(decodeBase64(data.content));
          } else if (data.download_url) {
            const response = await fetch(data.download_url);
            setReadmeContent(await response.text());
          } else {
            setReadmeContent('');
          }
          return;
        }
      } catch (error: any) {
        if (error.response?.status !== 404) {
          console.error('Failed to load README:', error);
        }
      }
    }
    setReadmeName('');
    setReadmeContent('');
  };

  const filteredContents = contents
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  const filteredCommits = commits.filter(commit => {
    const query = commitSearchQuery.toLowerCase();
    const authorName = (commit.author?.login || commit.commit.author.name).toLowerCase();
    const message = commit.commit.message.toLowerCase();
    const sha = commit.sha.toLowerCase();
    return authorName.includes(query) || message.includes(query) || sha.includes(query);
  });

  const filteredRepoFiles = repoTree
    .filter(item => item.type === 'blob')
    .filter(item => item.path.toLowerCase().includes(goToFileQuery.toLowerCase()))
    .slice(0, 80);

  const handlePathClick = (path: string, type: 'file' | 'dir') => {
    if (type === 'dir') {
      setCurrentPath(path);
      setSearchParams({ path });
    } else {
      loadContents(path);
    }
  };

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    const newPath = parts.join('/');
    setCurrentPath(newPath);
    setSearchParams({ path: newPath });
  };

  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path);
    setSearchParams({ path });
    setSelectedFile(null);
  };

  const openGoToFile = async () => {
    setIsGoToFileOpen(true);
    if (!owner || !repoName || repoTree.length > 0 || loadingTree) return;
    setLoadingTree(true);
    try {
      const branch = branches.find(item => item.name === currentBranch);
      const tree = await gitea.getGitTree(owner, repoName, branch?.commit.sha || currentBranch, true);
      setRepoTree(tree.tree || []);
    } catch (error) {
      console.error('Failed to load repository tree:', error);
    } finally {
      setLoadingTree(false);
    }
  };

  const handleGoToFile = (path: string) => {
    const parentPath = path.split('/').slice(0, -1).join('/');
    setCurrentPath(parentPath);
    setSearchParams({ path: parentPath });
    setIsGoToFileOpen(false);
    setGoToFileQuery('');
    loadContents(path);
  };

  const handleSave = async () => {
    if (!selectedFile || !owner || !repoName) return;
    setSaving(true);
    try {
      const base64Content = encodeBase64(fileContent);
      await gitea.updateFile(owner, repoName, selectedFile.path, {
        content: base64Content,
        sha: selectedFile.sha,
        message: commitMessage.trim() || `Update ${selectedFile.name}`,
        branch: currentBranch
      });
      loadContents(selectedFile.path);
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFile = async () => {
    if (!owner || !repoName || !newFileName.trim()) return;
    const normalizedName = newFileName.trim().replace(/^\/+/, '');
    const filePath = [currentPath, normalizedName].filter(Boolean).join('/');
    setSaving(true);
    try {
      await gitea.createFile(owner, repoName, filePath, {
        content: encodeBase64(newFileContent),
        message: newFileMessage.trim() || `Create ${normalizedName.split('/').pop()}`,
        branch: currentBranch,
      });
      setIsCreateFileOpen(false);
      setNewFileName('');
      setNewFileContent('');
      setNewFileMessage('');
      await loadContents(currentPath);
    } catch (error) {
      console.error('Failed to create file:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!selectedFile || !owner || !repoName) return;
    setSaving(true);
    try {
      await gitea.deleteFile(owner, repoName, selectedFile.path, {
        sha: selectedFile.sha,
        message: `Delete ${selectedFile.name}`,
        branch: currentBranch,
      });
      const parentPath = selectedFile.path.split('/').slice(0, -1).join('/');
      setSelectedFile(null);
      setCurrentPath(parentPath);
      setSearchParams({ path: parentPath });
      await loadContents(parentPath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (value: string, target: 'https' | 'ssh') => {
    navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(null), 2000);
  };

  const openWithProtocol = (url: string) => {
    window.location.href = url;
  };

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleToggleStar = async () => {
    if (!owner || !repoName || !repository) return;
    setEngagementSaving('star');
    try {
      if (isStarred) {
        await gitea.unstarRepository(owner, repoName);
      } else {
        await gitea.starRepository(owner, repoName);
      }
      const nextStarred = !isStarred;
      setIsStarred(nextStarred);
      setRepository({
        ...repository,
        stars_count: Math.max(0, repository.stars_count + (nextStarred ? 1 : -1)),
      });
    } catch (error) {
      console.error('Failed to update star state:', error);
    } finally {
      setEngagementSaving(null);
    }
  };

  const handleToggleWatch = async () => {
    if (!owner || !repoName || !repository) return;
    setEngagementSaving('watch');
    try {
      if (isWatching) {
        await gitea.unwatchRepository(owner, repoName);
      } else {
        await gitea.watchRepository(owner, repoName);
      }
      const nextWatching = !isWatching;
      setIsWatching(nextWatching);
      setRepository({
        ...repository,
        watchers_count: Math.max(0, repository.watchers_count + (nextWatching ? 1 : -1)),
      });
    } catch (error) {
      console.error('Failed to update watch state:', error);
    } finally {
      setEngagementSaving(null);
    }
  };

  const handleCreateCommitStatus = async () => {
    if (!owner || !repoName || !selectedCommit || !newStatusContext.trim()) return;
    setSaving(true);
    try {
      const status = await gitea.createCommitStatus(owner, repoName, selectedCommit.sha, {
        state: newStatusState,
        context: newStatusContext.trim(),
        description: newStatusDescription.trim() || undefined,
        target_url: newStatusTargetUrl.trim() || undefined,
      });
      setCommitStatuses([status, ...commitStatuses]);
      setNewStatusDescription('');
      setNewStatusTargetUrl('');
    } catch (error) {
      console.error('Failed to create commit status:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFork = async () => {
    if (!owner || !repoName) return;
    setSaving(true);
    try {
      const fork = await gitea.createRepositoryFork(owner, repoName, {
        organization: forkOrganization.trim() || undefined,
        name: forkName.trim() || undefined,
      });
      setForks([fork, ...forks]);
      setIsForkDialogOpen(false);
      setForkOrganization('');
      setForkName('');
      navigate(`/repo/${fork.owner.login}/${fork.name}`);
    } catch (error) {
      console.error('Failed to fork repository:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-1/3 bg-slate-200" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 bg-slate-200" />)}
        </div>
        <Skeleton className="h-96 w-full bg-slate-200" />
      </div>
    );
  }

  if (!repository) return <div className="p-8">Repository not found.</div>;

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-slate-100">
      {/* Repo Header */}
      <header className="bg-white px-8 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{repository.owner.login}</span>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-900">{repository.name}</span>
          <Badge variant="outline" className="ml-2 bg-slate-50 text-slate-600 border-slate-200 text-[10px] uppercase font-bold">
            {repository.private ? 'Private' : 'Public'}
          </Badge>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStar}
            disabled={engagementSaving === 'star'}
            className={cn(
              "h-8 border-slate-200 hover:bg-slate-50",
              isStarred ? "text-amber-600 bg-amber-50 border-amber-100 hover:bg-amber-100" : "text-slate-600"
            )}
          >
            <Star className={cn("w-3.5 h-3.5 mr-2", isStarred && "fill-current")} /> {isStarred ? 'Starred' : 'Star'} ({repository.stars_count})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleWatch}
            disabled={engagementSaving === 'watch'}
            className={cn(
              "h-8 border-slate-200 hover:bg-slate-50",
              isWatching ? "text-sky-600 bg-sky-50 border-sky-100 hover:bg-sky-100" : "text-slate-600"
            )}
          >
            <Eye className="w-3.5 h-3.5 mr-2" /> {isWatching ? 'Watching' : 'Watch'} ({repository.watchers_count})
          </Button>
          <Dialog open={isForkDialogOpen} onOpenChange={setIsForkDialogOpen}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsForkDialogOpen(true)}
              className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <GitFork className="w-3.5 h-3.5 mr-2" /> Fork ({repository.forks_count})
            </Button>
            <DialogContent className="sm:max-w-xl bg-white">
              <DialogHeader>
                <DialogTitle>Fork Repository</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</label>
                    <Input
                      value={forkName}
                      onChange={(event) => setForkName(event.target.value)}
                      placeholder={repository.name}
                      className="h-10 border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organization</label>
                    <Input
                      value={forkOrganization}
                      onChange={(event) => setForkOrganization(event.target.value)}
                      placeholder="optional"
                      className="h-10 border-slate-200"
                    />
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Existing forks</span>
                    <Button variant="ghost" size="sm" onClick={loadForks} className="h-7 text-slate-500">
                      Refresh
                    </Button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {forks.map((fork) => (
                      <Link
                        key={fork.id}
                        to={`/repo/${fork.owner.login}/${fork.name}`}
                        onClick={() => setIsForkDialogOpen(false)}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{fork.full_name}</div>
                          <div className="text-xs text-slate-400 truncate">{fork.description || 'No description'}</div>
                        </div>
                        <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">{fork.private ? 'Private' : 'Public'}</Badge>
                      </Link>
                    ))}
                    {forks.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No forks found</div>}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsForkDialogOpen(false)} className="border-slate-200 text-slate-600">Cancel</Button>
                <Button onClick={handleCreateFork} disabled={saving} className="bg-sky-600 text-white hover:bg-sky-700">
                  <GitFork className="w-3.5 h-3.5 mr-2" /> {saving ? 'Forking...' : 'Create Fork'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  className="h-8 bg-slate-900 text-white hover:bg-slate-800"
                >
                  {copiedTarget ? <Check className="w-3.5 h-3.5 mr-2" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
                  Code
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-[340px] bg-white">
              <div className="px-2 py-1 text-xs font-medium text-slate-500">Clone repository</div>

              <div className="px-2 py-1.5 space-y-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HTTPS</div>
                  <div className="font-mono text-[10px] text-slate-600 break-all">{repository.clone_url}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SSH</div>
                  <div className="font-mono text-[10px] text-slate-600 break-all">{repository.ssh_url}</div>
                </div>
              </div>

              <DropdownMenuItem onClick={() => copyToClipboard(repository.clone_url, 'https')}>
                {copiedTarget === 'https' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                Copy HTTPS URL
                <DropdownMenuShortcut>HTTPS</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyToClipboard(repository.ssh_url, 'ssh')}>
                {copiedTarget === 'ssh' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                Copy SSH URL
                <DropdownMenuShortcut>SSH</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-xs font-medium text-slate-500">Open in IDE</div>
              <DropdownMenuItem onClick={() => openWithProtocol(`vscode://vscode.git/clone?url=${encodeURIComponent(repository.clone_url)}`)}>
                <ExternalLink className="w-4 h-4" />
                Open with VS Code
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openWithProtocol(`vscodium://vscode.git/clone?url=${encodeURIComponent(repository.clone_url)}`)}>
                <ExternalLink className="w-4 h-4" />
                Open with VSCodium
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openWithProtocol(`jetbrains://idea/checkout/git?checkout.repo=${encodeURIComponent(repository.clone_url)}&checkout.branch=${encodeURIComponent(currentBranch || repository.default_branch)}`)}
              >
                <ExternalLink className="w-4 h-4" />
                Open with IntelliJ IDEA
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-xs font-medium text-slate-500">Download</div>
              <DropdownMenuItem onClick={() => openExternalUrl(`${repository.html_url.replace(/\/$/, '')}/archive/${encodeURIComponent(currentBranch || repository.default_branch)}.zip`)}>
                <Download className="w-4 h-4" />
                Download .zip
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExternalUrl(`${repository.html_url.replace(/\/$/, '')}/archive/${encodeURIComponent(currentBranch || repository.default_branch)}.tar.gz`)}>
                <Download className="w-4 h-4" />
                Download .tar.gz
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExternalUrl(`${repository.html_url.replace(/\/$/, '')}/archive/${encodeURIComponent(currentBranch || repository.default_branch)}.bundle`)}>
                <Download className="w-4 h-4" />
                Download .bundle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        <div className="border-b border-slate-200 px-8 bg-white shrink-0">
          <TabsList className="bg-transparent h-12 p-0 gap-8">
            <TabsTrigger value="code" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <LayoutIcon className="w-3.5 h-3.5 mr-2" /> Code
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Clock className="w-3.5 h-3.5 mr-2" /> History
            </TabsTrigger>
            <TabsTrigger value="issues" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <MessageSquare className="w-3.5 h-3.5 mr-2" /> Issues
            </TabsTrigger>
            <TabsTrigger value="pulls" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <GitPullRequest className="w-3.5 h-3.5 mr-2" /> Pull Requests
            </TabsTrigger>
            <TabsTrigger value="releases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Package className="w-3.5 h-3.5 mr-2" /> Releases
            </TabsTrigger>
            <TabsTrigger value="tags" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Tag className="w-3.5 h-3.5 mr-2" /> Tags
            </TabsTrigger>
            <TabsTrigger value="wiki" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <BookOpen className="w-3.5 h-3.5 mr-2" /> Wiki
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Activity className="w-3.5 h-3.5 mr-2" /> Activity
            </TabsTrigger>
            <TabsTrigger value="insights" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Activity className="w-3.5 h-3.5 mr-2" /> Insights
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Settings className="w-3.5 h-3.5 mr-2" /> Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="code" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-8 max-w-6xl mx-auto space-y-6">
              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-8 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-900">{commits.length}+</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commits</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-900">{branches.length}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Branches</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-900">{repository.open_issues_count}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issues</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-900">2.4 MB</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Size</span>
                </div>
              </div>

              {/* Branch & Actions */}
              <div className="flex justify-between items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" size="sm" className="h-9 px-3 bg-slate-200/50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-200">
                      <GitBranch className="w-3.5 h-3.5" /> 
                      <span className="opacity-50 font-normal">branch:</span> {currentBranch}
                    </Button>
                  } />
                  <DropdownMenuContent align="start" className="w-56 bg-white">
                    <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Branch</div>
                    {branches.map((branch) => (
                      <DropdownMenuItem 
                        key={branch.name}
                        onClick={() => setCurrentBranch(branch.name)}
                        className={cn(
                          "flex items-center justify-between text-xs cursor-pointer",
                          currentBranch === branch.name && "bg-slate-50 font-bold text-sky-600"
                        )}
                      >
                        {branch.name}
                        {currentBranch === branch.name && <Check className="w-3 h-3" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={openGoToFile} className="h-8 border-slate-200 text-slate-600">
                    <Search className="w-3.5 h-3.5 mr-2" /> Go to File
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsCreateFileOpen(true)} className="h-8 border-slate-200 text-slate-600">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Add file
                  </Button>
                </div>
              </div>

              {/* File Explorer / Editor */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {!selectedFile ? (
                  <div className="flex flex-col">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                      <div className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900">{commits[0]?.author?.login || commits[0]?.commit.author.name}</span> {commits[0]?.commit.message.split('\n')[0]}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Latest commit <span className="font-bold text-slate-600">{commits[0]?.sha.substring(0, 7)}</span> {commits[0] ? new Date(commits[0].commit.author.date).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div className="flex items-center px-4 py-3 bg-white border-b border-slate-100 gap-4">
                      {currentPath && (
                        <Button variant="ghost" size="icon" onClick={handleBack} className="h-7 w-7 shrink-0 hover:bg-slate-100">
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <div className="text-xs font-medium text-slate-500 flex items-center gap-1 flex-1 overflow-hidden">
                        <button 
                          onClick={() => handleBreadcrumbClick('')}
                          className="text-slate-900 hover:text-sky-600 hover:underline transition-colors shrink-0"
                        >
                          {repository.name}
                        </button>
                        {currentPath.split('/').filter(Boolean).map((part, i, arr) => {
                          const path = arr.slice(0, i + 1).join('/');
                          return (
                            <React.Fragment key={path}>
                              <span className="text-slate-300 shrink-0">/</span>
                              <button 
                                onClick={() => handleBreadcrumbClick(path)}
                                className="hover:text-sky-600 hover:underline transition-colors truncate"
                              >
                                {part}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <div className="relative w-48 shrink-0">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <Input 
                          placeholder="Search files..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-7 pl-7 text-[10px] bg-slate-50 border-slate-200 focus-visible:ring-sky-400"
                        />
                      </div>
                    </div>
                    <table className="w-full">
                      <tbody>
                        {filteredContents.map((item) => (
                          <tr 
                            key={item.path} 
                            onClick={() => handlePathClick(item.path, item.type)}
                            className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className={cn("flex items-center gap-3 text-sm font-medium", item.type === 'dir' ? 'text-sky-700' : 'text-slate-700')}>
                                {getExplorerIcon(item.name, item.type, 'w-4 h-4 shrink-0')}
                                <span className="truncate">{item.name}</span>
                                <span className={cn(
                                  'ml-1 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none',
                                  item.type === 'dir'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                )}>
                                  {getFileBadgeLabel(item.name, item.type)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500 w-1/2">
                              Initial folder structure setup
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-400 text-right">
                              2 months ago
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col h-[600px]">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                      <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-8 w-8 hover:bg-slate-100">
                          <ArrowLeft className="w-4 h-4" />
                        </Button>
                    <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <button 
                        onClick={() => handleBreadcrumbClick('')}
                        className="hover:text-sky-600 hover:underline transition-colors"
                      >
                        {repository.name}
                      </button>
                      {selectedFile.path.split('/').slice(0, -1).map((part, i, arr) => {
                        const path = arr.slice(0, i + 1).join('/');
                        return (
                          <React.Fragment key={path}>
                            <span className="text-slate-300">/</span>
                            <button 
                              onClick={() => handleBreadcrumbClick(path)}
                              className="hover:text-sky-600 hover:underline transition-colors"
                            >
                              {part}
                            </button>
                          </React.Fragment>
                        );
                      })}
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-900 font-bold"> {selectedFile.name}</span>
                    </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={commitMessage}
                          onChange={(event) => setCommitMessage(event.target.value)}
                          placeholder="Commit message"
                          className="h-8 w-64 border-slate-200 text-xs"
                        />
                        <Button
                          variant="outline"
                          onClick={handleDeleteFile}
                          disabled={saving}
                          size="sm"
                          className="h-8 border-red-100 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                        </Button>
                        <Button 
                          onClick={handleSave}
                          disabled={saving}
                          size="sm"
                          className="h-8 bg-slate-900 text-white hover:bg-slate-800"
                        >
                          <Save className="w-3.5 h-3.5 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <Editor
                        height="100%"
                        defaultLanguage={selectedFile.name.split('.').pop() || 'plaintext'}
                        value={fileContent}
                        onChange={(val) => setFileContent(val || '')}
                        theme="vs-light"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          fontFamily: 'JetBrains Mono, monospace',
                          lineNumbers: 'on',
                          roundedSelection: false,
                          scrollBeyondLastLine: false,
                          readOnly: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* README Preview */}
              <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">{readmeName || 'README'}</h3>
                <div className="h-px bg-slate-100 mb-6" />
                {readmeContent ? (
                  <MarkdownRenderer content={readmeContent} />
                ) : (
                  <p className="text-sm leading-relaxed text-slate-500">No README found on {currentBranch}.</p>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-8 max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-900">Commit History</h2>
                  <div className="text-xs text-slate-500 font-mono">
                    Showing {filteredCommits.length} of {commits.length} commits
                  </div>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search commits by author, message, or SHA..." 
                    value={commitSearchQuery}
                    onChange={(e) => setCommitSearchQuery(e.target.value)}
                    className="h-9 pl-9 text-xs bg-white border-slate-200 focus-visible:ring-sky-400 shadow-sm"
                  />
                </div>
              </div>
              
              <GitGraph commits={filteredCommits} onCommitClick={setSelectedCommit} />

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Author</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commit</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message</th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommits.map((commit) => (
                      <tr 
                        key={commit.sha} 
                        onClick={() => setSelectedCommit(commit)}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <img src={commit.author?.avatar_url} className="w-5 h-5 rounded-full" alt="" />
                            <span className="text-xs font-medium">{commit.author?.login || commit.commit.author.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">{commit.sha.substring(0, 7)}</code>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 font-medium">
                          {commit.commit.message.split('\n')[0]}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-400 text-right">
                          {new Date(commit.commit.author.date).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="issues" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {owner && repoName && (
            <IssuesView gitea={gitea} owner={owner} repo={repoName} />
          )}
        </TabsContent>

        <TabsContent value="pulls" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {owner && repoName && (
            <PullRequestsView
              gitea={gitea}
              owner={owner}
              repo={repoName}
              defaultBranch={repository.default_branch}
            />
          )}
        </TabsContent>

        <TabsContent value="releases" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {owner && repoName && (
            <ReleasesView
              gitea={gitea}
              owner={owner}
              repo={repoName}
              defaultBranch={repository.default_branch}
            />
          )}
        </TabsContent>

        <TabsContent value="tags" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {owner && repoName && (
            <TagsView
              gitea={gitea}
              owner={owner}
              repo={repoName}
              branches={branches}
              defaultBranch={repository.default_branch}
            />
          )}
        </TabsContent>

        <TabsContent value="wiki" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {owner && repoName && (
            <WikiView
              gitea={gitea}
              owner={owner}
              repo={repoName}
            />
          )}
        </TabsContent>

        <TabsContent value="activity" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {activeTab === 'activity' && owner && repoName && (
            <RepositoryActivityView
              gitea={gitea}
              owner={owner}
              repo={repoName}
            />
          )}
        </TabsContent>

        <TabsContent value="insights" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {activeTab === 'insights' && owner && repoName && (
            <RepositoryInsightsView
              gitea={gitea}
              owner={owner}
              repo={repoName}
              repository={repository}
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden m-0">
          {activeTab === 'settings' && owner && repoName && (
            <RepositorySettingsView
              gitea={gitea}
              owner={owner}
              repo={repoName}
              repository={repository}
              onRepositoryUpdate={setRepository}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Commit Detail Sheet */}
      <Sheet open={!!selectedCommit} onOpenChange={(open) => !open && setSelectedCommit(null)}>
        <SheetContent className="sm:max-w-md bg-white">
          <SheetHeader className="border-b border-slate-100 pb-4">
            <SheetTitle className="text-lg font-bold text-slate-900">Commit Details</SheetTitle>
            <SheetDescription className="text-xs font-mono text-slate-500">
              {selectedCommit?.sha}
            </SheetDescription>
          </SheetHeader>
          
          {selectedCommit && (
            <div className="py-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img src={selectedCommit.author?.avatar_url} className="w-10 h-10 rounded-full border border-slate-200" alt="" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{selectedCommit.author?.login || selectedCommit.commit.author.name}</div>
                    <div className="text-xs text-slate-500">{selectedCommit.commit.author.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(selectedCommit.commit.author.date).toLocaleString()}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap font-medium leading-relaxed">
                  {selectedCommit.commit.message}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parents</div>
                <div className="space-y-2">
                  {selectedCommit.parents.map(parent => (
                    <div key={parent.sha} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-md">
                      <code className="text-[10px] font-mono text-slate-600">{parent.sha.substring(0, 10)}...</code>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-sky-600 hover:text-sky-700 hover:bg-sky-50">
                        View Parent
                      </Button>
                    </div>
                  ))}
                  {selectedCommit.parents.length === 0 && (
                    <div className="text-xs text-slate-400 italic">No parent commits (Initial commit)</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statuses</div>
                  {loadingStatuses && <div className="text-[10px] text-slate-400">Loading...</div>}
                </div>
                <div className="space-y-2">
                  {commitStatuses.map((status, index) => (
                    <div key={`${status.id || status.context || 'status'}-${index}`} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{status.context || 'default'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{status.description || 'No description'}</div>
                        </div>
                        <Badge variant="outline" className={cn("border text-[10px]", statusClasses[status.state] || statusClasses.pending)}>
                          {statusLabels[status.state] || status.state}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                        <span>{status.creator?.login ? `by ${status.creator.login}` : status.created_at ? new Date(status.created_at).toLocaleString() : 'Commit status'}</span>
                        {status.target_url && (
                          <a href={status.target_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700">
                            Details <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {!loadingStatuses && commitStatuses.length === 0 && (
                    <div className="text-xs text-slate-400 italic">No commit statuses reported.</div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  Add status
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" className="w-full h-9 justify-between bg-white border-slate-200 text-xs">
                      <span className="flex items-center gap-2">
                        {newStatusState === 'success' ? <Check className="w-3.5 h-3.5 text-green-600" /> : newStatusState === 'pending' ? <Clock className="w-3.5 h-3.5 text-amber-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                        {statusLabels[newStatusState]}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50 rotate-90" />
                    </Button>
                  } />
                  <DropdownMenuContent align="start" className="w-56 bg-white">
                    {(['success', 'pending', 'failure', 'error', 'warning'] as CommitStatusState[]).map((state) => (
                      <DropdownMenuItem key={state} onClick={() => setNewStatusState(state)} className="text-xs">
                        {statusLabels[state]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Input
                  value={newStatusContext}
                  onChange={(event) => setNewStatusContext(event.target.value)}
                  placeholder="Context"
                  className="h-9 border-slate-200 bg-white text-xs"
                />
                <Input
                  value={newStatusDescription}
                  onChange={(event) => setNewStatusDescription(event.target.value)}
                  placeholder="Description"
                  className="h-9 border-slate-200 bg-white text-xs"
                />
                <Input
                  value={newStatusTargetUrl}
                  onChange={(event) => setNewStatusTargetUrl(event.target.value)}
                  placeholder="Target URL"
                  className="h-9 border-slate-200 bg-white text-xs"
                />
                <Button onClick={handleCreateCommitStatus} disabled={!newStatusContext.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
                  <Activity className="w-3.5 h-3.5 mr-2" /> {saving ? 'Adding...' : 'Add Status'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isCreateFileOpen} onOpenChange={setIsCreateFileOpen}>
        <DialogContent className="sm:max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Create File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Path</label>
                <Input
                  value={newFileName}
                  onChange={(event) => setNewFileName(event.target.value)}
                  placeholder={currentPath ? `${currentPath}/new-file.ts` : 'new-file.ts'}
                  className="h-10 border-slate-200 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commit message</label>
                <Input
                  value={newFileMessage}
                  onChange={(event) => setNewFileMessage(event.target.value)}
                  placeholder="Create new file"
                  className="h-10 border-slate-200 text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Content</label>
              <textarea
                value={newFileContent}
                onChange={(event) => setNewFileContent(event.target.value)}
                className="h-80 w-full resize-none rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter className="bg-white border-slate-100">
            <Button variant="outline" onClick={() => setIsCreateFileOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFile} disabled={!newFileName.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">
              <Plus className="w-3.5 h-3.5 mr-2" /> {saving ? 'Creating...' : 'Create File'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGoToFileOpen} onOpenChange={setIsGoToFileOpen}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Go to File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                autoFocus
                value={goToFileQuery}
                onChange={(event) => setGoToFileQuery(event.target.value)}
                placeholder="Search by path..."
                className="h-10 pl-10 border-slate-200 font-mono text-xs"
              />
            </div>
            <ScrollArea className="h-96 rounded-lg border border-slate-100">
              <div className="divide-y divide-slate-100">
                {loadingTree ? (
                  <div className="p-8 text-center text-sm text-slate-400">Loading repository tree...</div>
                ) : filteredRepoFiles.length > 0 ? (
                  filteredRepoFiles.map((item) => (
                    <button
                      key={item.sha + item.path}
                      type="button"
                      onClick={() => handleGoToFile(item.path)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getExplorerIcon(item.path, 'file', 'w-3.5 h-3.5 shrink-0')}
                        <span className="font-mono text-xs text-slate-700 truncate">{item.path}</span>
                        <span className="ml-auto shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-500">
                          {getFileBadgeLabel(item.path, 'file')}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400">No files found</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
