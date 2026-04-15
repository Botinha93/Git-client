import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { GiteaService, Repository, FileContent, Branch, Commit } from '@/src/lib/gitea';
import { 
  File, 
  Folder, 
  ChevronRight, 
  GitBranch, 
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
  Search
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import Editor from '@monaco-editor/react';
import { GitGraph } from './GitGraph';
import { IssuesView } from './IssuesView';

interface RepoViewProps {
  gitea: GiteaService;
}

export function RepoView({ gitea }: RepoViewProps) {
  const { owner, repo: repoName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [contents, setContents] = useState<FileContent[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commitSearchQuery, setCommitSearchQuery] = useState('');
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>(searchParams.get('path') || '');
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
    }
  }, [repository, currentBranch]);

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
    } catch (error) {
      console.error('Failed to load repo:', error);
    } finally {
      setLoading(false);
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

  const loadContents = async (path: string) => {
    try {
      const data = await gitea.getContents(owner!, repoName!, path, currentBranch);
      if (Array.isArray(data)) {
        setContents(data);
        setSelectedFile(null);
      } else {
        // It's a file
        setSelectedFile(data);
        if (data.content) {
          setFileContent(atob(data.content));
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

  const filteredContents = contents.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCommits = commits.filter(commit => {
    const query = commitSearchQuery.toLowerCase();
    const authorName = (commit.author?.login || commit.commit.author.name).toLowerCase();
    const message = commit.commit.message.toLowerCase();
    const sha = commit.sha.toLowerCase();
    return authorName.includes(query) || message.includes(query) || sha.includes(query);
  });

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

  const handleSave = async () => {
    if (!selectedFile || !owner || !repoName) return;
    setSaving(true);
    try {
      const base64Content = btoa(fileContent);
      await gitea.updateFile(owner, repoName, selectedFile.path, {
        content: base64Content,
        sha: selectedFile.sha,
        message: `Update ${selectedFile.name}`,
        branch: currentBranch
      });
      loadContents(selectedFile.path);
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setSaving(false);
    }
  };

  const copyCloneUrl = () => {
    if (repository) {
      navigator.clipboard.writeText(repository.clone_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
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
          <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50">
            <Star className="w-3.5 h-3.5 mr-2" /> Star ({repository.stars_count})
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50">
            <Eye className="w-3.5 h-3.5 mr-2" /> Watch ({repository.watchers_count})
          </Button>
          <Button 
            onClick={copyCloneUrl}
            size="sm"
            className="h-8 bg-slate-900 text-white hover:bg-slate-800"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-2" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
            Code
          </Button>
        </div>
      </header>

      <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white px-8 border-b border-slate-200">
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
          </TabsList>
        </div>

        <TabsContent value="code" className="flex-1 flex flex-col overflow-hidden m-0">
          <ScrollArea className="flex-1">
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
                  <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600">Go to File</Button>
                  <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600">Add file</Button>
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
                              <div className="flex items-center gap-3 text-sm font-medium text-blue-600">
                                <div className={cn("w-4 h-4 rounded-[3px]", item.type === 'dir' ? "bg-sky-400" : "bg-slate-400")} />
                                {item.name}
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
                      <Button 
                        onClick={handleSave}
                        disabled={saving}
                        size="sm"
                        className="h-8 bg-slate-900 text-white hover:bg-slate-800"
                      >
                        <Save className="w-3.5 h-3.5 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
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
                <h3 className="text-sm font-bold text-slate-900 mb-4">README.md</h3>
                <div className="h-px bg-slate-100 mb-6" />
                <p className="text-sm leading-relaxed text-slate-500">
                  <strong>{repository.name}</strong> is a robust repository managed via GitFlow. 
                  Includes pre-configured CI/CD pipelines, unit testing suites, and a design system core.
                </p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 flex flex-col overflow-hidden m-0">
          <ScrollArea className="flex-1">
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

        <TabsContent value="issues" className="flex-1 flex flex-col overflow-hidden m-0">
          {owner && repoName && (
            <IssuesView gitea={gitea} owner={owner} repo={repoName} />
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
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
