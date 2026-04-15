import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, ChevronDown, FolderPlus, Plus, Save, Settings2, Tag, Trash2, UserPlus, Users, Webhook } from 'lucide-react';
import { GiteaService, GiteaUser, Hook, Label, Organization, Repository, Team } from '@/src/lib/gitea';
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

interface OrganizationManagerProps {
  gitea: GiteaService;
  organization: Organization | null;
  repositories: Repository[];
  loading: boolean;
  onOrganizationUpdate: (organization: Organization) => void;
  onOrganizationDelete: (organization: Organization) => void;
  onRepositoriesUpdate: (repositories: Repository[]) => void;
}

type TeamPermission = 'read' | 'write' | 'admin';

export function OrganizationManager({
  gitea,
  organization,
  repositories,
  loading,
  onOrganizationUpdate,
  onOrganizationDelete,
  onRepositoriesUpdate,
}: OrganizationManagerProps) {
  const [members, setMembers] = useState<GiteaUser[]>([]);
  const [publicMembers, setPublicMembers] = useState<GiteaUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<GiteaUser[]>([]);
  const [teamRepos, setTeamRepos] = useState<Repository[]>([]);
  const [orgFullName, setOrgFullName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgVisibility, setOrgVisibility] = useState<'public' | 'limited' | 'private'>('public');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamPermission, setTeamPermission] = useState<TeamPermission>('write');
  const [teamCanCreateRepo, setTeamCanCreateRepo] = useState(false);
  const [teamIncludesAllRepos, setTeamIncludesAllRepos] = useState(false);
  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [selectedTeamDescription, setSelectedTeamDescription] = useState('');
  const [selectedTeamPermission, setSelectedTeamPermission] = useState<TeamPermission>('write');
  const [selectedTeamCanCreateRepo, setSelectedTeamCanCreateRepo] = useState(false);
  const [selectedTeamIncludesAllRepos, setSelectedTeamIncludesAllRepos] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('0ea5e9');
  const [labelDescription, setLabelDescription] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [hookSecret, setHookSecret] = useState('');
  const [hookEvents, setHookEvents] = useState('push,pull_request,issues');
  const [memberName, setMemberName] = useState('');
  const [repoName, setRepoName] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [newRepoAutoInit, setNewRepoAutoInit] = useState(true);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!organization) return;
    setOrgFullName(organization.full_name || '');
    setOrgDescription(organization.description || '');
    setOrgWebsite(organization.website || '');
    setOrgVisibility((organization.visibility as 'public' | 'limited' | 'private') || 'public');
    loadOrganizationDetails(organization.username);
  }, [organization?.username]);

  const loadOrganizationDetails = async (org: string) => {
    setLoadingDetails(true);
    try {
      const [memberData, publicMemberData, teamData, labelData, hookData] = await Promise.all([
        gitea.getOrganizationMembers(org),
        gitea.getOrganizationPublicMembers(org),
        gitea.getOrganizationTeams(org),
        gitea.getOrganizationLabels(org),
        gitea.getOrganizationHooks(org),
      ]);
      setMembers(memberData);
      setPublicMembers(publicMemberData);
      setTeams(teamData);
      setLabels(labelData);
      setHooks(hookData);
      if (teamData.length > 0) loadTeam(teamData[0]);
      else {
        setSelectedTeam(null);
        setTeamMembers([]);
        setTeamRepos([]);
      }
    } catch (error) {
      console.error('Failed to load organization details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadTeam = async (team: Team) => {
    setSelectedTeam(team);
    setSelectedTeamName(team.name);
    setSelectedTeamDescription(team.description || '');
    setSelectedTeamPermission((team.permission === 'owner' || team.permission === 'none' ? 'read' : team.permission) as TeamPermission);
    setSelectedTeamCanCreateRepo(!!team.can_create_org_repo);
    setSelectedTeamIncludesAllRepos(!!team.includes_all_repositories);
    try {
      const [memberData, repoData] = await Promise.all([
        gitea.getTeamMembers(team.id),
        gitea.getTeamRepositories(team.id),
      ]);
      setTeamMembers(memberData);
      setTeamRepos(repoData);
    } catch (error) {
      console.error('Failed to load team:', error);
      setTeamMembers([]);
      setTeamRepos([]);
    }
  };

  const handleSaveOrganization = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      const updated = await gitea.updateOrganization(organization.username, {
        full_name: orgFullName,
        description: orgDescription,
        website: orgWebsite,
        visibility: orgVisibility,
      });
      onOrganizationUpdate(updated);
    } catch (error) {
      console.error('Failed to update organization:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!organization || !teamName.trim()) return;
    setSaving(true);
    try {
      const team = await gitea.createOrganizationTeam(organization.username, {
        name: teamName.trim(),
        description: teamDescription,
        permission: teamPermission,
        can_create_org_repo: teamCanCreateRepo,
        includes_all_repositories: teamIncludesAllRepos,
      });
      setTeams([...teams, team]);
      setTeamName('');
      setTeamDescription('');
      setTeamCanCreateRepo(false);
      setTeamIncludesAllRepos(false);
      loadTeam(team);
    } catch (error) {
      console.error('Failed to create team:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    setSaving(true);
    try {
      await gitea.deleteTeam(team.id);
      const nextTeams = teams.filter((item) => item.id !== team.id);
      setTeams(nextTeams);
      if (selectedTeam?.id === team.id) {
        if (nextTeams[0]) loadTeam(nextTeams[0]);
        else {
          setSelectedTeam(null);
          setTeamMembers([]);
          setTeamRepos([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSelectedTeam = async () => {
    if (!selectedTeam || !selectedTeamName.trim()) return;
    setSaving(true);
    try {
      const updated = await gitea.updateTeam(selectedTeam.id, {
        name: selectedTeamName.trim(),
        description: selectedTeamDescription,
        permission: selectedTeamPermission,
        can_create_org_repo: selectedTeamCanCreateRepo,
        includes_all_repositories: selectedTeamIncludesAllRepos,
      });
      setSelectedTeam(updated);
      setTeams(teams.map((team) => team.id === updated.id ? updated : team));
    } catch (error) {
      console.error('Failed to update team:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeamMember = async () => {
    if (!selectedTeam || !memberName.trim()) return;
    setSaving(true);
    try {
      await gitea.addTeamMember(selectedTeam.id, memberName.trim());
      const data = await gitea.getTeamMembers(selectedTeam.id);
      setTeamMembers(data);
      setMemberName('');
    } catch (error) {
      console.error('Failed to add team member:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTeamMember = async (username: string) => {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await gitea.removeTeamMember(selectedTeam.id, username);
      setTeamMembers(teamMembers.filter((item) => (item.login || item.username) !== username));
    } catch (error) {
      console.error('Failed to remove team member:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeamRepo = async () => {
    if (!organization || !selectedTeam || !repoName.trim()) return;
    setSaving(true);
    try {
      await gitea.addTeamRepository(selectedTeam.id, organization.username, repoName.trim());
      const data = await gitea.getTeamRepositories(selectedTeam.id);
      setTeamRepos(data);
      setRepoName('');
    } catch (error) {
      console.error('Failed to add team repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTeamRepo = async (repo: Repository) => {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await gitea.removeTeamRepository(selectedTeam.id, repo.owner.login, repo.name);
      setTeamRepos(teamRepos.filter((item) => item.id !== repo.id));
    } catch (error) {
      console.error('Failed to remove team repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrgRepo = async () => {
    if (!organization || !newRepoName.trim()) return;
    setSaving(true);
    try {
      const repo = await gitea.createOrganizationRepository(organization.username, {
        name: newRepoName.trim(),
        description: newRepoDescription,
        private: newRepoPrivate,
        auto_init: newRepoAutoInit,
      });
      onRepositoriesUpdate([repo, ...repositories]);
      setNewRepoName('');
      setNewRepoDescription('');
      setNewRepoPrivate(false);
      setNewRepoAutoInit(true);
    } catch (error) {
      console.error('Failed to create organization repository:', error);
    } finally {
      setSaving(false);
    }
  };

  const togglePublicMember = async (member: GiteaUser) => {
    if (!organization) return;
    const login = member.login || member.username || '';
    const isPublic = publicMembers.some((item) => (item.login || item.username) === login);
    setSaving(true);
    try {
      if (isPublic) await gitea.concealOrganizationMembership(organization.username, login);
      else await gitea.publicizeOrganizationMembership(organization.username, login);
      const data = await gitea.getOrganizationPublicMembers(organization.username);
      setPublicMembers(data);
    } catch (error) {
      console.error('Failed to update public membership:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOrgMember = async (member: GiteaUser) => {
    if (!organization) return;
    const login = member.login || member.username || '';
    setSaving(true);
    try {
      await gitea.removeOrganizationMember(organization.username, login);
      setMembers(members.filter((item) => (item.login || item.username) !== login));
      setPublicMembers(publicMembers.filter((item) => (item.login || item.username) !== login));
    } catch (error) {
      console.error('Failed to remove organization member:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!organization || !labelName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: labelName.trim(),
        color: labelColor.replace('#', ''),
        description: labelDescription,
      };
      const label = editingLabel
        ? await gitea.updateOrganizationLabel(organization.username, editingLabel.id, payload)
        : await gitea.createOrganizationLabel(organization.username, payload);
      setLabels(editingLabel ? labels.map((item) => item.id === label.id ? label : item) : [...labels, label]);
      setLabelName('');
      setLabelDescription('');
      setLabelColor('0ea5e9');
      setEditingLabel(null);
    } catch (error) {
      console.error('Failed to create organization label:', error);
    } finally {
      setSaving(false);
    }
  };

  const startEditLabel = (label: Label) => {
    setEditingLabel(label);
    setLabelName(label.name);
    setLabelColor(label.color);
    setLabelDescription(label.description || '');
  };

  const cancelEditLabel = () => {
    setEditingLabel(null);
    setLabelName('');
    setLabelDescription('');
    setLabelColor('0ea5e9');
  };

  const handleDeleteLabel = async (id: number) => {
    if (!organization) return;
    setSaving(true);
    try {
      await gitea.deleteOrganizationLabel(organization.username, id);
      setLabels(labels.filter((label) => label.id !== id));
    } catch (error) {
      console.error('Failed to delete organization label:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateHook = async () => {
    if (!organization || !hookUrl.trim()) return;
    setSaving(true);
    try {
      const hook = await gitea.createOrganizationHook(organization.username, {
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
      console.error('Failed to create organization webhook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHook = async (hook: Hook) => {
    if (!organization) return;
    setSaving(true);
    try {
      const updated = await gitea.updateOrganizationHook(organization.username, hook.id, { active: !hook.active });
      setHooks(hooks.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      console.error('Failed to update organization webhook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHook = async (id: number) => {
    if (!organization) return;
    setSaving(true);
    try {
      await gitea.deleteOrganizationHook(organization.username, id);
      setHooks(hooks.filter((hook) => hook.id !== id));
    } catch (error) {
      console.error('Failed to delete organization webhook:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organization || deleteConfirmation !== organization.username) return;
    setSaving(true);
    try {
      await gitea.deleteOrganization(organization.username);
      onOrganizationDelete(organization);
    } catch (error) {
      console.error('Failed to delete organization:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!organization) {
    return (
      <div className="h-full min-h-[420px] flex items-center justify-center text-center text-slate-400">
        <div>
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <div className="text-sm font-medium">Select an organization to manage it</div>
        </div>
      </div>
    );
  }

  if (loading || loadingDetails) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
        <img src={organization.avatar_url} alt="" className="w-14 h-14 rounded-xl border border-slate-200" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{organization.full_name || organization.username}</h2>
          <p className="text-sm text-slate-500">{organization.description || 'No organization description.'}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Settings2 className="w-4 h-4 text-slate-500" /> Organization settings
            </div>
            <Button onClick={handleSaveOrganization} disabled={saving} className="h-8 bg-slate-900 text-white hover:bg-slate-800">
              <Save className="w-3.5 h-3.5 mr-2" /> Save
            </Button>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Input value={orgFullName} onChange={(event) => setOrgFullName(event.target.value)} placeholder="Full name" className="h-10 border-slate-200" />
            <Input value={orgWebsite} onChange={(event) => setOrgWebsite(event.target.value)} placeholder="Website" className="h-10 border-slate-200" />
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="outline" className="h-10 justify-between border-slate-200 bg-white capitalize">
                  {orgVisibility}
                  <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </Button>
              } />
              <DropdownMenuContent align="start" className="bg-white">
                {(['public', 'limited', 'private'] as const).map((visibility) => (
                  <DropdownMenuItem key={visibility} onClick={() => setOrgVisibility(visibility)} className="text-xs capitalize">
                    {visibility}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Input value={orgDescription} onChange={(event) => setOrgDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3 h-fit">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FolderPlus className="w-4 h-4 text-slate-500" /> New repository
          </div>
          <Input value={newRepoName} onChange={(event) => setNewRepoName(event.target.value)} placeholder="repo-name" className="h-10 border-slate-200 font-mono text-xs" />
          <Input value={newRepoDescription} onChange={(event) => setNewRepoDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewRepoPrivate(!newRepoPrivate)}
              className={`h-9 border-slate-200 text-xs ${newRepoPrivate ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'}`}
            >
              {newRepoPrivate ? <Check className="w-3.5 h-3.5 mr-2" /> : null}
              Private
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewRepoAutoInit(!newRepoAutoInit)}
              className={`h-9 border-slate-200 text-xs ${newRepoAutoInit ? 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100' : 'text-slate-600'}`}
            >
              {newRepoAutoInit ? <Check className="w-3.5 h-3.5 mr-2" /> : null}
              Initialize
            </Button>
          </div>
          <Button onClick={handleCreateOrgRepo} disabled={!newRepoName.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
            <Plus className="w-3.5 h-3.5 mr-2" /> Create Repository
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Users className="w-4 h-4 text-slate-500" /> Members
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const login = member.login || member.username || '';
              const isPublic = publicMembers.some((item) => (item.login || item.username) === login);
              return (
                <div key={member.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{member.full_name || login}</div>
                      <div className="text-xs text-slate-400">@{login}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => togglePublicMember(member)} disabled={saving} className="h-8 text-slate-600">
                    {isPublic ? <Check className="w-3.5 h-3.5 mr-2" /> : null}
                    Public
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveOrgMember(member)} disabled={saving} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Plus className="w-4 h-4 text-slate-500" /> Create team
          </div>
          <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" className="h-10 border-slate-200" />
          <Input value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200" />
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" className="w-full h-10 justify-between border-slate-200 bg-white capitalize">
                {teamPermission}
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
              </Button>
            } />
            <DropdownMenuContent align="start" className="bg-white">
              {(['read', 'write', 'admin'] as TeamPermission[]).map((permission) => (
                <DropdownMenuItem key={permission} onClick={() => setTeamPermission(permission)} className="text-xs capitalize">
                  {permission}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTeamCanCreateRepo(!teamCanCreateRepo)}
              className={`h-9 border-slate-200 text-xs ${teamCanCreateRepo ? 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100' : 'text-slate-600'}`}
            >
              {teamCanCreateRepo ? <Check className="w-3.5 h-3.5 mr-2" /> : null}
              Create repos
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTeamIncludesAllRepos(!teamIncludesAllRepos)}
              className={`h-9 border-slate-200 text-xs ${teamIncludesAllRepos ? 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100' : 'text-slate-600'}`}
            >
              {teamIncludesAllRepos ? <Check className="w-3.5 h-3.5 mr-2" /> : null}
              All repos
            </Button>
          </div>
          <Button onClick={handleCreateTeam} disabled={!teamName.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
            Create Team
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Tag className="w-4 h-4 text-slate-500" /> Organization labels
          </div>
          <div className="p-5 grid grid-cols-[1fr_120px] gap-3 border-b border-slate-100">
            <Input value={labelName} onChange={(event) => setLabelName(event.target.value)} placeholder="Label name" className="h-9 border-slate-200 text-xs" />
            <Input value={labelColor} onChange={(event) => setLabelColor(event.target.value.replace('#', ''))} placeholder="0ea5e9" className="h-9 border-slate-200 font-mono text-xs" />
            <Input value={labelDescription} onChange={(event) => setLabelDescription(event.target.value)} placeholder="Description" className="h-9 border-slate-200 text-xs" />
            <Button onClick={handleCreateLabel} disabled={!labelName.trim() || saving} className="h-9 bg-sky-600 text-white hover:bg-sky-700">
              <Plus className="w-3.5 h-3.5 mr-2" /> {editingLabel ? 'Save' : 'Add'}
            </Button>
            {editingLabel && (
              <Button variant="outline" onClick={cancelEditLabel} className="h-9 border-slate-200 text-slate-600">
                Cancel
              </Button>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {labels.map((label) => (
              <div key={label.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <Badge style={{ backgroundColor: `#${label.color}`, color: '#fff' }} className="border-none text-[10px]">
                    {label.name}
                  </Badge>
                  <span className="text-xs text-slate-400 truncate">{label.description}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEditLabel(label)} disabled={saving} className="h-8 w-8 text-slate-400 hover:text-sky-600 hover:bg-sky-50">
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteLabel(label.id)} disabled={saving} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {labels.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No organization labels</div>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Webhook className="w-4 h-4 text-slate-500" /> Organization webhooks
          </div>
          <div className="p-5 space-y-3 border-b border-slate-100">
            <Input value={hookUrl} onChange={(event) => setHookUrl(event.target.value)} placeholder="https://example.com/webhook" className="h-9 border-slate-200 text-xs" />
            <div className="grid grid-cols-[1fr_1fr_90px] gap-3">
              <Input value={hookEvents} onChange={(event) => setHookEvents(event.target.value)} placeholder="push,issues" className="h-9 border-slate-200 text-xs" />
              <Input value={hookSecret} onChange={(event) => setHookSecret(event.target.value)} placeholder="Secret" className="h-9 border-slate-200 text-xs" />
              <Button onClick={handleCreateHook} disabled={!hookUrl.trim() || saving} className="h-9 bg-sky-600 text-white hover:bg-sky-700">
                Add
              </Button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {hooks.map((hook) => (
              <div key={hook.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{hook.config?.url || hook.type}</div>
                  <div className="text-xs text-slate-400 truncate">{hook.events?.join(', ') || 'No events configured'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleHook(hook)} disabled={saving} className="h-8 border-slate-200 text-slate-600">
                    {hook.active ? 'Active' : 'Inactive'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteHook(hook.id)} disabled={saving} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {hooks.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No organization webhooks</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-fit">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">Teams</div>
          <div className="divide-y divide-slate-100">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => loadTeam(team)}
                className={`w-full px-5 py-3 text-left hover:bg-slate-50 ${selectedTeam?.id === team.id ? 'bg-sky-50' : ''}`}
              >
                <div className="text-sm font-bold text-slate-900">{team.name}</div>
                <div className="text-xs text-slate-400 capitalize">{team.permission}</div>
              </button>
            ))}
            {teams.length === 0 && <div className="p-6 text-sm text-slate-400 text-center">No teams yet</div>}
          </div>
        </div>

        {selectedTeam ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{selectedTeam.name}</div>
                <div className="text-xs text-slate-400">{selectedTeam.description || 'No description'}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteTeam(selectedTeam)} disabled={saving} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-4 border-b border-slate-100 grid grid-cols-[1fr_1fr_130px_90px] gap-3">
              <Input value={selectedTeamName} onChange={(event) => setSelectedTeamName(event.target.value)} placeholder="Team name" className="h-8 border-slate-200 text-xs" />
              <Input value={selectedTeamDescription} onChange={(event) => setSelectedTeamDescription(event.target.value)} placeholder="Description" className="h-8 border-slate-200 text-xs" />
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-8 justify-between border-slate-200 bg-white capitalize text-xs">
                    {selectedTeamPermission}
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  </Button>
                } />
                <DropdownMenuContent align="start" className="bg-white">
                  {(['read', 'write', 'admin'] as TeamPermission[]).map((permission) => (
                    <DropdownMenuItem key={permission} onClick={() => setSelectedTeamPermission(permission)} className="text-xs capitalize">
                      {permission}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleUpdateSelectedTeam} disabled={!selectedTeamName.trim() || saving} className="h-8 bg-slate-900 text-white hover:bg-slate-800">
                <Save className="w-3.5 h-3.5 mr-2" /> Save
              </Button>
              <div className="col-span-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTeamCanCreateRepo(!selectedTeamCanCreateRepo)}
                  className={`h-8 border-slate-200 text-xs ${selectedTeamCanCreateRepo ? 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100' : 'text-slate-600'}`}
                >
                  {selectedTeamCanCreateRepo ? <Check className="w-3.5 h-3.5 mr-2" /> : null}
                  Can create organization repositories
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTeamIncludesAllRepos(!selectedTeamIncludesAllRepos)}
                  className={`h-8 border-slate-200 text-xs ${selectedTeamIncludesAllRepos ? 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100' : 'text-slate-600'}`}
                >
                  {selectedTeamIncludesAllRepos ? <Check className="w-3.5 h-3.5 mr-2" /> : null}
                  Includes all repositories
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div>
                <div className="p-4 border-b border-slate-100 flex gap-2">
                  <Input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="username" className="h-8 border-slate-200 text-xs" />
                  <Button onClick={handleAddTeamMember} disabled={!memberName.trim() || saving} className="h-8 bg-sky-600 text-white hover:bg-sky-700">
                    <UserPlus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="divide-y divide-slate-100">
                  {teamMembers.map((member) => {
                    const login = member.login || member.username || '';
                    return (
                      <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-700 truncate">@{login}</span>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveTeamMember(login)} disabled={saving} className="h-7 w-7 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="p-4 border-b border-slate-100 flex gap-2">
                  <Input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="repo name" className="h-8 border-slate-200 text-xs" />
                  <Button onClick={handleAddTeamRepo} disabled={!repoName.trim() || saving} className="h-8 bg-sky-600 text-white hover:bg-sky-700">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="divide-y divide-slate-100">
                  {teamRepos.map((repo) => (
                    <div key={repo.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <Link to={`/repo/${repo.owner.login}/${repo.name}`} className="text-sm font-medium text-sky-700 truncate">{repo.name}</Link>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveTeamRepo(repo)} disabled={saving} className="h-7 w-7 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400">Select a team to manage members and repositories</div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">Repositories</div>
        <div className="divide-y divide-slate-100">
          {repositories.map((repo) => (
            <Link key={repo.id} to={`/repo/${repo.owner.login}/${repo.name}`} className="block px-5 py-3 hover:bg-slate-50">
              <div className="text-sm font-bold text-slate-900">{repo.full_name}</div>
              <div className="text-xs text-slate-500">{repo.description || 'No description provided.'}</div>
            </Link>
          ))}
          {repositories.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No repositories visible</div>}
        </div>
      </div>

      <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-red-50 border-b border-red-100 text-sm font-bold text-red-700">Danger zone</div>
        <div className="p-5 grid grid-cols-[1fr_220px] gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Type {organization.username} to delete this organization</label>
            <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="h-10 border-red-100 focus-visible:ring-red-400" />
          </div>
          <Button
            variant="outline"
            onClick={handleDeleteOrganization}
            disabled={deleteConfirmation !== organization.username || saving}
            className="h-10 border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Organization
          </Button>
        </div>
      </div>
    </div>
  );
}
