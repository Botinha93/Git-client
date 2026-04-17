import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Repository } from '@/src/lib/gitea';
import { 
  Activity,
  Book, 
  Compass,
  Folder, 
  MessageSquare,
  LogOut, 
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search, 
  Shield,
  UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppIcon } from './AppIcon';

interface LayoutProps {
  children: React.ReactNode;
  repositories: Repository[];
  onLogout: () => void;
  user: any;
}

export function Layout({ children, repositories, onLogout, user }: LayoutProps) {
  const location = useLocation();
  const [repoSearch, setRepoSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('gitflow_sidebar_collapsed') === 'true';
  });
  const filteredRepositories = useMemo(() => {
    const query = repoSearch.toLowerCase();
    return repositories.filter((repo) => {
      const haystack = [repo.name, repo.full_name, repo.description, repo.owner.login].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [repositories, repoSearch]);

  useEffect(() => {
    window.localStorage.setItem('gitflow_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const navLinkClass = (active: boolean) => cn(
    "group flex items-center rounded-2xl text-sm transition-all",
    isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
    active
      ? "bg-slate-50 text-slate-950 shadow-sm ring-1 ring-white/70"
      : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-50"
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-700 font-sans">
      {/* Sidebar */}
      <aside className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-400 transition-[width] duration-200",
        isCollapsed ? "w-[88px]" : "w-[280px] xl:w-[304px]",
      )}>
        <div className={cn("border-b border-slate-800/80", isCollapsed ? "px-4 py-5" : "px-6 py-6")}>
          <div className={cn("flex text-slate-50", isCollapsed ? "flex-col items-center gap-3" : "items-center gap-3")}>
            <AppIcon className="h-10 w-10 shrink-0 rounded-2xl shadow-lg shadow-sky-950/30" />
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-tight">GitFlow</div>
                <div className="text-xs text-slate-500">Workspace cockpit</div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                "h-9 w-9 shrink-0 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-50",
                isCollapsed ? "" : "ml-auto",
              )}
              onClick={() => setIsCollapsed((current) => !current)}
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className={cn("flex flex-1 min-h-0 flex-col overflow-hidden", isCollapsed ? "px-3 py-5" : "px-4 py-5")}>
          <nav className="space-y-1.5">
            <Link
              to="/"
              className={navLinkClass(location.pathname === '/')}
              title="Dashboard"
            >
              <Book className="w-4 h-4 opacity-70 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span>Dashboard</span>}
            </Link>
            <Link
              to="/explore"
              className={navLinkClass(location.pathname === '/explore')}
              title="Explore"
            >
              <Compass className="w-4 h-4 opacity-70 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span>Explore</span>}
            </Link>
            <Link
              to="/activities"
              className={navLinkClass(location.pathname === '/activities')}
              title="Activities"
            >
              <Activity className="w-4 h-4 opacity-70 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span>Activities</span>}
            </Link>
            <Link
              to="/support/inbox"
              className={navLinkClass(location.pathname === '/support/inbox')}
              title="Support Inbox"
            >
              <MessageSquare className="w-4 h-4 opacity-70 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span>Support Inbox</span>}
            </Link>
            <Link
              to="/account"
              className={navLinkClass(location.pathname === '/account')}
              title="Account"
            >
              <UserCircle className="w-4 h-4 opacity-70 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span>Account</span>}
            </Link>
            <Link
              to="/packages"
              className={navLinkClass(location.pathname === '/packages')}
              title="Packages"
            >
              <Package className="w-4 h-4 opacity-70 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span>Packages</span>}
            </Link>
            {user?.is_admin && (
              <Link
                to="/admin"
                className={navLinkClass(location.pathname === '/admin')}
                title="Admin"
              >
                <Shield className="w-4 h-4 opacity-70 transition-transform group-hover:scale-110" />
                {!isCollapsed && <span>Admin</span>}
              </Link>
            )}
          </nav>

          {!isCollapsed && (
            <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-slate-800/90 bg-slate-950/40">
              <div className="border-b border-slate-800/80 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Repositories
                  </div>
                  <div className="rounded-full border border-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                    {filteredRepositories.length}
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={repoSearch}
                    onChange={(event) => setRepoSearch(event.target.value)}
                    placeholder="Search repos..."
                    className="h-9 rounded-xl border-slate-700 bg-slate-900/90 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-400"
                  />
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-3">
                  {filteredRepositories.map((repo) => {
                    const isActive = location.pathname.includes(`/repo/${repo.owner.login}/${repo.name}`);
                    return (
                      <Link
                        key={repo.id}
                        to={`/repo/${repo.owner.login}/${repo.name}`}
                        className={cn(
                          "group block rounded-2xl border px-4 py-3 transition-all",
                          isActive
                            ? "border-sky-400/40 bg-sky-400/10 text-slate-50 shadow-sm shadow-sky-950/20"
                            : "border-transparent bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/90 hover:text-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Folder className={cn("h-4 w-4 shrink-0", isActive ? "text-sky-300" : "text-slate-500 group-hover:text-slate-300")} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{repo.name}</div>
                            <div className="truncate text-xs text-slate-500">{repo.owner.login}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {filteredRepositories.length === 0 && (
                    <div className="px-3 py-8 text-center text-xs text-slate-500">No repositories found</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className={cn("border-t border-slate-800 bg-slate-950/30", isCollapsed ? "p-3" : "p-5")}>
          <div className={cn(
            "rounded-2xl border border-slate-800/80 bg-slate-900/60",
            isCollapsed ? "flex flex-col items-center gap-2 p-2.5" : "p-3",
          )}>
            <div className={cn("flex", isCollapsed ? "flex-col items-center gap-2" : "items-center gap-3")}>
              <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-700 shrink-0">
                <img src={user?.avatar_url} alt={user?.login} className="w-full h-full object-cover" />
              </div>
              {!isCollapsed && (
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs font-bold text-slate-50 truncate">{user?.full_name || user?.login}</span>
                  <span className="text-[10px] text-slate-500 truncate">@{user?.login}</span>
                </div>
              )}
              {!isCollapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  title="Logout"
                  className="h-8 shrink-0 rounded-xl border-slate-700 bg-slate-900/70 px-3 text-slate-300 hover:bg-slate-800 hover:text-slate-50"
                  onClick={onLogout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {isCollapsed && (
              <Button
                variant="outline"
                size="sm"
                title="Logout"
                className="h-8 w-full rounded-xl border-slate-700 bg-slate-900/70 px-0 text-slate-300 hover:bg-slate-800 hover:text-slate-50"
                onClick={onLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
