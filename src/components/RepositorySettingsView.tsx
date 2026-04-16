import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronDown,
  Database,
  GitBranch,
  Globe,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
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
  Workflow,
} from 'lucide-react';
import { ActionArtifact, ActionSecret, ActionVariable, ActionWorkflow, AdminActionRun, AdminActionRunner, Branch, BranchProtection, Collaborator, DeployKey, GiteaService, Hook, PushMirror, Repository } from '@/src/lib/gitea';
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
  const [pushMirrors, setPushMirrors] = useState<PushMirror[]>([]);
  const [branchProtections, setBranchProtections] = useState<BranchProtection[]>([]);
  const [actionVariables, setActionVariables] = useState<ActionVariable[]>([]);
  const [actionSecrets, setActionSecrets] = useState<ActionSecret[]>([]);
  const [actionArtifacts, setActionArtifacts] = useState<ActionArtifact[]>([]);
  const [actionWorkflows, setActionWorkflows] = useState<ActionWorkflow[]>([]);
  const [actionRunners, setActionRunners] = useState<AdminActionRunner[]>([]);
  const [actionTasks, setActionTasks] = useState<AdminActionRun[]>([]);
  const [runnerRegistrationToken, setRunnerRegistrationToken] = useState('');
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
  const [renameBranchSource, setRenameBranchSource] = useState(repository.default_branch);
  const [renameBranchTarget, setRenameBranchTarget] = useState('');
  const [newCollaborator, setNewCollaborator] = useState('');
  const [newPermission, setNewPermission] = useState<Permission>('write');
  const [topicInput, setTopicInput] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [hookSecret, setHookSecret] = useState('');
  const [hookEvents, setHookEvents] = useState('push,pull_request,issues');
  const [deployKeyTitle, setDeployKeyTitle] = useState('');
  const [deployKeyValue, setDeployKeyValue] = useState('');
  const [deployKeyReadOnly, setDeployKeyReadOnly] = useState(true);
  const [mirrorRemoteAddress, setMirrorRemoteAddress] = useState('');
  const [mirrorUsername, setMirrorUsername] = useState('');
  const [mirrorPassword, setMirrorPassword] = useState('');
  const [mirrorInterval, setMirrorInterval] = useState('8h0m0s');
  const [mirrorSyncOnCommit, setMirrorSyncOnCommit] = useState(true);
  const [protectionBranch, setProtectionBranch] = useState(repository.default_branch);
  const [requiredApprovals, setRequiredApprovals] = useState('1');
  const [requireSignedCommits, setRequireSignedCommits] = useState(false);
  const [blockRejectedReviews, setBlockRejectedReviews] = useState(true);
  const [transferOwner, setTransferOwner] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [variableName, setVariableName] = useState('');
  const [variableValue, setVariableValue] = useState('');
  const [variableDescription, setVariableDescription] = useState('');
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretDescription, setSecretDescription] = useState('');
  const [workflowDispatchRef, setWorkflowDispatchRef] = useState(repository.default_branch);
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
    setRenameBranchSource(repository.default_branch);
    setProtectionBranch(repository.default_branch);
    setWorkflowDispatchRef(repository.default_branch);
  }, [repository]);

  useEffect(() => {
    loadSettingsData();
  }, [owner, repo]);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [branchData, collaboratorData, hookData, deployKeyData, pushMirrorData, protectionData, topicData, variableData, secretData, artifactData, workflowData, runnerData, taskData] = await Promise.all([
        gitea.getBranches(owner, repo),
        gitea.getCollaborators(owner, repo),
        gitea.getRepositoryHooks(owner, repo),
        gitea.getDeployKeys(owner, repo),
        gitea.getPushMirrors(owner, repo),
        gitea.getBranchProtections(owner, repo),
        gitea.getRepositoryTopics(owner, repo),
        gitea.getRepositoryActionVariables(owner, repo, { limit: 100 }),
        gitea.getRepositoryActionSecrets(owner, repo, { limit: 100 }),
        gitea.getRepositoryActionArtifacts(owner, repo),
        gitea.getRepositoryActionWorkflows(owner, repo),
        gitea.getRepositoryActionRunners(owner, repo),
        gitea.getRepositoryActionTasks(owner, repo, { limit: 50 }),
      ]);
      setBranches(branchData);
      setCollaborators(collaboratorData);
      setHooks(hookData);
      setDeployKeys(deployKeyData);
      setPushMirrors(pushMirrorData);
      setBranchProtections(protectionData);
      setTopics(topicData.topics || []);
      setActionVariables(variableData);
      setActionSecrets(secretData);
      setActionArtifacts(artifactData.artifacts || []);
      setActionWorkflows(workflowData.workflows || []);
      setActionRunners(runnerData.runners || []);
      setActionTasks(taskData.workflow_runs || []);
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

  const handleRenameBranch = async () => {
    if (!renameBranchSource.trim() || !renameBranchTarget.trim()) return;
    setSaving(true);
    try {
      await gitea.renameBranch(owner, repo, renameBranchSource, renameBranchTarget.trim());
      const data = await gitea.getBranches(owner, repo);
      setBranches(data);
      if (defaultBranch === renameBranchSource) setDefaultBranch(renameBranchTarget.trim());
      if (sourceBranch === renameBranchSource) setSourceBranch(renameBranchTarget.trim());
      setRenameBranchSource(renameBranchTarget.trim());
      setRenameBranchTarget('');
    } catch (error) {
      console.error('Failed to rename branch:', error);
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

  const handleCreatePushMirror = async () => {
    if (!mirrorRemoteAddress.trim()) return;
    setSaving(true);
    try {
      const mirror = await gitea.createPushMirror(owner, repo, {
        remote_address: mirrorRemoteAddress.trim(),
        remote_username: mirrorUsername.trim() || undefined,
        remote_password: mirrorPassword || undefined,
        interval: mirrorInterval.trim() || undefined,
        sync_on_commit: mirrorSyncOnCommit,
      });
      setPushMirrors([...pushMirrors, mirror]);
      setMirrorRemoteAddress('');
      setMirrorUsername('');
      setMirrorPassword('');
    } catch (error) {
      console.error('Failed to create push mirror:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePushMirror = async (mirror: PushMirror) => {
    setSaving(true);
    try {
      await gitea.deletePushMirror(owner, repo, mirror.remote_name);
      setPushMirrors(pushMirrors.filter((item) => item.remote_name !== mirror.remote_name));
    } catch (error) {
      console.error('Failed to delete push mirror:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPushMirrors = async () => {
    setSaving(true);
    try {
      await gitea.syncPushMirrors(owner, repo);
      const mirrors = await gitea.getPushMirrors(owner, repo);
      setPushMirrors(mirrors);
    } catch (error) {
      console.error('Failed to sync push mirrors:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPullMirror = async () => {
    setSaving(true);
    try {
      await gitea.syncMirror(owner, repo);
    } catch (error) {
      console.error('Failed to sync mirrored repository:', error);
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

  const handleCreateActionVariable = async () => {
    if (!variableName.trim() || !variableValue.trim()) return;
    setSaving(true);
    try {
      await gitea.createRepositoryActionVariable(owner, repo, variableName.trim(), {
        value: variableValue,
        description: variableDescription.trim() || undefined,
      });
      const data = await gitea.getRepositoryActionVariables(owner, repo, { limit: 100 });
      setActionVariables(data);
      setVariableName('');
      setVariableValue('');
      setVariableDescription('');
    } catch (error) {
      console.error('Failed to create repository action variable:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActionVariable = async (name: string) => {
    setSaving(true);
    try {
      await gitea.deleteRepositoryActionVariable(owner, repo, name);
      setActionVariables(actionVariables.filter((item) => item.name !== name));
    } catch (error) {
      console.error('Failed to delete repository action variable:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateActionSecret = async () => {
    if (!secretName.trim() || !secretValue.trim()) return;
    setSaving(true);
    try {
      await gitea.createOrUpdateRepositoryActionSecret(owner, repo, secretName.trim(), {
        data: secretValue,
        description: secretDescription.trim() || undefined,
      });
      const data = await gitea.getRepositoryActionSecrets(owner, repo, { limit: 100 });
      setActionSecrets(data);
      setSecretName('');
      setSecretValue('');
      setSecretDescription('');
    } catch (error) {
      console.error('Failed to save repository action secret:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActionSecret = async (name: string) => {
    setSaving(true);
    try {
      await gitea.deleteRepositoryActionSecret(owner, repo, name);
      setActionSecrets(actionSecrets.filter((item) => item.name !== name));
    } catch (error) {
      console.error('Failed to delete repository action secret:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWorkflow = async (workflow: ActionWorkflow) => {
    setSaving(true);
    try {
      if (workflow.state === 'active') {
        await gitea.disableRepositoryActionWorkflow(owner, repo, workflow.id);
      } else {
        await gitea.enableRepositoryActionWorkflow(owner, repo, workflow.id);
      }
      const data = await gitea.getRepositoryActionWorkflows(owner, repo);
      setActionWorkflows(data.workflows || []);
    } catch (error) {
      console.error('Failed to toggle workflow state:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDispatchWorkflow = async (workflow: ActionWorkflow) => {
    if (!workflowDispatchRef.trim()) return;
    setSaving(true);
    try {
      await gitea.dispatchRepositoryActionWorkflow(owner, repo, workflow.id, { ref: workflowDispatchRef.trim() });
    } catch (error) {
      console.error('Failed to dispatch workflow:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRunnerToken = async () => {
    setSaving(true);
    try {
      const response = await gitea.createRepositoryActionRunnerRegistrationToken(owner, repo);
      setRunnerRegistrationToken(response.token);
    } catch (error) {
      console.error('Failed to create repository runner registration token:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRunner = async (runner: AdminActionRunner) => {
    setSaving(true);
    try {
      await gitea.deleteRepositoryActionRunner(owner, repo, runner.id);
      setActionRunners(actionRunners.filter((item) => String(item.id) !== String(runner.id)));
    } catch (error) {
      console.error('Failed to delete repository runner:', error);
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
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rename branch</div>
              {branchPicker(renameBranchSource, setRenameBranchSource)}
              <Input value={renameBranchTarget} onChange={(event) => setRenameBranchTarget(event.target.value)} placeholder="new-branch-name" className="h-10 border-slate-200 font-mono text-xs" />
              <Button onClick={handleRenameBranch} disabled={!renameBranchSource.trim() || !renameBranchTarget.trim() || saving} variant="outline" className="w-full border-slate-200 text-slate-700">
                Rename Branch
              </Button>
            </div>
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
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Push mirrors</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSyncPushMirrors} disabled={saving || pushMirrors.length === 0} className="h-8 border-slate-200 text-slate-600">
                Sync all
              </Button>
            </div>
            <div className="divide-y divide-slate-100">
              {pushMirrors.map((mirror) => (
                <div key={mirror.remote_name} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{mirror.remote_name}</span>
                      {mirror.sync_on_commit && <Badge variant="outline" className="border-sky-100 text-sky-700 text-[10px]">Push sync</Badge>}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{mirror.remote_address}</div>
                    {mirror.last_error && <div className="mt-1 text-xs text-red-500 truncate">{mirror.last_error}</div>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={saving}
                    onClick={() => handleDeletePushMirror(mirror)}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {pushMirrors.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">No push mirrors configured</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Add mirror</span>
            </div>
            <Input value={mirrorRemoteAddress} onChange={(event) => setMirrorRemoteAddress(event.target.value)} placeholder="https://example.com/owner/repo.git" className="h-10 border-slate-200 text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={mirrorUsername} onChange={(event) => setMirrorUsername(event.target.value)} placeholder="Username" className="h-10 border-slate-200 text-xs" />
              <Input value={mirrorPassword} onChange={(event) => setMirrorPassword(event.target.value)} placeholder="Password/token" type="password" className="h-10 border-slate-200 text-xs" />
            </div>
            <Input value={mirrorInterval} onChange={(event) => setMirrorInterval(event.target.value)} placeholder="8h0m0s" className="h-10 border-slate-200 text-xs" />
            {toggleButton(mirrorSyncOnCommit, () => setMirrorSyncOnCommit(!mirrorSyncOnCommit), <RefreshCw className="w-3.5 h-3.5 mr-2" />, 'Sync on commit')}
            <Button onClick={handleCreatePushMirror} disabled={!mirrorRemoteAddress.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
              <Plus className="w-3.5 h-3.5 mr-2" /> Add Push Mirror
            </Button>
            <Button variant="outline" onClick={handleSyncPullMirror} disabled={saving} className="w-full border-slate-200 text-slate-700">
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Sync Pull Mirror
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

        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Workflow className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Actions variables</span>
              </div>
              <div className="divide-y divide-slate-100">
                {actionVariables.map((variable) => (
                  <div key={variable.name} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{variable.name}</div>
                      <div className="text-xs text-slate-400 truncate">{variable.description || 'No description'}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() => handleDeleteActionVariable(variable.name)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {actionVariables.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No actions variables configured</div>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Actions secrets</span>
              </div>
              <div className="divide-y divide-slate-100">
                {actionSecrets.map((secret) => (
                  <div key={secret.name} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{secret.name}</div>
                      <div className="text-xs text-slate-400 truncate">{secret.description || 'Secret value hidden'}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      onClick={() => handleDeleteActionSecret(secret.name)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {actionSecrets.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No actions secrets configured</div>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Workflow className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Workflows</span>
              </div>
              <div className="divide-y divide-slate-100">
                {actionWorkflows.map((workflow) => (
                  <div key={workflow.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{workflow.name || workflow.id}</span>
                        <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px] uppercase">{workflow.state || 'unknown'}</Badge>
                      </div>
                      <div className="text-xs text-slate-400 truncate">{workflow.path || workflow.badge_url || 'No path reported'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={saving || !workflowDispatchRef.trim()} onClick={() => handleDispatchWorkflow(workflow)} className="h-8 border-slate-200 text-slate-600">
                        Run
                      </Button>
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => handleToggleWorkflow(workflow)} className="h-8 border-slate-200 text-slate-600">
                        {workflow.state === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                ))}
                {actionWorkflows.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No workflows discovered</div>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Artifacts</span>
              </div>
              <div className="divide-y divide-slate-100">
                {actionArtifacts.map((artifact) => (
                  <div key={artifact.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{artifact.name}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {(artifact.size_in_bytes || 0).toLocaleString()} bytes
                          {artifact.workflow_run?.id ? ` · run #${artifact.workflow_run.id}` : ''}
                          {artifact.expired ? ' · expired' : ''}
                        </div>
                      </div>
                      {artifact.archive_download_url && (
                        <a href={artifact.archive_download_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-sky-700 hover:text-sky-800">
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {actionArtifacts.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No artifacts found</div>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Workflow className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Action tasks</span>
              </div>
              <div className="divide-y divide-slate-100">
                {actionTasks.map((task) => (
                  <div key={task.id} className="px-5 py-4">
                    <div className="text-sm font-bold text-slate-900 truncate">{task.display_title || task.name || `Run #${task.id}`}</div>
                    <div className="mt-1 text-xs text-slate-500">{task.status || 'unknown'} {task.event ? `· ${task.event}` : ''}</div>
                    <div className="mt-1 text-[10px] text-slate-400 truncate">{task.head_branch || 'no branch'} · {task.head_sha?.slice(0, 12) || 'no sha'}</div>
                  </div>
                ))}
                {actionTasks.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No action tasks found</div>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">New variable</span>
              </div>
              <Input value={variableName} onChange={(event) => setVariableName(event.target.value)} placeholder="VARIABLE_NAME" className="h-10 border-slate-200 font-mono text-xs" />
              <Input value={variableDescription} onChange={(event) => setVariableDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200 text-xs" />
              <textarea
                value={variableValue}
                onChange={(event) => setVariableValue(event.target.value)}
                placeholder="Variable value"
                className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
              />
              <Button onClick={handleCreateActionVariable} disabled={!variableName.trim() || !variableValue.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
                <Plus className="w-3.5 h-3.5 mr-2" /> Save Variable
              </Button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">New secret</span>
              </div>
              <Input value={secretName} onChange={(event) => setSecretName(event.target.value)} placeholder="SECRET_NAME" className="h-10 border-slate-200 font-mono text-xs" />
              <Input value={secretDescription} onChange={(event) => setSecretDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200 text-xs" />
              <textarea
                value={secretValue}
                onChange={(event) => setSecretValue(event.target.value)}
                placeholder="Secret value"
                className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
              />
              <Button onClick={handleCreateActionSecret} disabled={!secretName.trim() || !secretValue.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
                <Plus className="w-3.5 h-3.5 mr-2" /> Save Secret
              </Button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Workflow dispatch</span>
              </div>
              {branchPicker(workflowDispatchRef, setWorkflowDispatchRef)}
              <div className="text-xs text-slate-400">Pick the ref used when manually dispatching repository workflows.</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Repository runners</span>
              </div>
              <Button onClick={handleCreateRunnerToken} disabled={saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
                <Plus className="w-3.5 h-3.5 mr-2" /> New runner token
              </Button>
              {runnerRegistrationToken && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 font-mono text-xs text-green-900 break-all">{runnerRegistrationToken}</div>
              )}
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {actionRunners.map((runner) => (
                  <div key={String(runner.id)} className="px-3 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{runner.name || `Runner ${runner.id}`}</div>
                      <div className="text-xs text-slate-400 truncate">{runner.os || 'unknown'} / {runner.arch || 'unknown'} · {runner.status || 'idle'}</div>
                    </div>
                    <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteRunner(runner)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {actionRunners.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No repository runners configured</div>}
              </div>
            </div>
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
