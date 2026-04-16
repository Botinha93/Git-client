import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  ExternalLink,
  EyeOff,
  Folder,
  GitCommit,
  KeyRound,
  LockKeyhole,
  Mail,
  Pin,
  Plus,
  Save,
  Settings,
  Star,
  Timer,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  ActionSecret,
  ActionVariable,
  AccessToken,
  EmailAddress,
  GiteaService,
  GiteaUser,
  GpgKey,
  NotificationThread,
  OAuth2Application,
  PublicKey,
  Repository,
  Stopwatch,
} from '@/src/lib/gitea';
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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AccountViewProps {
  gitea: GiteaService;
  user: GiteaUser;
  onUserUpdate: (user: GiteaUser) => void;
}

function threadTarget(thread: NotificationThread) {
  const repo = thread.repository;
  const match = thread.subject.url.match(/\/issues\/(\d+)|\/pulls\/(\d+)/);
  const index = match?.[1] || match?.[2];
  return repo && index ? `/repo/${repo.owner.login}/${repo.name}` : `/repo/${repo.owner.login}/${repo.name}`;
}

export function AccountView({ gitea, user, onUserUpdate }: AccountViewProps) {
  const [profile, setProfile] = useState<GiteaUser>(user);
  const [notifications, setNotifications] = useState<NotificationThread[]>([]);
  const [keys, setKeys] = useState<PublicKey[]>([]);
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [gpgKeys, setGpgKeys] = useState<GpgKey[]>([]);
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [oauthApps, setOauthApps] = useState<OAuth2Application[]>([]);
  const [actionVariables, setActionVariables] = useState<ActionVariable[]>([]);
  const [actionSecrets, setActionSecrets] = useState<ActionSecret[]>([]);
  const [followers, setFollowers] = useState<GiteaUser[]>([]);
  const [following, setFollowing] = useState<GiteaUser[]>([]);
  const [starredRepos, setStarredRepos] = useState<Repository[]>([]);
  const [watchedRepos, setWatchedRepos] = useState<Repository[]>([]);
  const [stopwatches, setStopwatches] = useState<Stopwatch[]>([]);
  const [newTokenValue, setNewTokenValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isGpgDialogOpen, setIsGpgDialogOpen] = useState(false);
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [isOauthDialogOpen, setIsOauthDialogOpen] = useState(false);
  const [editingOauthApp, setEditingOauthApp] = useState<OAuth2Application | null>(null);
  const [keyTitle, setKeyTitle] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [gpgValue, setGpgValue] = useState('');
  const [followUserValue, setFollowUserValue] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [oauthName, setOauthName] = useState('');
  const [oauthRedirectUris, setOauthRedirectUris] = useState('');
  const [oauthConfidential, setOauthConfidential] = useState(true);
  const [newOauthSecret, setNewOauthSecret] = useState('');
  const [actionVariableName, setActionVariableName] = useState('');
  const [actionVariableValue, setActionVariableValue] = useState('');
  const [actionVariableDescription, setActionVariableDescription] = useState('');
  const [actionSecretName, setActionSecretName] = useState('');
  const [actionSecretValue, setActionSecretValue] = useState('');
  const [actionSecretDescription, setActionSecretDescription] = useState('');

  useEffect(() => {
    setProfile(user);
  }, [user]);

  useEffect(() => {
    loadAccountData();
  }, []);

  const username = user.login || user.username || '';
  const unreadNotifications = useMemo(() => notifications.filter((item) => item.unread), [notifications]);

  const loadAccountData = async () => {
    setLoading(true);
    const [
      notificationResult,
      keyResult,
      tokenResult,
      oauthResult,
      actionVariableResult,
      actionSecretResult,
      emailResult,
      gpgResult,
      followersResult,
      followingResult,
      starredResult,
      watchedResult,
      stopwatchResult,
    ] = await Promise.allSettled([
      gitea.getNotifications({ all: true, limit: 50 }),
      gitea.getPublicKeys(),
      username ? gitea.getAccessTokens(username) : Promise.resolve([]),
      gitea.getOAuth2Applications({ limit: 50 }),
      gitea.getUserActionVariables({ limit: 100 }),
      gitea.getUserActionSecrets({ limit: 100 }),
      gitea.getEmails(),
      gitea.getGpgKeys(),
      gitea.getFollowers(),
      gitea.getFollowing(),
      gitea.getStarredRepositories(),
      gitea.getWatchedRepositories(),
      gitea.getStopwatches(),
    ]);
    if (notificationResult.status === 'fulfilled') setNotifications(notificationResult.value);
    if (keyResult.status === 'fulfilled') setKeys(keyResult.value);
    if (tokenResult.status === 'fulfilled') setTokens(tokenResult.value);
    if (oauthResult.status === 'fulfilled') setOauthApps(oauthResult.value);
    if (actionVariableResult.status === 'fulfilled') setActionVariables(actionVariableResult.value);
    if (actionSecretResult.status === 'fulfilled') setActionSecrets(actionSecretResult.value);
    if (emailResult.status === 'fulfilled') setEmails(emailResult.value);
    if (gpgResult.status === 'fulfilled') setGpgKeys(gpgResult.value);
    if (followersResult.status === 'fulfilled') setFollowers(followersResult.value);
    if (followingResult.status === 'fulfilled') setFollowing(followingResult.value);
    if (starredResult.status === 'fulfilled') setStarredRepos(starredResult.value);
    if (watchedResult.status === 'fulfilled') setWatchedRepos(watchedResult.value);
    if (stopwatchResult.status === 'fulfilled') setStopwatches(stopwatchResult.value);
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await gitea.updateUserSettings({
        full_name: profile.full_name,
        description: profile.description,
        website: profile.website,
        location: profile.location,
        language: profile.language,
        visibility: profile.visibility,
      });
      setProfile(updated);
      onUserUpdate(updated);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateKey = async () => {
    if (!keyTitle.trim() || !keyValue.trim()) return;
    setSaving(true);
    try {
      const key = await gitea.createPublicKey({ title: keyTitle.trim(), key: keyValue.trim() });
      setKeys([...keys, key]);
      setKeyTitle('');
      setKeyValue('');
      setIsKeyDialogOpen(false);
    } catch (error) {
      console.error('Failed to create SSH key:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (id: number) => {
    setSaving(true);
    try {
      await gitea.deletePublicKey(id);
      setKeys(keys.filter((key) => key.id !== id));
    } catch (error) {
      console.error('Failed to delete SSH key:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmail = async () => {
    if (!emailValue.trim()) return;
    setSaving(true);
    try {
      const created = await gitea.addEmails([emailValue.trim()]);
      setEmails([...emails, ...created.filter((email) => !emails.some((item) => item.email === email.email))]);
      setEmailValue('');
      setIsEmailDialogOpen(false);
    } catch (error) {
      console.error('Failed to add email:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmail = async (email: string) => {
    setSaving(true);
    try {
      await gitea.deleteEmails([email]);
      setEmails(emails.filter((item) => item.email !== email));
    } catch (error) {
      console.error('Failed to delete email:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGpgKey = async () => {
    if (!gpgValue.trim()) return;
    setSaving(true);
    try {
      const key = await gitea.createGpgKey({ armored_public_key: gpgValue.trim() });
      setGpgKeys([...gpgKeys, key]);
      setGpgValue('');
      setIsGpgDialogOpen(false);
    } catch (error) {
      console.error('Failed to create GPG key:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGpgKey = async (id: number) => {
    setSaving(true);
    try {
      await gitea.deleteGpgKey(id);
      setGpgKeys(gpgKeys.filter((key) => key.id !== id));
    } catch (error) {
      console.error('Failed to delete GPG key:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateToken = async () => {
    if (!username || !tokenName.trim()) return;
    setSaving(true);
    try {
      const token = await gitea.createAccessToken(username, { name: tokenName.trim() });
      setTokens([...tokens, token]);
      setNewTokenValue(token.sha1 || '');
      setTokenName('');
      setIsTokenDialogOpen(false);
    } catch (error) {
      console.error('Failed to create access token:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteToken = async (name: string) => {
    if (!username) return;
    setSaving(true);
    try {
      await gitea.deleteAccessToken(username, name);
      setTokens(tokens.filter((token) => token.name !== name));
    } catch (error) {
      console.error('Failed to delete access token:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetOauthForm = () => {
    setEditingOauthApp(null);
    setOauthName('');
    setOauthRedirectUris('');
    setOauthConfidential(true);
  };

  const openOauthEditor = (app?: OAuth2Application) => {
    if (app) {
      setEditingOauthApp(app);
      setOauthName(app.name);
      setOauthRedirectUris(app.redirect_uris.join('\n'));
      setOauthConfidential(app.confidential_client ?? true);
    } else {
      resetOauthForm();
    }
    setIsOauthDialogOpen(true);
  };

  const redirectUriList = () => oauthRedirectUris
    .split(/[\n,]/)
    .map((uri) => uri.trim())
    .filter(Boolean);

  const handleSaveOAuthApp = async () => {
    const redirect_uris = redirectUriList();
    if (!oauthName.trim() || redirect_uris.length === 0) return;
    setSaving(true);
    try {
      const data = {
        name: oauthName.trim(),
        redirect_uris,
        confidential_client: oauthConfidential,
      };
      const app = editingOauthApp
        ? await gitea.updateOAuth2Application(editingOauthApp.id, data)
        : await gitea.createOAuth2Application(data);
      setOauthApps(editingOauthApp
        ? oauthApps.map((item) => item.id === app.id ? app : item)
        : [app, ...oauthApps]);
      setNewOauthSecret(app.client_secret || '');
      resetOauthForm();
      setIsOauthDialogOpen(false);
    } catch (error) {
      console.error('Failed to save OAuth application:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOAuthApp = async (id: number) => {
    setSaving(true);
    try {
      await gitea.deleteOAuth2Application(id);
      setOauthApps(oauthApps.filter((app) => app.id !== id));
    } catch (error) {
      console.error('Failed to delete OAuth application:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateActionVariable = async () => {
    if (!actionVariableName.trim() || !actionVariableValue.trim()) return;
    setSaving(true);
    try {
      await gitea.createUserActionVariable(actionVariableName.trim(), {
        value: actionVariableValue,
        description: actionVariableDescription.trim() || undefined,
      });
      const data = await gitea.getUserActionVariables({ limit: 100 });
      setActionVariables(data);
      setActionVariableName('');
      setActionVariableValue('');
      setActionVariableDescription('');
    } catch (error) {
      console.error('Failed to create user action variable:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActionVariable = async (name: string) => {
    setSaving(true);
    try {
      await gitea.deleteUserActionVariable(name);
      setActionVariables(actionVariables.filter((item) => item.name !== name));
    } catch (error) {
      console.error('Failed to delete user action variable:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateActionSecret = async () => {
    if (!actionSecretName.trim() || !actionSecretValue.trim()) return;
    setSaving(true);
    try {
      await gitea.createOrUpdateUserActionSecret(actionSecretName.trim(), {
        data: actionSecretValue,
        description: actionSecretDescription.trim() || undefined,
      });
      const data = await gitea.getUserActionSecrets({ limit: 100 });
      setActionSecrets(data);
      setActionSecretName('');
      setActionSecretValue('');
      setActionSecretDescription('');
    } catch (error) {
      console.error('Failed to save user action secret:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActionSecret = async (name: string) => {
    setSaving(true);
    try {
      await gitea.deleteUserActionSecret(name);
      setActionSecrets(actionSecrets.filter((item) => item.name !== name));
    } catch (error) {
      console.error('Failed to delete user action secret:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFollowUser = async () => {
    if (!followUserValue.trim()) return;
    setSaving(true);
    try {
      await gitea.followUser(followUserValue.trim());
      const nextFollowing = await gitea.getFollowing();
      setFollowing(nextFollowing);
      setFollowUserValue('');
    } catch (error) {
      console.error('Failed to follow user:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnfollowUser = async (login: string) => {
    setSaving(true);
    try {
      await gitea.unfollowUser(login);
      setFollowing(following.filter((item) => (item.login || item.username) !== login));
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateThreadStatus = async (thread: NotificationThread, to_status: 'read' | 'pinned' | 'unread') => {
    try {
      const updated = await gitea.markNotificationThread(thread.id, { to_status });
      setNotifications(notifications.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      console.error('Failed to update notification:', error);
    }
  };

  const markAllRead = async () => {
    try {
      await gitea.markNotificationsRead({ to_status: 'read' });
      setNotifications(notifications.map((thread) => ({ ...thread, unread: false })));
    } catch (error) {
      console.error('Failed to mark notifications read:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-center gap-4">
        <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full border border-slate-200" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{profile.full_name || profile.login}</h1>
          <div className="text-sm text-slate-500">@{profile.login || profile.username}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Badge className="bg-slate-900 text-white">{unreadNotifications.length} unread</Badge>
          <Badge variant="outline" className="border-slate-200 text-slate-500">{keys.length} SSH keys</Badge>
        </div>
      </div>

      <Tabs defaultValue="profile" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 border-b border-slate-200">
          <TabsList className="bg-transparent h-12 p-0 gap-8">
            <TabsTrigger value="profile" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <User className="w-3.5 h-3.5 mr-2" /> Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Bell className="w-3.5 h-3.5 mr-2" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="emails" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Mail className="w-3.5 h-3.5 mr-2" /> Emails
            </TabsTrigger>
            <TabsTrigger value="keys" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <KeyRound className="w-3.5 h-3.5 mr-2" /> SSH Keys
            </TabsTrigger>
            <TabsTrigger value="gpg" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <GitCommit className="w-3.5 h-3.5 mr-2" /> GPG
            </TabsTrigger>
            <TabsTrigger value="social" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Users className="w-3.5 h-3.5 mr-2" /> Social
            </TabsTrigger>
            <TabsTrigger value="repos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Star className="w-3.5 h-3.5 mr-2" /> Lists
            </TabsTrigger>
            <TabsTrigger value="timers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Timer className="w-3.5 h-3.5 mr-2" /> Timers
            </TabsTrigger>
            <TabsTrigger value="tokens" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <LockKeyhole className="w-3.5 h-3.5 mr-2" /> Tokens
            </TabsTrigger>
            <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <Settings className="w-3.5 h-3.5 mr-2" /> Actions
            </TabsTrigger>
            <TabsTrigger value="applications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent font-bold text-xs uppercase tracking-widest h-full px-0">
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> Apps
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-4xl mx-auto bg-white">
              <div className="border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Settings className="w-4 h-4 text-slate-500" /> Profile settings
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving} className="h-8 bg-slate-900 text-white hover:bg-slate-800">
                    <Save className="w-3.5 h-3.5 mr-2" /> {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4">
                  <Input value={profile.full_name || ''} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} placeholder="Full name" className="h-10 border-slate-200" />
                  <Input value={profile.website || ''} onChange={(event) => setProfile({ ...profile, website: event.target.value })} placeholder="Website" className="h-10 border-slate-200" />
                  <Input value={profile.location || ''} onChange={(event) => setProfile({ ...profile, location: event.target.value })} placeholder="Location" className="h-10 border-slate-200" />
                  <Input value={profile.language || ''} onChange={(event) => setProfile({ ...profile, language: event.target.value })} placeholder="Language" className="h-10 border-slate-200" />
                  <textarea
                    value={profile.description || ''}
                    onChange={(event) => setProfile({ ...profile, description: event.target.value })}
                    placeholder="Description"
                    className="col-span-2 h-32 rounded-lg border border-slate-200 p-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="notifications" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-end">
              <Button variant="outline" onClick={markAllRead} className="h-8 border-slate-200 text-slate-600">
                <Check className="w-3.5 h-3.5 mr-2" /> Mark all read
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-5xl mx-auto space-y-3">
                {notifications.map((thread) => (
                  <div key={thread.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-start gap-4">
                    <div className={`mt-1 w-2.5 h-2.5 rounded-full ${thread.unread ? 'bg-sky-500' : 'bg-slate-200'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{thread.subject.title}</span>
                        <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">{thread.subject.type}</Badge>
                        {thread.pinned && <Badge className="bg-amber-500 text-white text-[10px]">Pinned</Badge>}
                      </div>
                      <Link to={threadTarget(thread)} className="mt-1 text-xs text-sky-600 hover:underline">
                        {thread.repository.full_name}
                      </Link>
                      <div className="text-[10px] text-slate-400 mt-1">{new Date(thread.updated_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => updateThreadStatus(thread, thread.unread ? 'read' : 'unread')} className="h-8 w-8 text-slate-400 hover:text-sky-600">
                        <EyeOff className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => updateThreadStatus(thread, 'pinned')} className="h-8 w-8 text-slate-400 hover:text-amber-600">
                        <Pin className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="p-12 text-center text-sm text-slate-400">No notifications found</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="emails" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-end">
              <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                <DialogTrigger render={<Button className="h-8 bg-sky-600 text-white hover:bg-sky-700"><Plus className="w-3.5 h-3.5 mr-2" /> Add Email</Button>} />
                <DialogContent className="sm:max-w-xl bg-white">
                  <DialogHeader><DialogTitle>Add Email</DialogTitle></DialogHeader>
                  <Input value={emailValue} onChange={(event) => setEmailValue(event.target.value)} placeholder="name@example.com" className="h-10 border-slate-200" />
                  <DialogFooter className="bg-white border-slate-100">
                    <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddEmail} disabled={!emailValue.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">Add Email</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-5xl mx-auto space-y-3">
                {emails.map((email) => (
                  <div key={email.email} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{email.email}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={email.verified ? "bg-green-600 text-white text-[10px]" : "bg-slate-500 text-white text-[10px]"}>
                          {email.verified ? 'Verified' : 'Unverified'}
                        </Badge>
                        {email.primary && <Badge className="bg-sky-600 text-white text-[10px]">Primary</Badge>}
                      </div>
                    </div>
                    {!email.primary && (
                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteEmail(email.email)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {emails.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No email addresses found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="keys" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-end">
              <Dialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
                <DialogTrigger render={<Button className="h-8 bg-sky-600 text-white hover:bg-sky-700"><Plus className="w-3.5 h-3.5 mr-2" /> Add SSH Key</Button>} />
                <DialogContent className="sm:max-w-2xl bg-white">
                  <DialogHeader><DialogTitle>Add SSH Key</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Input value={keyTitle} onChange={(event) => setKeyTitle(event.target.value)} placeholder="Title" className="h-10 border-slate-200" />
                    <textarea value={keyValue} onChange={(event) => setKeyValue(event.target.value)} placeholder="ssh-ed25519 ..." className="h-40 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20" />
                  </div>
                  <DialogFooter className="bg-white border-slate-100">
                    <Button variant="outline" onClick={() => setIsKeyDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateKey} disabled={!keyTitle.trim() || !keyValue.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">Add Key</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-5xl mx-auto space-y-3">
                {keys.map((key) => (
                  <div key={key.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{key.title}</div>
                      <div className="font-mono text-xs text-slate-500 mt-1 truncate">{key.fingerprint}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-2 truncate">{key.key}</div>
                    </div>
                    <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteKey(key.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {keys.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No SSH keys found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="gpg" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-end">
              <Dialog open={isGpgDialogOpen} onOpenChange={setIsGpgDialogOpen}>
                <DialogTrigger render={<Button className="h-8 bg-sky-600 text-white hover:bg-sky-700"><Plus className="w-3.5 h-3.5 mr-2" /> Add GPG Key</Button>} />
                <DialogContent className="sm:max-w-2xl bg-white">
                  <DialogHeader><DialogTitle>Add GPG Key</DialogTitle></DialogHeader>
                  <textarea
                    value={gpgValue}
                    onChange={(event) => setGpgValue(event.target.value)}
                    placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
                    className="h-72 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  <DialogFooter className="bg-white border-slate-100">
                    <Button variant="outline" onClick={() => setIsGpgDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateGpgKey} disabled={!gpgValue.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">Add GPG Key</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-5xl mx-auto space-y-3">
                {gpgKeys.map((key) => (
                  <div key={key.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{key.key_id}</div>
                      <div className="text-xs text-slate-500 mt-1">{key.emails?.map((email) => email.email).join(', ') || 'No email identities'}</div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {key.can_sign && <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">sign</Badge>}
                        {key.can_encrypt_comms && <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">encrypt comms</Badge>}
                        {key.can_certify && <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">certify</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteGpgKey(key.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {gpgKeys.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No GPG keys found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="social" className="flex-1 overflow-hidden m-0">
          <div className="h-full grid grid-cols-2">
            <div className="border-r border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-900">Following</div>
                <div className="flex gap-2">
                  <Input value={followUserValue} onChange={(event) => setFollowUserValue(event.target.value)} placeholder="username" className="h-8 w-40 border-slate-200 text-xs" />
                  <Button onClick={handleFollowUser} disabled={!followUserValue.trim() || saving} className="h-8 bg-sky-600 text-white hover:bg-sky-700">
                    <UserPlus className="w-3.5 h-3.5 mr-2" /> Follow
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {following.map((item) => {
                    const login = item.login || item.username || '';
                    return (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={item.avatar_url} alt="" className="w-9 h-9 rounded-full border border-slate-200" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{item.full_name || login}</div>
                            <div className="text-xs text-slate-400">@{login}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" disabled={saving} onClick={() => handleUnfollowUser(login)} className="h-8 text-red-600 hover:bg-red-50">
                          Unfollow
                        </Button>
                      </div>
                    );
                  })}
                  {following.length === 0 && <div className="p-12 text-center text-sm text-slate-400">Not following anyone</div>}
                </div>
              </ScrollArea>
            </div>
            <div className="flex flex-col">
              <div className="p-4 border-b border-slate-200 text-sm font-bold text-slate-900">Followers</div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {followers.map((item) => {
                    const login = item.login || item.username || '';
                    return (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                        <img src={item.avatar_url} alt="" className="w-9 h-9 rounded-full border border-slate-200" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{item.full_name || login}</div>
                          <div className="text-xs text-slate-400">@{login}</div>
                        </div>
                      </div>
                    );
                  })}
                  {followers.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No followers found</div>}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="repos" className="flex-1 overflow-hidden m-0">
          <div className="h-full grid grid-cols-2">
            <div className="border-r border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 text-sm font-bold text-slate-900">Starred repositories</div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {starredRepos.map((repo) => (
                    <Link key={repo.id} to={`/repo/${repo.owner.login}/${repo.name}`} className="block bg-white border border-slate-200 rounded-xl p-3 hover:border-sky-200">
                      <div className="flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                        <span className="text-sm font-bold text-slate-900 truncate">{repo.full_name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">{repo.description || 'No description provided.'}</div>
                    </Link>
                  ))}
                  {starredRepos.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No starred repositories</div>}
                </div>
              </ScrollArea>
            </div>
            <div className="flex flex-col">
              <div className="p-4 border-b border-slate-200 text-sm font-bold text-slate-900">Watched repositories</div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {watchedRepos.map((repo) => (
                    <Link key={repo.id} to={`/repo/${repo.owner.login}/${repo.name}`} className="block bg-white border border-slate-200 rounded-xl p-3 hover:border-sky-200">
                      <div className="flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5 text-sky-500" />
                        <span className="text-sm font-bold text-slate-900 truncate">{repo.full_name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">{repo.description || 'No description provided.'}</div>
                    </Link>
                  ))}
                  {watchedRepos.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No watched repositories</div>}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timers" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-5xl mx-auto space-y-3">
              {stopwatches.map((watch) => (
                <Link key={`${watch.repo_owner_name}/${watch.repo_name}#${watch.issue_index}`} to={`/repo/${watch.repo_owner_name}/${watch.repo_name}`} className="block bg-white border border-slate-200 rounded-xl shadow-sm p-4 hover:border-sky-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{watch.issue_title}</div>
                      <div className="text-xs text-slate-500 mt-1">{watch.repo_owner_name}/{watch.repo_name} #{watch.issue_index}</div>
                    </div>
                    <Badge className="bg-slate-900 text-white">{Math.floor(watch.seconds / 60)}m</Badge>
                  </div>
                </Link>
              ))}
              {stopwatches.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No active stopwatches</div>}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tokens" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-end">
              <Dialog open={isTokenDialogOpen} onOpenChange={setIsTokenDialogOpen}>
                <DialogTrigger render={<Button className="h-8 bg-sky-600 text-white hover:bg-sky-700"><Plus className="w-3.5 h-3.5 mr-2" /> New Token</Button>} />
                <DialogContent className="sm:max-w-xl bg-white">
                  <DialogHeader><DialogTitle>Create Access Token</DialogTitle></DialogHeader>
                  <Input value={tokenName} onChange={(event) => setTokenName(event.target.value)} placeholder="Token name" className="h-10 border-slate-200" />
                  <DialogFooter className="bg-white border-slate-100">
                    <Button variant="outline" onClick={() => setIsTokenDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateToken} disabled={!tokenName.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">Create Token</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-5xl mx-auto space-y-4">
                {newTokenValue && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="text-sm font-bold text-green-800">New token created</div>
                    <div className="mt-2 font-mono text-xs text-green-900 break-all">{newTokenValue}</div>
                  </div>
                )}
                {tokens.map((token) => (
                  <div key={token.name} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{token.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{token.token_last_eight ? `ends in ${token.token_last_eight}` : 'Token metadata'}</div>
                    </div>
                    <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteToken(token.name)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {tokens.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No access tokens found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-6xl mx-auto grid grid-cols-[1fr_360px] gap-8">
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">User actions variables</div>
                  <div className="divide-y divide-slate-100">
                    {actionVariables.map((variable) => (
                      <div key={variable.name} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{variable.name}</div>
                          <div className="text-xs text-slate-400 truncate">{variable.description || 'No description'}</div>
                        </div>
                        <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteActionVariable(variable.name)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {actionVariables.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No user actions variables configured</div>}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">User actions secrets</div>
                  <div className="divide-y divide-slate-100">
                    {actionSecrets.map((secret) => (
                      <div key={secret.name} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{secret.name}</div>
                          <div className="text-xs text-slate-400 truncate">{secret.description || 'Secret value hidden'}</div>
                        </div>
                        <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteActionSecret(secret.name)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {actionSecrets.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No user actions secrets configured</div>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
                  <div className="text-sm font-bold text-slate-900">New variable</div>
                  <Input value={actionVariableName} onChange={(event) => setActionVariableName(event.target.value)} placeholder="VARIABLE_NAME" className="h-10 border-slate-200 font-mono text-xs" />
                  <Input value={actionVariableDescription} onChange={(event) => setActionVariableDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200 text-xs" />
                  <textarea
                    value={actionVariableValue}
                    onChange={(event) => setActionVariableValue(event.target.value)}
                    placeholder="Variable value"
                    className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <Button onClick={handleCreateActionVariable} disabled={!actionVariableName.trim() || !actionVariableValue.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Save Variable
                  </Button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 h-fit">
                  <div className="text-sm font-bold text-slate-900">New secret</div>
                  <Input value={actionSecretName} onChange={(event) => setActionSecretName(event.target.value)} placeholder="SECRET_NAME" className="h-10 border-slate-200 font-mono text-xs" />
                  <Input value={actionSecretDescription} onChange={(event) => setActionSecretDescription(event.target.value)} placeholder="Description" className="h-10 border-slate-200 text-xs" />
                  <textarea
                    value={actionSecretValue}
                    onChange={(event) => setActionSecretValue(event.target.value)}
                    placeholder="Secret value"
                    className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <Button onClick={handleCreateActionSecret} disabled={!actionSecretName.trim() || !actionSecretValue.trim() || saving} className="w-full bg-sky-600 text-white hover:bg-sky-700">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Save Secret
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="applications" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-end">
              <Dialog open={isOauthDialogOpen} onOpenChange={(open) => {
                setIsOauthDialogOpen(open);
                if (!open) resetOauthForm();
              }}>
                <DialogTrigger render={
                  <Button onClick={() => openOauthEditor()} className="h-8 bg-sky-600 text-white hover:bg-sky-700">
                    <Plus className="w-3.5 h-3.5 mr-2" /> New OAuth App
                  </Button>
                } />
                <DialogContent className="sm:max-w-xl bg-white">
                  <DialogHeader><DialogTitle>{editingOauthApp ? 'Update OAuth Application' : 'Create OAuth Application'}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Input value={oauthName} onChange={(event) => setOauthName(event.target.value)} placeholder="Application name" className="h-10 border-slate-200" />
                    <textarea
                      value={oauthRedirectUris}
                      onChange={(event) => setOauthRedirectUris(event.target.value)}
                      placeholder="https://example.com/callback"
                      className="h-32 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOauthConfidential(!oauthConfidential)}
                      className={`w-full justify-start border-slate-200 ${oauthConfidential ? 'bg-sky-50 text-sky-700 border-sky-100' : 'text-slate-600'}`}
                    >
                      <LockKeyhole className="w-3.5 h-3.5 mr-2" />
                      Confidential client
                      {oauthConfidential && <Check className="ml-auto w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <DialogFooter className="bg-white border-slate-100">
                    <Button variant="outline" onClick={() => setIsOauthDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveOAuthApp} disabled={!oauthName.trim() || redirectUriList().length === 0 || saving} className="bg-sky-600 text-white hover:bg-sky-700">
                      {editingOauthApp ? 'Update App' : 'Create App'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-5xl mx-auto space-y-4">
                {newOauthSecret && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="text-sm font-bold text-green-800">OAuth client secret</div>
                    <div className="mt-2 font-mono text-xs text-green-900 break-all">{newOauthSecret}</div>
                  </div>
                )}
                {oauthApps.map((app) => (
                  <div key={app.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-slate-900 truncate">{app.name}</div>
                        {app.confidential_client && <Badge className="bg-slate-900 text-white text-[10px]">Confidential</Badge>}
                      </div>
                      <div className="mt-2 font-mono text-xs text-slate-500 break-all">{app.client_id}</div>
                      <div className="mt-3 space-y-1">
                        {app.redirect_uris.map((uri) => (
                          <div key={uri} className="text-xs text-slate-500 truncate">{uri}</div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => openOauthEditor(app)} className="h-8 border-slate-200 text-slate-600">
                        Edit
                      </Button>
                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => handleDeleteOAuthApp(app.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {oauthApps.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No OAuth applications found</div>}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
