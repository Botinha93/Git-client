import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Calendar, GitCommit, GitPullRequest, MessageSquare, RefreshCw, Star } from 'lucide-react';
import { ActivityFeed, GiteaService } from '@/src/lib/gitea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface RepositoryActivityViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
}

const activityIcons: Record<string, React.ReactNode> = {
  commit_repo: <GitCommit className="w-4 h-4" />,
  create_issue: <MessageSquare className="w-4 h-4" />,
  comment_issue: <MessageSquare className="w-4 h-4" />,
  create_pull_request: <GitPullRequest className="w-4 h-4" />,
  merge_pull_request: <GitPullRequest className="w-4 h-4" />,
  star_repo: <Star className="w-4 h-4" />,
};

function activityLabel(type: string) {
  return type.replace(/_/g, ' ');
}

function stripContent(content?: string) {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'string') return parsed;
    if (parsed.title) return parsed.title;
    if (parsed.ref_name) return parsed.ref_name;
    if (parsed.commits) return `${parsed.commits.length} commits`;
    return Object.values(parsed).filter((value) => typeof value === 'string').slice(0, 2).join(' · ');
  } catch {
    return content;
  }
}

export function RepositoryActivityView({ gitea, owner, repo }: RepositoryActivityViewProps) {
  const [activities, setActivities] = useState<ActivityFeed[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [owner, repo]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await gitea.getRepositoryActivityFeeds(owner, repo, {
        date: date || undefined,
        limit: 50,
      });
      setActivities(data);
    } catch (error) {
      console.error('Failed to load repository activity:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const groupedActivities = useMemo(() => {
    return activities.reduce<Record<string, ActivityFeed[]>>((groups, activity) => {
      const day = activity.created ? new Date(activity.created).toLocaleDateString() : 'Unknown date';
      groups[day] = [...(groups[day] || []), activity];
      return groups;
    }, {});
  }, [activities]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Activity</h2>
            <div className="text-xs text-slate-500">{owner}/{repo}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 pl-10 border-slate-200 bg-white" />
          </div>
          <Button onClick={loadActivities} className="h-10 bg-sky-600 text-white hover:bg-sky-700">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-slate-50/30">
        <div className="p-8 max-w-5xl mx-auto space-y-8">
          {Object.entries(groupedActivities).map(([day, items]) => (
            <div key={day} className="space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{day}</div>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
                {items.map((activity) => (
                  <div key={activity.id} className="p-4 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      {activityIcons[activity.op_type] || <Activity className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{activity.act_user?.login || 'Someone'}</span>
                        <span className="text-sm text-slate-600">{activityLabel(activity.op_type)}</span>
                        {activity.ref_name && <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">{activity.ref_name}</Badge>}
                      </div>
                      {stripContent(activity.content) && <div className="mt-1 text-xs text-slate-500 truncate">{stripContent(activity.content)}</div>}
                      <div className="mt-2 text-[10px] text-slate-400">{activity.created ? formatDistanceToNow(new Date(activity.created), { addSuffix: true }) : 'Unknown time'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <Activity className="w-12 h-12 text-slate-200 mx-auto" />
              <div className="text-slate-500 font-medium">No activity found</div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
