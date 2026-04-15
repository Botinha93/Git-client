import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitFork, Star, Users, Eye, Code2 } from 'lucide-react';
import { Contributor, GiteaService, GiteaUser, Repository } from '@/src/lib/gitea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface RepositoryInsightsViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
  repository: Repository;
}

type LanguageEntry = {
  name: string;
  bytes: number;
  percent: number;
};

function userLogin(user: GiteaUser | Contributor) {
  return user.login || user.username || 'unknown';
}

export function RepositoryInsightsView({ gitea, owner, repo, repository }: RepositoryInsightsViewProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [stargazers, setStargazers] = useState<GiteaUser[]>([]);
  const [subscribers, setSubscribers] = useState<GiteaUser[]>([]);
  const [forks, setForks] = useState<Repository[]>([]);
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, [owner, repo]);

  const loadInsights = async () => {
    setLoading(true);
    const [contributorResult, languageResult, stargazerResult, subscriberResult, forkResult] = await Promise.allSettled([
      gitea.getRepositoryContributors(owner, repo, { limit: 25 }),
      gitea.getRepositoryLanguages(owner, repo),
      gitea.getRepositoryStargazers(owner, repo, { limit: 25 }),
      gitea.getRepositorySubscribers(owner, repo, { limit: 25 }),
      gitea.getRepositoryForks(owner, repo, { limit: 25 }),
    ]);

    if (contributorResult.status === 'fulfilled') setContributors(contributorResult.value);
    if (languageResult.status === 'fulfilled') setLanguages(languageResult.value || {});
    if (stargazerResult.status === 'fulfilled') setStargazers(stargazerResult.value);
    if (subscriberResult.status === 'fulfilled') setSubscribers(subscriberResult.value);
    if (forkResult.status === 'fulfilled') setForks(forkResult.value);
    setLoading(false);
  };

  const languageEntries = useMemo<LanguageEntry[]>(() => {
    const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    return Object.entries(languages)
      .map(([name, bytes]) => ({
        name,
        bytes,
        percent: total ? Math.round((bytes / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }, [languages]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 bg-slate-50/30">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <Star className="w-4 h-4 text-amber-500 mb-3" />
            <div className="text-2xl font-bold text-slate-900">{repository.stars_count}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stars</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <Eye className="w-4 h-4 text-sky-500 mb-3" />
            <div className="text-2xl font-bold text-slate-900">{repository.watchers_count}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Watchers</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <GitFork className="w-4 h-4 text-slate-500 mb-3" />
            <div className="text-2xl font-bold text-slate-900">{repository.forks_count}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Forks</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <Users className="w-4 h-4 text-emerald-500 mb-3" />
            <div className="text-2xl font-bold text-slate-900">{contributors.length}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contributors</div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Languages</span>
            </div>
            <div className="p-5 space-y-4">
              {languageEntries.length > 0 && (
                <div className="h-3 rounded-full overflow-hidden bg-slate-100 flex">
                  {languageEntries.map((language) => (
                    <div key={language.name} className="h-full bg-sky-500 first:bg-emerald-500 last:bg-amber-500" style={{ width: `${language.percent}%` }} />
                  ))}
                </div>
              )}
              <div className="space-y-3">
                {languageEntries.map((language) => (
                  <div key={language.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      <span className="text-sm font-bold text-slate-800">{language.name}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{language.percent}%</div>
                  </div>
                ))}
                {languageEntries.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No language data reported</div>}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-fit">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Forks</span>
              <Button variant="ghost" size="sm" onClick={loadInsights} className="h-7 text-slate-500">Refresh</Button>
            </div>
            <div className="divide-y divide-slate-100">
              {forks.map((fork) => (
                <Link key={fork.id} to={`/repo/${fork.owner.login}/${fork.name}`} className="block px-5 py-3 hover:bg-slate-50">
                  <div className="text-sm font-bold text-slate-900 truncate">{fork.full_name}</div>
                  <div className="text-xs text-slate-400 truncate">{fork.description || 'No description'}</div>
                </Link>
              ))}
              {forks.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No forks found</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <PeopleList title="Contributors" people={contributors} badge={(person) => `${person.contributions || 0} commits`} />
          <PeopleList title="Stargazers" people={stargazers} />
          <PeopleList title="Watchers" people={subscribers} />
        </div>
      </div>
    </ScrollArea>
  );
}

function PeopleList({ title, people, badge }: { title: string; people: (GiteaUser | Contributor)[]; badge?: (person: Contributor) => string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-900">{title}</div>
      <div className="divide-y divide-slate-100">
        {people.map((person) => (
          <div key={person.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={person.avatar_url} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{person.full_name || userLogin(person)}</div>
                <div className="text-xs text-slate-400 truncate">@{userLogin(person)}</div>
              </div>
            </div>
            {badge && <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">{badge(person as Contributor)}</Badge>}
          </div>
        ))}
        {people.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No users found</div>}
      </div>
    </div>
  );
}
