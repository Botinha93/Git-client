import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronDown,
  GitBranch,
  Globe,
  KeyRound,
  Lock,
  Plus,
  Save,
  Send,
  Settings2,
  Shield,
  ShieldCheck,
  Tag,
  Trash2,
  UserPlus,
  Users,
  Webhook,
} from 'lucide-react';
import { Branch, BranchProtection, Collaborator, DeployKey, GiteaService, Hook, Repository } from '@/src/lib/gitea';
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

interface RepositorySettingsViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
  repository: Repository;
  onRepositoryUpdate: (repository: Repository) => void;
}

type Permission = 'read' | 'write' | 'admin';

function protectionBranchName(protection: BranchProtection) {
  return protection.branch_name || protection.protected_branch_name || '';
}

function permissionLabel(collaborator: Collaborator) {
  if (collaborator.permissions?.admin) return 'admin';
  if (collaborator.permissions?.push) return 'write';
  return 'read';
}

export function RepositorySettingsView({ gitea, owner, repo, repository, onRepositoryUpdate }: RepositorySettingsViewProps) {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [deployKeys, setDeployKeys] = useState<DeployKey[]>([]);
  const [branchProtections, setBranchProtections] = useState<BranchProtection[]>([]);
  const [topics, setTopics] = useState<string[]>(repository.topics || []);
  const [description, setDescription] = useState(repository.description || '');
  const [website, setWebsite] = useState(repository.website || '');
  const [defaultBranch, setDefaultBranch] = useState(repository.default_branch);
  const [isPrivate, setIsPrivate] = useState(repository.private);
  const [isArchived, setIsArchived] = useState(!!repository.archived);
  const [hasIssues, setHasIssues] = useState(repository.has_issues ?? true);
  const [hasWiki, setHasWiki] = useState(repository.has_wiki ?? true);
  const [hasPullRequests, setHasPullRequests] = useState(repository.has_pull_requests ?? true);
  const [newBranchName, setNewBranchName] = useState('');
  const [sourceBranch, setSourceBranch] = useState(repository.default_branch);
  const [newCollaborator, setNewCollaborator] = useState('');
  const [newPermission, setNewPermission] = useState<Permission>('write');
  const [topicInput, setTopicInput] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [hookSecret, setHookSecret] = useState('');
  const [hookEvents, setHookEvents] = useState('push,pull_request,issues');
  const [deployKeyTitle, setDeployKeyTitle] = useState('');
  const [deployKeyValue, setDeployKeyValue] = useState('');
  const [deployKeyReadOnly, setDeployKeyReadOnly] = useState(true);
  const [protectionBranch, setProtectionBranch] = useState(repository.default_branch);
  const [requiredApprovals, setRequiredApprovals] = useState('1');
  const [requireSignedCommits, setRequireSignedCommits] = useState(false);
  const [blockRejectedReviews, setBlockRejectedReviews] = useState(true);
  const [transferOwner, setTransferOwner] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDescription(repository.description || '');
    setWebsite(repository.website || '');
    setDefaultBranch(repository.default_branch);
    setIsPrivate(repository.private);
    setIsArchived(!!repository.archived);
    setHasIssues(repository.has_issues ?? true);
    setHasWiki(repository.has_wiki ?? true);
    setHasPullRequests(repository.has_pull_requests ?? true);
    setTopics(repository.topics || []);
    setSourceBranch(repository.default_branch);
    setProtectionBranch(repository.default_branch);
  }, [repository]);

  useEffect(() => {
    loadSettingsData();
  }, [owner, repo]);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [branchData, collaboratorData, hookData, deployKeyData, protectionData, topicData] = await Promise.all([
        gitea.getBranches(owner, repo),
        gitea.getCollaborators(owner, repo),
        gitea.getRepositoryHooks(owner, repo),
        gitea.getDeployKeys(owner, repo),
        gitea.getBranchProtections(owner, repo),
        gitea.getRepositoryTopics(owner, repo),
      ]);
      setBranches(branchData);
      setCollaborators(collaboratorData);
      setHooks(hookData);
      setDeployKeys(deployKeyData);
      setBranchProtections(protectionData);
      setTopics(topicData.topics || []);
      setSourceBranch((current) => current || branchData[0]?.name || repository.default_branch);
      setProtectionBranch((current) => current || repository.default_branch || branchData[0]?.name || '');
    } catch (error) {
      console.error('Failed to load repository settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const branchNames = useMemo(() => branches.map((branch) => branch.name), [branches]);

  const handleSaveRepository = async () => {
    setSaving(true);
    try {
      const updated = await gitea.updateRepository(owner, repo, {
        description,
        website,
        private: isPrivate,
        archived: isArchived,
        has_issues: hasIssues,
        has_wiki: hasWiki,
        has_pull_requests: hasPullRequests,
        default_branch: defaultBranch,
      });
      onRepositoryUpdate(updated);
    } catch (error) {
      console.error('Failed to update repository settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setSaving(true);
    try {
      const branch = await gitea.createBranch(owner, repo, {
        new_branch_name: newBranchName.trim(),
        old_branch_name: sourceBranch,
      });
      setBranches([...branches, branch]);
      setNewBranchName('');
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    setSaving(true);
    try {
      await gitea.deleteBranch(owner, repo, branchName);
      setBranches(branches.filter((branch) => branch.name !== branchName));
      if (sourceBranch === branchName) setSourceBranch(repository.default_branch);
    } catch (error) {
      console.error('Failed to delete branch:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!newCollaborator.trim()) return;
    setSaving(true);
    try {
      await gitea.addCollaborator(owner, repo, newCollaborator.trim(), { permission: newPermission });
      const data = await gitea.getCollaborators(owner, repo);
      setCollaborators(data);
      setNewCollaborator('');
    } catch (error) {
      console.error('Failed to add collaborator:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCollaborator = async (username: string) => {
    setSaving(true);
    try {
      await gitea.deleteCollaborator(owner, repo, username);
      setCollaborators(collaborators.filter((collaborator) => collaborator.login !== username));
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTopic = async () => {
    const topic = topicInput.trim().toLowerCase();
    if (!topic || topics.includes(topic)) return;
    setSaving(true);
    try {
      await gitea.addRepositoryTopic(owner, repo, topic);
      setTopics([...topics, topic]);
      setTopicInput('');
    } catch (error) {
      console.error('Failed to add repository topic:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async (topic: string) => {
    setSaving(true);
    try {
      await gitea.deleteRepositoryTopic(owner, repo, topic);
      setTopics(topics.filter((item) => item !== topic));
    } catch (error) {
      console.error('Failed to delete repository topic:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceTopics = async () => {
    const nextTopics = topicInput
      .split(',')
      .map((topic) => topic.trim().toLowerCase())
      .filter(Boolean);
    if (nextTopics.length === 0) return;
    setSaving(true);
    try {
      const response = await gitea.replaceRepositoryTopics(owner, repo, Array.from(new Set(nextTopics)));
      setTopics(response.topics || nextTopics);
      setTopicInput('');
    } catch (error) {
      console.error('Failed to replace repository topics:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateHook = async () => {
    if (!hookUrl.trim()) return;
    setSaving(true);
    try {
      const hook = await gitea.createRepositoryHook(owner, repo, {
        type: 'gitea',
        active: true,
        events: hookEvents.split(',').map((event) => event.trim()).filter(Boolean),
        config: {
          url: hookUrl.trim(),
          content_type: 'json',
          secret: hookSecret,
        },
      });
      setHooks([...hooks, hook]);
      setHookUrl('');
      setHookSecret('');
    } catch (error) {
      console.error('Failed to create repository webhook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHook = async (hook: Hook) => {
    setSaving(true);
    try {
      const updated = await gitea.updateRepositoryHook(owner, repo, hook.id, { active: !hook.active });
      setHooks(hooks.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      console.error('Failed to update repository webhook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHook = async (id: number) => {
    setSaving(true);
    try {
      await gitea.deleteRepositoryHook(owner, repo, id);
      setHooks(hooks.filter((hook) => hook.id !== id));
    } catch (error) {
      console.error('Failed to delete repository webhook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDeployKey = async () => {
    if (!deployKeyTitle.trim() || !deployKeyValue.trim()) return;
    setSaving(true);
    try {
      const key = await gitea.createDeployKey(owner, repo, {
        title: deployKeyTitle.trim(),
        key: deployKeyValue.trim(),
        read_only: deployKeyReadOnly,
      });
      setDeployKeys([...deployKeys, key]);
      setDeployKeyTitle('');
      setDeployKeyValue('');
      setDeployKeyReadOnly(true);
    } catch (error) {
      console.error('Failed to create deploy key:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeployKey = async (id: number) => {
    setSaving(true);
    try {
      await gitea.deleteDeployKey(owner, repo, id);
      setDeployKeys(deployKeys.filter((key) => key.id !== id));
    } catch (error) {
      console.error('Failed to delete deploy key:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranchProtection = async () => {
    if (!protectionBranch.trim()) return;
    setSaving(true);
    try {
      const protection = await gitea.createBranchProtection(owner, repo, {
        branch_name: protectionBranch,
        enable_push: false,
        enable_push_whitelist: false,
        enable_merge_whitelist: false,
        required_approvals: Number(requiredApprovals) || 0,
        block_on_rejected_reviews: blockRejectedReviews,
        require_signed_commits: requireSignedCommits,
      });
      setBranchProtections([...branchProtections.filter((item) => protectionBranchName(item) !== protectionBranch), protection]);
    } catch (error) {
      console.error('Failed to create branch protection:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranchProtection = async (branchName: string) => {
    if (!branchName) return;
    setSaving(true);
    try {
      await gitea.deleteBranchProtection(owner, repo, branchName);
      setBranchProtections(branchProtections.filter((protection) => protectionBranchName(protection) !== branchName));
    } catch (error) {
      console.error('Failed to delete branch protection:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTransferRepository = async () => {
    if (!transferOwner.trim()) return;
    setSaving(true);
    try {
      await gitea.transferRepository(owner, repo, { new_owner: transferOwner.trim() });
      setTransferOwner('');
    } catch (error) {
      console.error('Failed to transfer repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRepository = async () => {
    if (deleteConfirmation !== repository.name && deleteConfirmation !== repository.full_name) return;
    setSaving(true);
    try {
      await gitea.deleteRepository(owner, repo);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleButton = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-10 justify-start border-slate-200 text-slate-600",
        active && "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100"
      )}
    >
      {icon}
      {label}
      {active && <Check className="ml-auto w-3.5 h-3.5" />}
    </Button>
  );

  const branchPicker = (value: string, onSelect: (branch: string) => void) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" className="w-full justify-between h-10 bg-white border-slate-200 text-xs font-medium">
          <span className="flex items-center gap-2 truncate">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{value || 'Select branch'}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      } />
      <DropdownMenuContent align="start" className="w-64 bg-white max-h-80 overflow-y-auto">
        {branchNames.map((branchName) => (
          <DropdownMenuItem key={branchName} onClick={() => onSelect(branchName)} className="text-xs">
            {branchName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-32 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 bg-slate-50/30">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Repository</span>
            </div>
            <Button onClick={handleSaveRepository} disabled={saving} className="h-8 bg-slate-900 text-white hover:bg-slate-800">
              <Save className="w-3.5 h-3.5 mr-2" /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <div className="p-5 grid grid-cols-[1fr_280px] gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <Input value={description} onChange={(event) => setDescription(event.target.value)} className="h-10 border-slate-200" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Website</label>
                <Input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" className="h-10 border-slate-200" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default branch</label>
                {branchPicker(defaultBranch, setDefaultBranch)}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Topics</label>
                <div className="flex flex-wrap gap-2 min-h-10 rounded-md border border-slate-200 bg-white p-2">
                  {topics.map((topic) => (
                    <Badge key={topic} variant="outline" className="border-sky-100 bg-sky-50 text-sky-700">
                      {topic}
                      <button
                        type="button"
                        onClick={() => handleDeleteTopic(topic)}
                        disabled={saving}
                        className="ml-1 text-sky-400 hover:text-red-500"
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                  {topics.length === 0 && <span className="text-xs text-slate-400 px-1 py-0.5">No topics configured</span>}
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <Input
                    value={topicInput}
                    onChange={(event) => setTopicInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddTopic();
                      }
                    }}
                    placeholder="topic or comma,separated,list"
                    className="h-9 border-slate-200 text-xs"
                  />
                  <Button type="button" variant="outline" onClick={handleAddTopic} disabled={!topicInput.trim() || saving} className="h-9 border-slate-200 text-slate-600">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                  <Button type="button" variant="outline" onClick={handleReplaceTopics} disabled={!topicInput.includes(',') || saving} className="h-9 border-slate-200 text-slate-600">
                    <Tag className="w-3.5 h-3.5 mr-1" /> Replace
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {toggleButton(isPrivate, () => setIsPrivate(!isPrivate), <Lock className="w-3.5 h-3.5 mr-2" />, 'Private')}
              {toggleButton(isArchived, () => setIsArchived(!isArchived), <Archive className="w-3.5 h-3.5 mr-2" />, 'Archived')}
              {toggleButton(hasIssues, () => setHasIssues(!hasIssues), <Globe className="w-3.5 h-3.5 mr-2" />, 'Issues')}
              {toggleButton(hasPullRequests, () => setHasPullRequests(!hasPullRequests), <GitBranch className="w-3.5 h-3.5 mr-2" />, 'Pull Requests')}
              {toggleButton(hasWiki, () => setHasWiki(!hasWiki), <Shield className="w-3.5 h-3.5 mr-2" />, 'Wiki')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Branches</span>
            </div>
            <div className="divide-y divide-slate-100">
              {branches.map((branch) => (
                <div key={branch.name} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{branch.name}</span>
                      {branch.name === repository.default_branch && <Badge className="bg-slate-900 text-white text-[10px]">Default</Badge>}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">{branch.commit?.sha?.substring(0, 12)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={saving || branch.name === repository.default_branch}
                    onClick={() => handleDeleteBranch(branch.name)}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Create branch</span>
            </div>
            <Input value={newBranchName} onChange={(event) => setNewBranchName(event.target.value)} placeholder="feature/new-work" className="h-10 border-slate-200 font-mono text-xs" />
            {branchPicker(sourceBranch, setSourceBranch)}
            <Button onClick={handleCreateBranch} disabled={!newBranchName.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
              <GitBranch className="w-3.5 h-3.5 mr-2" /> Create Branch
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Collaborators</span>
            </div>
            <div className="divide-y divide-slate-100">
              {collaborators.map((collaborator) => (
                <div key={collaborator.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={collaborator.avatar_url} className="w-8 h-8 rounded-full border border-slate-200" alt="" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{collaborator.full_name || collaborator.login}</div>
                      <div className="text-xs text-slate-400 truncate">@{collaborator.login}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px] uppercase">{permissionLabel(collaborator)}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() => handleRemoveCollaborator(collaborator.login)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {collaborators.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">No collaborators found</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Add collaborator</span>
            </div>
            <Input value={newCollaborator} onChange={(event) => setNewCollaborator(event.target.value)} placeholder="username" className="h-10 border-slate-200" />
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="outline" className="w-full justify-between h-10 bg-white border-slate-200 text-xs font-medium">
                  {newPermission}
                  <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </Button>
              } />
              <DropdownMenuContent align="start" className="w-56 bg-white">
                {(['read', 'write', 'admin'] as Permission[]).map((permission) => (
                  <DropdownMenuItem key={permission} onClick={() => setNewPermission(permission)} className="text-xs">
                    {permission}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleAddCollaborator} disabled={!newCollaborator.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
              <UserPlus className="w-3.5 h-3.5 mr-2" /> Add Collaborator
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Webhooks</span>
            </div>
            <div className="divide-y divide-slate-100">
              {hooks.map((hook) => (
                <div key={hook.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{hook.config?.url || hook.type}</div>
                    <div className="text-xs text-slate-400 truncate">{hook.events?.join(', ') || 'No events configured'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleToggleHook(hook)} disabled={saving} className="h-8 border-slate-200 text-slate-600">
                      {hook.active ? 'Active' : 'Inactive'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() => handleDeleteHook(hook.id)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {hooks.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">No repository webhooks</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Add webhook</span>
            </div>
            <Input value={hookUrl} onChange={(event) => setHookUrl(event.target.value)} placeholder="https://example.com/webhook" className="h-10 border-slate-200 text-xs" />
            <Input value={hookEvents} onChange={(event) => setHookEvents(event.target.value)} placeholder="push,issues" className="h-10 border-slate-200 text-xs" />
            <Input value={hookSecret} onChange={(event) => setHookSecret(event.target.value)} placeholder="Secret" className="h-10 border-slate-200 text-xs" />
            <Button onClick={handleCreateHook} disabled={!hookUrl.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
              <Webhook className="w-3.5 h-3.5 mr-2" /> Add Webhook
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Deploy keys</span>
            </div>
            <div className="divide-y divide-slate-100">
              {deployKeys.map((key) => (
                <div key={key.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{key.title}</span>
                      <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">{key.read_only ? 'Read only' : 'Write'}</Badge>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">{key.fingerprint || key.key}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={saving}
                    onClick={() => handleDeleteDeployKey(key.id)}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {deployKeys.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">No deploy keys configured</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Add deploy key</span>
            </div>
            <Input value={deployKeyTitle} onChange={(event) => setDeployKeyTitle(event.target.value)} placeholder="Key title" className="h-10 border-slate-200" />
            <textarea
              value={deployKeyValue}
              onChange={(event) => setDeployKeyValue(event.target.value)}
              placeholder="ssh-ed25519 AAAA..."
              className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
            />
            {toggleButton(deployKeyReadOnly, () => setDeployKeyReadOnly(!deployKeyReadOnly), <Lock className="w-3.5 h-3.5 mr-2" />, 'Read only')}
            <Button onClick={handleCreateDeployKey} disabled={!deployKeyTitle.trim() || !deployKeyValue.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
              <Plus className="w-3.5 h-3.5 mr-2" /> Add Deploy Key
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Branch protections</span>
            </div>
            <div className="divide-y divide-slate-100">
              {branchProtections.map((protection) => {
                const branchName = protectionBranchName(protection);
                return (
                  <div key={branchName} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{branchName}</span>
                        {protection.require_signed_commits && <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">Signed commits</Badge>}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {protection.required_approvals || 0} approvals required
                        {protection.block_on_rejected_reviews ? ' · blocks rejected reviews' : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() => handleDeleteBranchProtection(branchName)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
              {branchProtections.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">No branch protections configured</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Protect branch</span>
            </div>
            {branchPicker(protectionBranch, setProtectionBranch)}
            <Input
              type="number"
              min="0"
              value={requiredApprovals}
              onChange={(event) => setRequiredApprovals(event.target.value)}
              placeholder="Required approvals"
              className="h-10 border-slate-200"
            />
            {toggleButton(requireSignedCommits, () => setRequireSignedCommits(!requireSignedCommits), <Shield className="w-3.5 h-3.5 mr-2" />, 'Signed commits')}
            {toggleButton(blockRejectedReviews, () => setBlockRejectedReviews(!blockRejectedReviews), <ShieldCheck className="w-3.5 h-3.5 mr-2" />, 'Block rejected reviews')}
            <Button onClick={handleCreateBranchProtection} disabled={!protectionBranch.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
              <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Save Protection
            </Button>
          </div>
        </div>

        <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-red-900">Danger zone</span>
          </div>
          <div className="p-5 grid grid-cols-[1fr_1fr] gap-6">
            <div className="space-y-3">
              <div>
                <div className="text-sm font-bold text-slate-900">Transfer repository</div>
                <div className="text-xs text-slate-400 mt-1">Move ownership to another user or organization.</div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Input value={transferOwner} onChange={(event) => setTransferOwner(event.target.value)} placeholder="new-owner" className="h-10 border-slate-200" />
                <Button onClick={handleTransferRepository} disabled={!transferOwner.trim() || saving} variant="outline" className="border-slate-200 text-slate-700">
                  Transfer
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-bold text-slate-900">Delete repository</div>
                <div className="text-xs text-slate-400 mt-1">Type <span className="font-mono text-slate-600">{repository.name}</span> or <span className="font-mono text-slate-600">{repository.full_name}</span> to confirm.</div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={repository.name} className="h-10 border-red-100" />
                <Button
                  onClick={handleDeleteRepository}
                  disabled={(deleteConfirmation !== repository.name && deleteConfirmation !== repository.full_name) || saving}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
