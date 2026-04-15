import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, GitBranch, Lock, Plus, Unlock } from 'lucide-react';
import { GiteaService, Repository } from '@/src/lib/gitea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DashboardProps {
  gitea: GiteaService;
  user: any;
  repositories: Repository[];
  onRepositoryCreated: (repository: Repository) => void;
}

export function Dashboard({ gitea, user, repositories, onRepositoryCreated }: DashboardProps) {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoInit, setAutoInit] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCreateRepository = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const repository = await gitea.createRepository({
        name: name.trim(),
        description,
        private: isPrivate,
        auto_init: autoInit,
        default_branch: defaultBranch || 'main',
        readme: autoInit ? 'Default' : undefined,
      });
      onRepositoryCreated(repository);
      setIsCreateOpen(false);
      setName('');
      setDescription('');
      setDefaultBranch('main');
      setIsPrivate(false);
      setAutoInit(true);
      navigate(`/repo/${repository.owner.login}/${repository.name}`);
    } catch (error) {
      console.error('Failed to create repository:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 text-center">
      <div className="max-w-2xl w-full">
        <h2 className="font-serif italic text-3xl mb-4">Welcome to GitForge</h2>
        <p className="text-sm opacity-60 mb-8">Select a repository from the sidebar to start exploring and editing your code.</p>
        <div className="grid grid-cols-3 gap-4 text-left">
          <div className="p-6 border border-slate-200 rounded-xl bg-white shadow-sm">
            <div className="font-mono text-[10px] uppercase opacity-50 mb-2">Total Repos</div>
            <div className="text-2xl font-bold">{repositories.length}</div>
          </div>
          <div className="p-6 border border-slate-200 rounded-xl bg-white shadow-sm">
            <div className="font-mono text-[10px] uppercase opacity-50 mb-2">User</div>
            <div className="text-sm font-bold truncate">{user?.login}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="p-6 border border-dashed border-sky-200 rounded-xl bg-sky-50/60 text-left hover:bg-sky-50 transition-colors"
          >
            <div className="font-mono text-[10px] uppercase text-sky-500 mb-2">Action</div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-600" /> New Repository
            </div>
          </button>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Create Repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="new-project" className="h-10 border-slate-200 font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className="h-10 border-slate-200" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default branch</label>
              <Input value={defaultBranch} onChange={(event) => setDefaultBranch(event.target.value)} className="h-10 border-slate-200 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPrivate(!isPrivate)}
                className={cn("h-10 justify-start border-slate-200", isPrivate && "bg-slate-900 text-white hover:bg-slate-800")}
              >
                {isPrivate ? <Lock className="w-3.5 h-3.5 mr-2" /> : <Unlock className="w-3.5 h-3.5 mr-2" />}
                {isPrivate ? 'Private' : 'Public'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAutoInit(!autoInit)}
                className={cn("h-10 justify-start border-slate-200", autoInit && "bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100")}
              >
                <GitBranch className="w-3.5 h-3.5 mr-2" />
                Initialize
              </Button>
            </div>
          </div>
          <DialogFooter className="bg-white border-slate-100">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRepository} disabled={!name.trim() || saving} className="bg-sky-600 text-white hover:bg-sky-700">
              <Book className="w-3.5 h-3.5 mr-2" /> {saving ? 'Creating...' : 'Create Repository'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
