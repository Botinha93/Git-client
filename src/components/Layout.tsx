import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Repository } from '@/src/lib/gitea';
import { 
  Book, 
  ChevronRight, 
  Compass,
  Folder, 
  GitBranch, 
  History, 
  Layout as LayoutIcon, 
  LogOut, 
  Package,
  Search, 
  Settings, 
  Shield,
  Star,
  UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  repositories: Repository[];
  onLogout: () => void;
  user: any;
}

export function Layout({ children, repositories, onLogout, user }: LayoutProps) {
  const location = useLocation();
  const [repoSearch, setRepoSearch] = useState('');
  const filteredRepositories = useMemo(() => {
    const query = repoSearch.toLowerCase();
    return repositories.filter((repo) => {
      const haystack = [repo.name, repo.full_name, repo.description, repo.owner.login].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [repositories, repoSearch]);

  return (
    <div className="flex h-screen bg-slate-100 text-slate-700 font-sans">
      {/* Sidebar */}
      <aside className="w-[240px] bg-slate-900 text-slate-400 flex flex-col h-full shrink-0">
        <div className="p-6 flex items-center gap-3 text-slate-50 font-bold text-xl">
          <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-indigo-400 rounded-md" />
          <span>GitFlow</span>
        </div>

        <nav className="mt-5 flex-1 overflow-y-auto">
          <div className="space-y-0.5 mb-6">
            <Link
              to="/"
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm transition-colors relative",
                location.pathname === '/'
                  ? "bg-slate-700 text-slate-50 border-l-4 border-sky-400"
                  : "hover:bg-slate-800 hover:text-slate-50"
              )}
            >
              <Book className="w-4 h-4 opacity-70" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/explore"
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm transition-colors relative",
                location.pathname === '/explore'
                  ? "bg-slate-700 text-slate-50 border-l-4 border-sky-400"
                  : "hover:bg-slate-800 hover:text-slate-50"
              )}
            >
              <Compass className="w-4 h-4 opacity-70" />
              <span>Explore</span>
            </Link>
            <Link
              to="/account"
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm transition-colors relative",
                location.pathname === '/account'
                  ? "bg-slate-700 text-slate-50 border-l-4 border-sky-400"
                  : "hover:bg-slate-800 hover:text-slate-50"
              )}
            >
              <UserCircle className="w-4 h-4 opacity-70" />
              <span>Account</span>
            </Link>
            <Link
              to="/packages"
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm transition-colors relative",
                location.pathname === '/packages'
                  ? "bg-slate-700 text-slate-50 border-l-4 border-sky-400"
                  : "hover:bg-slate-800 hover:text-slate-50"
              )}
            >
              <Package className="w-4 h-4 opacity-70" />
              <span>Packages</span>
            </Link>
            {user?.is_admin && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 px-6 py-3 text-sm transition-colors relative",
                  location.pathname === '/admin'
                    ? "bg-slate-700 text-slate-50 border-l-4 border-sky-400"
                    : "hover:bg-slate-800 hover:text-slate-50"
                )}
              >
                <Shield className="w-4 h-4 opacity-70" />
                <span>Admin</span>
              </Link>
            )}
          </div>
          <div className="px-6 mb-2 text-[10px] uppercase tracking-widest opacity-50 font-semibold">
            Repositories
          </div>
          <div className="px-4 mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                value={repoSearch}
                onChange={(event) => setRepoSearch(event.target.value)}
                placeholder="Search repos..."
                className="h-8 pl-8 bg-slate-800 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-400"
              />
            </div>
          </div>
          <div className="space-y-0.5">
            {filteredRepositories.map((repo) => {
              const isActive = location.pathname.includes(`/repo/${repo.owner.login}/${repo.name}`);
              return (
                <Link
                  key={repo.id}
                  to={`/repo/${repo.owner.login}/${repo.name}`}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 text-sm transition-colors relative",
                    isActive
                      ? "bg-slate-700 text-slate-50 border-l-4 border-sky-400"
                      : "hover:bg-slate-800 hover:text-slate-50"
                  )}
                >
                  <Folder className={cn("w-4 h-4", isActive ? "text-sky-400" : "opacity-50")} />
                  <span className="truncate">{repo.name}</span>
                </Link>
              );
            })}
            {filteredRepositories.length === 0 && (
              <div className="px-6 py-6 text-xs text-slate-500">No repositories found</div>
            )}
          </div>
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700">
              <img src={user?.avatar_url} alt={user?.login} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-50 truncate">{user?.full_name || user?.login}</span>
              <span className="text-[10px] opacity-50 truncate">@{user?.login}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-50 rounded-md"
              onClick={onLogout}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
