import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  FileDiff,
  GitBranch,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { GiteaService, Branch, Comment, CompareResult, PullRequest, PullRequestFile, PullReview, PullReviewComment, PullReviewState } from '@/src/lib/gitea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PullRequestsViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
  defaultBranch: string;
}

type PullRequestStateFilter = 'open' | 'closed' | 'all';

const stateLabels: Record<PullRequestStateFilter, string> = {
  open: 'Open',
  closed: 'Closed',
  all: 'All',
};

const reviewLabels: Record<PullReviewState, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  COMMENT: 'Commented',
  REQUEST_CHANGES: 'Requested changes',
  REQUEST_REVIEW: 'Requested review',
  '': 'Review',
};

const reviewStyles: Record<string, string> = {
  APPROVED: 'bg-green-50 text-green-700 border-green-100',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
  COMMENT: 'bg-sky-50 text-sky-700 border-sky-100',
  REQUEST_CHANGES: 'bg-red-50 text-red-700 border-red-100',
  REQUEST_REVIEW: 'bg-purple-50 text-purple-700 border-purple-100',
};

function timeAgo(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function patchStats(files: PullRequestFile[]) {
  return files.reduce(
    (totals, file) => ({
      additions: totals.additions + (file.additions || 0),
      deletions: totals.deletions + (file.deletions || 0),
      changes: totals.changes + (file.changes || 0),
    }),
    { additions: 0, deletions: 0, changes: 0 }
  );
}

export function PullRequestsView({ gitea, owner, repo, defaultBranch }: PullRequestsViewProps) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedPullRequest, setSelectedPullRequest] = useState<PullRequest | null>(null);
  const [changedFiles, setChangedFiles] = useState<PullRequestFile[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviews, setReviews] = useState<PullReview[]>([]);
  const [reviewComments, setReviewComments] = useState<Record<number, PullReviewComment[]>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stateFilter, setStateFilter] = useState<PullRequestStateFilter>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [headBranch, setHeadBranch] = useState('');
  const [baseBranch, setBaseBranch] = useState(defaultBranch);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mergeMode, setMergeMode] = useState<'merge' | 'squash' | 'rebase'>('merge');
  const [mergeError, setMergeError] = useState('');
  const [isMerged, setIsMerged] = useState(false);
  const [reviewEvent, setReviewEvent] = useState<PullReviewState>('APPROVED');
  const [reviewBody, setReviewBody] = useState('');
  const [dismissMessage, setDismissMessage] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [teamReviewerName, setTeamReviewerName] = useState('');

  useEffect(() => {
    loadPullRequests();
    loadBranches();
  }, [owner, repo, stateFilter]);

  useEffect(() => {
    setBaseBranch(defaultBranch);
  }, [defaultBranch]);

  useEffect(() => {
    if (!isCreating || !headBranch || !baseBranch || headBranch === baseBranch) {
      setCompareResult(null);
      setCompareError('');
      return;
    }
    loadComparison();
  }, [isCreating, headBranch, baseBranch]);

  const loadPullRequests = async () => {
    setLoading(true);
    try {
      const data = await gitea.getPullRequests(owner, repo, { state: stateFilter });
      setPullRequests(data);
    } catch (error) {
      console.error('Failed to load pull requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await gitea.getBranches(owner, repo);
      setBranches(data);
      const firstFeatureBranch = data.find((branch) => branch.name !== defaultBranch)?.name || data[0]?.name || '';
      setHeadBranch((current) => current || firstFeatureBranch);
    } catch (error) {
      console.error('Failed to load pull request branches:', error);
    }
  };

  const loadPullRequestDetails = async (pullRequest: PullRequest) => {
    setSelectedPullRequest(pullRequest);
    setMergeError('');
    setLoadingDetail(true);
    try {
      const [freshPullRequest, files, thread, reviewData, merged] = await Promise.all([
        gitea.getPullRequest(owner, repo, pullRequest.number),
        gitea.getPullRequestFiles(owner, repo, pullRequest.number),
        gitea.getIssueComments(owner, repo, pullRequest.number),
        gitea.getPullRequestReviews(owner, repo, pullRequest.number),
        gitea.isPullRequestMerged(owner, repo, pullRequest.number),
      ]);
      const reviewCommentEntries = await Promise.all(
        reviewData.map(async (review) => [review.id, await gitea.getPullRequestReviewComments(owner, repo, pullRequest.number, review.id)] as const)
      );
      setSelectedPullRequest(freshPullRequest);
      setChangedFiles(files);
      setComments(thread);
      setReviews(reviewData);
      setReviewComments(Object.fromEntries(reviewCommentEntries));
      setIsMerged(merged);
    } catch (error) {
      console.error('Failed to load pull request details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshReviews = async () => {
    if (!selectedPullRequest) return;
    const reviewData = await gitea.getPullRequestReviews(owner, repo, selectedPullRequest.number);
    const reviewCommentEntries = await Promise.all(
      reviewData.map(async (review) => [review.id, await gitea.getPullRequestReviewComments(owner, repo, selectedPullRequest.number, review.id)] as const)
    );
    setReviews(reviewData);
    setReviewComments(Object.fromEntries(reviewCommentEntries));
  };

  const loadComparison = async () => {
    if (!headBranch || !baseBranch || headBranch === baseBranch) return;
    setLoadingCompare(true);
    setCompareError('');
    try {
      const data = await gitea.compareCommits(owner, repo, baseBranch, headBranch);
      setCompareResult(data);
    } catch (error: any) {
      setCompareResult(null);
      setCompareError(error.response?.data?.message || 'Unable to compare these branches.');
      console.error('Failed to compare branches:', error);
    } finally {
      setLoadingCompare(false);
    }
  };

  const filteredPullRequests = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return pullRequests.filter((pullRequest) => {
      const haystack = [
        pullRequest.title,
        pullRequest.number.toString(),
        pullRequest.user.login,
        pullRequest.head.ref,
        pullRequest.base.ref,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [pullRequests, searchQuery]);

  const stats = patchStats(changedFiles);
  const compareStats = patchStats(compareResult?.files || []);

  const handleCreatePullRequest = async () => {
    if (!newTitle.trim() || !headBranch || !baseBranch || headBranch === baseBranch) return;
    setSubmitting(true);
    try {
      const pullRequest = await gitea.createPullRequest(owner, repo, {
        title: newTitle,
        body: newBody,
        head: headBranch,
        base: baseBranch,
      });
      setPullRequests([pullRequest, ...pullRequests]);
      setIsCreating(false);
      setNewTitle('');
      setNewBody('');
      loadPullRequestDetails(pullRequest);
    } catch (error) {
      console.error('Failed to create pull request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateComment = async () => {
    if (!selectedPullRequest || !newComment.trim()) return;
    try {
      const comment = await gitea.createIssueComment(owner, repo, selectedPullRequest.number, newComment);
      setComments([...comments, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to create pull request comment:', error);
    }
  };

  const handleCreateReview = async () => {
    if (!selectedPullRequest) return;
    setSubmitting(true);
    try {
      const review = await gitea.createPullRequestReview(owner, repo, selectedPullRequest.number, {
        event: reviewEvent,
        body: reviewBody.trim() || undefined,
      });
      setReviews([review, ...reviews]);
      setReviewComments({ ...reviewComments, [review.id]: [] });
      setReviewBody('');
    } catch (error) {
      console.error('Failed to create pull request review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReviewers = async () => {
    if (!selectedPullRequest || (!reviewerName.trim() && !teamReviewerName.trim())) return;
    setSubmitting(true);
    try {
      await gitea.requestPullRequestReviewers(owner, repo, selectedPullRequest.number, {
        reviewers: reviewerName.trim() ? [reviewerName.trim()] : undefined,
        team_reviewers: teamReviewerName.trim() ? [teamReviewerName.trim()] : undefined,
      });
      setReviewerName('');
      setTeamReviewerName('');
      await refreshReviews();
    } catch (error) {
      console.error('Failed to request pull request reviewers:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReviewRequest = async () => {
    if (!selectedPullRequest || (!reviewerName.trim() && !teamReviewerName.trim())) return;
    setSubmitting(true);
    try {
      await gitea.cancelPullRequestReviewers(owner, repo, selectedPullRequest.number, {
        reviewers: reviewerName.trim() ? [reviewerName.trim()] : undefined,
        team_reviewers: teamReviewerName.trim() ? [teamReviewerName.trim()] : undefined,
      });
      setReviewerName('');
      setTeamReviewerName('');
      await refreshReviews();
    } catch (error) {
      console.error('Failed to cancel pull request reviewer request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissReview = async (review: PullReview) => {
    if (!selectedPullRequest) return;
    setSubmitting(true);
    try {
      const updated = await gitea.dismissPullRequestReview(owner, repo, selectedPullRequest.number, review.id, {
        message: dismissMessage.trim() || 'Dismissed from the frontend.',
      });
      setReviews(reviews.map((item) => item.id === updated.id ? updated : item));
      setDismissMessage('');
    } catch (error) {
      console.error('Failed to dismiss pull request review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndismissReview = async (review: PullReview) => {
    if (!selectedPullRequest) return;
    setSubmitting(true);
    try {
      const updated = await gitea.undismissPullRequestReview(owner, repo, selectedPullRequest.number, review.id);
      setReviews(reviews.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      console.error('Failed to restore pull request review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (review: PullReview) => {
    if (!selectedPullRequest) return;
    setSubmitting(true);
    try {
      await gitea.deletePullRequestReview(owner, repo, selectedPullRequest.number, review.id);
      setReviews(reviews.filter((item) => item.id !== review.id));
      const nextComments = { ...reviewComments };
      delete nextComments[review.id];
      setReviewComments(nextComments);
    } catch (error) {
      console.error('Failed to delete pull request review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleState = async () => {
    if (!selectedPullRequest) return;
    try {
      const nextState = selectedPullRequest.state === 'open' ? 'closed' : 'open';
      const updated = await gitea.updatePullRequest(owner, repo, selectedPullRequest.number, { state: nextState });
      setSelectedPullRequest(updated);
      setPullRequests(pullRequests.map((item) => item.number === updated.number ? updated : item));
    } catch (error) {
      console.error('Failed to update pull request state:', error);
    }
  };

  const handleMerge = async () => {
    if (!selectedPullRequest) return;
    setSubmitting(true);
    setMergeError('');
    try {
      await gitea.mergePullRequest(owner, repo, selectedPullRequest.number, {
        do: mergeMode,
        merge_title_field: selectedPullRequest.title,
        merge_message_field: selectedPullRequest.body || '',
      });
      const updated = await gitea.getPullRequest(owner, repo, selectedPullRequest.number);
      setSelectedPullRequest(updated);
      setIsMerged(true);
      setPullRequests(pullRequests.map((item) => item.number === updated.number ? updated : item));
    } catch (error: any) {
      setMergeError(error.response?.data?.message || 'Gitea could not merge this pull request.');
      console.error('Failed to merge pull request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBranch = async () => {
    if (!selectedPullRequest) return;
    setSubmitting(true);
    try {
      await gitea.updatePullRequestBranch(owner, repo, selectedPullRequest.number, mergeMode === 'rebase' ? 'rebase' : 'merge');
      const [updated, files] = await Promise.all([
        gitea.getPullRequest(owner, repo, selectedPullRequest.number),
        gitea.getPullRequestFiles(owner, repo, selectedPullRequest.number),
      ]);
      setSelectedPullRequest(updated);
      setPullRequests(pullRequests.map((item) => item.number === updated.number ? updated : item));
      setChangedFiles(files);
    } catch (error) {
      console.error('Failed to update pull request branch:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAutoMerge = async () => {
    if (!selectedPullRequest) return;
    setSubmitting(true);
    try {
      await gitea.cancelPullRequestAutoMerge(owner, repo, selectedPullRequest.number);
    } catch (error) {
      console.error('Failed to cancel auto merge:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectBranchButton = (label: string, value: string, onSelect: (branch: string) => void) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" className="w-full justify-between h-10 bg-white border-slate-200 text-xs font-medium">
          <span className="flex items-center gap-2 truncate">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">{label}:</span>
            <span className="truncate">{value || 'Select branch'}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      } />
      <DropdownMenuContent align="start" className="w-64 bg-white max-h-80 overflow-y-auto">
        {branches.map((branch) => (
          <DropdownMenuItem key={branch.name} onClick={() => onSelect(branch.name)} className="text-xs">
            {branch.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {!selectedPullRequest && !isCreating ? (
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search pull requests..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 pl-10 bg-white border-slate-200 focus-visible:ring-sky-400"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-10 border-slate-200 bg-white text-slate-600">
                    {stateLabels[stateFilter]} <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-60" />
                  </Button>
                } />
                <DropdownMenuContent align="start" className="bg-white">
                  {(['open', 'closed', 'all'] as PullRequestStateFilter[]).map((state) => (
                    <DropdownMenuItem key={state} onClick={() => setStateFilter(state)} className="text-xs">
                      {stateLabels[state]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button onClick={() => setIsCreating(true)} className="bg-sky-600 hover:bg-sky-700 text-white h-10">
              <Plus className="w-4 h-4 mr-2" /> New Pull Request
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-slate-100">
              {filteredPullRequests.map((pullRequest) => (
                <button
                  type="button"
                  key={pullRequest.id}
                  onClick={() => loadPullRequestDetails(pullRequest)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-4 items-start"
                >
                  <div className={cn("mt-1", pullRequest.merged ? "text-purple-600" : pullRequest.state === 'open' ? "text-green-600" : "text-red-600")}>
                    {pullRequest.merged ? <GitMerge className="w-5 h-5" /> : pullRequest.state === 'open' ? <GitPullRequest className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 hover:text-sky-600 truncate">{pullRequest.title}</span>
                      {pullRequest.labels.map((label) => (
                        <Badge key={label.id} style={{ backgroundColor: `#${label.color}`, color: '#fff' }} className="text-[10px] px-1.5 py-0 border-none">
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                      <span>#{pullRequest.number} opened {timeAgo(pullRequest.created_at)} by {pullRequest.user.login}</span>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {pullRequest.head.ref} {'->'} {pullRequest.base.ref}
                      </span>
                    </div>
                  </div>
                  {pullRequest.assignee && (
                    <img src={pullRequest.assignee.avatar_url} className="w-5 h-5 rounded-full border border-slate-200" title={`Assigned to ${pullRequest.assignee.login}`} alt="" />
                  )}
                </button>
              ))}
              {filteredPullRequests.length === 0 && (
                <div className="p-12 text-center space-y-3">
                  <GitPullRequest className="w-12 h-12 text-slate-200 mx-auto" />
                  <div className="text-slate-500 font-medium">No pull requests found</div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : isCreating ? (
        <div className="flex flex-col h-full bg-slate-50/30">
          <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-white">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-bold text-slate-900">Open Pull Request</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {selectBranchButton('base', baseBranch, setBaseBranch)}
                {selectBranchButton('compare', headBranch, setHeadBranch)}
              </div>
              {headBranch === baseBranch && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                  Pick a different compare branch before opening a pull request.
                </div>
              )}
              {headBranch !== baseBranch && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileDiff className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-bold text-slate-900">Compare preview</span>
                      <span className="text-xs font-mono text-slate-400 truncate">{baseBranch} {'...'} {headBranch}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadComparison} disabled={loadingCompare} className="h-7 text-slate-500">
                      {loadingCompare ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>
                  <div className="p-4 space-y-4">
                    {compareError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{compareError}</div>}
                    {compareResult && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="text-lg font-bold text-slate-900">{compareResult.total_commits ?? compareResult.commits?.length ?? 0}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commits</div>
                          </div>
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="text-lg font-bold text-slate-900">{compareResult.files?.length || 0}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Files changed</div>
                          </div>
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="text-lg font-bold font-mono">
                              <span className="text-green-600">+{compareStats.additions}</span>
                              <span className="text-slate-300 mx-1">/</span>
                              <span className="text-red-600">-{compareStats.deletions}</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line delta</div>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
                          {(compareResult.files || []).slice(0, 8).map((file) => (
                            <div key={file.filename} className="px-3 py-2 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="outline" className="text-[10px] uppercase border-slate-200 text-slate-500">{file.status}</Badge>
                                <span className="text-xs font-mono text-slate-700 truncate">{file.filename}</span>
                              </div>
                              <div className="text-[10px] font-mono shrink-0">
                                <span className="text-green-600">+{file.additions}</span>
                                <span className="text-slate-300 mx-1">/</span>
                                <span className="text-red-600">-{file.deletions}</span>
                              </div>
                            </div>
                          ))}
                          {compareResult.files && compareResult.files.length > 8 && (
                            <div className="px-3 py-2 text-xs text-slate-400">+{compareResult.files.length - 8} more files</div>
                          )}
                          {(!compareResult.files || compareResult.files.length === 0) && (
                            <div className="p-4 text-center text-sm text-slate-400">No changed files in this comparison</div>
                          )}
                        </div>
                      </>
                    )}
                    {loadingCompare && !compareResult && <Skeleton className="h-24 w-full bg-slate-200" />}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title</label>
                <Input
                  placeholder="Add a title"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  className="h-11 bg-white border-slate-200 text-base font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Describe the changes"
                  value={newBody}
                  onChange={(event) => setNewBody(event.target.value)}
                  className="w-full h-72 p-4 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-sm font-medium resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button
                  onClick={handleCreatePullRequest}
                  disabled={!newTitle.trim() || !headBranch || !baseBranch || headBranch === baseBranch || submitting}
                  className="bg-green-600 hover:bg-green-700 text-white px-6"
                >
                  <GitPullRequest className="w-3.5 h-3.5 mr-2" /> {submitting ? 'Opening...' : 'Open Pull Request'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      ) : selectedPullRequest && (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => setSelectedPullRequest(null)} className="h-8 w-8 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex flex-col min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {selectedPullRequest.title} <span className="text-slate-400 font-normal ml-1">#{selectedPullRequest.number}</span>
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5",
                    selectedPullRequest.merged ? "bg-purple-600" : selectedPullRequest.state === 'open' ? "bg-green-600" : "bg-red-600"
                  )}>
                    {selectedPullRequest.merged ? <GitMerge className="w-3 h-3 mr-1 inline" /> : selectedPullRequest.state === 'open' ? <CircleDot className="w-3 h-3 mr-1 inline" /> : <XCircle className="w-3 h-3 mr-1 inline" />}
                    {selectedPullRequest.merged ? 'merged' : selectedPullRequest.state}
                  </Badge>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {selectedPullRequest.user.login} wants to merge {selectedPullRequest.head.ref} into {selectedPullRequest.base.ref}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleToggleState} className="h-8 border-slate-200 text-slate-600">
              {selectedPullRequest.state === 'open' ? 'Close' : 'Reopen'}
            </Button>
          </div>

          <ScrollArea className="flex-1 bg-slate-50/30">
            {loadingDetail ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full bg-slate-200" />)}
              </div>
            ) : (
              <div className="p-8 max-w-6xl mx-auto flex gap-8">
                <div className="flex-1 space-y-8 min-w-0">
                  <div className="flex gap-4 items-start">
                    <img src={selectedPullRequest.user.avatar_url} className="w-10 h-10 rounded-full border border-slate-200 shrink-0" alt="" />
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-700">
                          {selectedPullRequest.user.login} <span className="text-slate-400 font-normal">opened this pull request {timeAgo(selectedPullRequest.created_at)}</span>
                        </span>
                      </div>
                      <div className="p-4 prose prose-slate prose-sm max-w-none">
                        <ReactMarkdown>{selectedPullRequest.body || '_No description provided._'}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileDiff className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-bold text-slate-900">Changed files</span>
                      </div>
                      <div className="text-[11px] font-mono">
                        <span className="text-green-600">+{stats.additions}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-red-600">-{stats.deletions}</span>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {changedFiles.map((file) => (
                        <details key={file.filename} className="group">
                          <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge variant="outline" className="text-[10px] uppercase border-slate-200 text-slate-500">{file.status}</Badge>
                              <span className="text-xs font-mono text-slate-700 truncate">{file.filename}</span>
                            </div>
                            <div className="text-[10px] font-mono shrink-0">
                              <span className="text-green-600">+{file.additions}</span>
                              <span className="text-slate-300 mx-1">/</span>
                              <span className="text-red-600">-{file.deletions}</span>
                            </div>
                          </summary>
                          {file.patch && (
                            <pre className="m-0 max-h-96 overflow-auto bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100">
                              <code>{file.patch}</code>
                            </pre>
                          )}
                        </details>
                      ))}
                      {changedFiles.length === 0 && (
                        <div className="p-8 text-center text-sm text-slate-400">No changed files reported by Gitea.</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    {reviews.map((review) => (
                      <div key={review.id} className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shrink-0 flex items-center justify-center">
                          {review.reviewer?.avatar_url ? (
                            <img src={review.reviewer.avatar_url} className="w-10 h-10 rounded-full" alt="" />
                          ) : (
                            <ShieldCheck className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-slate-700">
                              {review.reviewer?.login || 'Reviewer'} <span className="text-slate-400 font-normal">{review.submitted_at ? `reviewed ${timeAgo(review.submitted_at)}` : 'left a review'}</span>
                            </span>
                            <Badge variant="outline" className={cn("border text-[10px]", reviewStyles[review.state] || reviewStyles.COMMENT)}>
                              {reviewLabels[review.state] || review.state || 'Review'}
                            </Badge>
                          </div>
                          {review.body && (
                            <div className="p-4 prose prose-slate prose-sm max-w-none">
                              <ReactMarkdown>{review.body}</ReactMarkdown>
                            </div>
                          )}
                          {(reviewComments[review.id] || []).length > 0 && (
                            <div className="border-t border-slate-100 bg-white">
                              {(reviewComments[review.id] || []).map((comment) => (
                                <div key={comment.id} className="px-4 py-3 border-b border-slate-100 last:border-b-0">
                                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                                    <span className="font-mono truncate">{comment.path}</span>
                                    {comment.position !== undefined && <span className="shrink-0">line {comment.position}</span>}
                                  </div>
                                  <div className="mt-2 prose prose-slate prose-sm max-w-none">
                                    <ReactMarkdown>{comment.body}</ReactMarkdown>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2">
                            {review.dismissed ? (
                              <Button variant="ghost" size="sm" disabled={submitting} onClick={() => handleUndismissReview(review)} className="h-7 px-2 text-xs text-slate-500 hover:text-sky-600">
                                Restore
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" disabled={submitting} onClick={() => handleDismissReview(review)} className="h-7 px-2 text-xs text-slate-500 hover:text-amber-600">
                                Dismiss
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" disabled={submitting} onClick={() => handleDeleteReview(review)} className="h-7 px-2 text-xs text-slate-500 hover:text-red-600">
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-4 items-start">
                        <img src={comment.user.avatar_url} className="w-10 h-10 rounded-full border border-slate-200 shrink-0" alt="" />
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-700">{comment.user.login} <span className="text-slate-400 font-normal">commented {timeAgo(comment.created_at)}</span></span>
                          </div>
                          <div className="p-4 prose prose-slate prose-sm max-w-none">
                            <ReactMarkdown>{comment.body}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 items-start pt-4 border-t border-slate-200">
                    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <textarea
                        placeholder="Leave a comment"
                        value={newComment}
                        onChange={(event) => setNewComment(event.target.value)}
                        className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-sm font-medium resize-none shadow-sm"
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleCreateComment} disabled={!newComment.trim()} className="bg-sky-600 hover:bg-sky-700 text-white px-6">
                          <Send className="w-3.5 h-3.5 mr-2" /> Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-72 space-y-6 shrink-0">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      {selectedPullRequest.mergeable === false ? <XCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      Merge status
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {selectedPullRequest.merged
                        ? `Merged ${selectedPullRequest.merged_at ? timeAgo(selectedPullRequest.merged_at) : ''}.`
                        : selectedPullRequest.mergeable === false
                          ? 'Gitea reports this pull request has conflicts.'
                          : 'Ready to merge if branch protection permits it.'}
                    </p>
                    {!selectedPullRequest.merged && selectedPullRequest.state === 'open' && (
                      <div className="space-y-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button variant="outline" className="w-full justify-between h-9 border-slate-200 text-xs">
                              {mergeMode === 'merge' ? 'Create merge commit' : mergeMode === 'squash' ? 'Squash and merge' : 'Rebase and merge'}
                              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end" className="w-56 bg-white">
                            <DropdownMenuItem onClick={() => setMergeMode('merge')} className="text-xs">Create merge commit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMergeMode('squash')} className="text-xs">Squash and merge</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMergeMode('rebase')} className="text-xs">Rebase and merge</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={handleMerge} disabled={submitting || selectedPullRequest.mergeable === false} className="w-full bg-green-600 hover:bg-green-700 text-white">
                          <GitMerge className="w-3.5 h-3.5 mr-2" /> {submitting ? 'Merging...' : 'Merge Pull Request'}
                        </Button>
                      {mergeError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{mergeError}</div>}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={handleUpdateBranch} disabled={submitting} className="h-8 border-slate-200 text-xs text-slate-600">
                          Update branch
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancelAutoMerge} disabled={submitting || isMerged} className="h-8 border-slate-200 text-xs text-slate-600">
                          Cancel auto
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Branches</div>
                    <div className="text-xs text-slate-600 space-y-2">
                      <div className="font-mono bg-slate-50 border border-slate-100 rounded-md p-2">{selectedPullRequest.head.ref}</div>
                      <div className="text-center text-slate-300">into</div>
                      <div className="font-mono bg-slate-50 border border-slate-100 rounded-md p-2">{selectedPullRequest.base.ref}</div>
                    </div>
                  </div>

                  {!selectedPullRequest.merged && selectedPullRequest.state === 'open' && (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                        Review
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="outline" className="w-full justify-between h-9 border-slate-200 text-xs">
                            {reviewLabels[reviewEvent]}
                            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end" className="w-56 bg-white">
                          <DropdownMenuItem onClick={() => setReviewEvent('APPROVED')} className="text-xs">Approve</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReviewEvent('REQUEST_CHANGES')} className="text-xs">Request changes</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReviewEvent('COMMENT')} className="text-xs">Comment</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <textarea
                        value={reviewBody}
                        onChange={(event) => setReviewBody(event.target.value)}
                        placeholder="Review summary"
                        className="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-xs resize-none"
                      />
                      <Button onClick={handleCreateReview} disabled={submitting} className="w-full bg-sky-600 hover:bg-sky-700 text-white">
                        <ShieldCheck className="w-3.5 h-3.5 mr-2" /> {submitting ? 'Submitting...' : 'Submit Review'}
                      </Button>
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <Input
                          value={dismissMessage}
                          onChange={(event) => setDismissMessage(event.target.value)}
                          placeholder="Dismiss message"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={reviewerName}
                          onChange={(event) => setReviewerName(event.target.value)}
                          placeholder="Reviewer username"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={teamReviewerName}
                          onChange={(event) => setTeamReviewerName(event.target.value)}
                          placeholder="Team reviewer"
                          className="h-8 text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={handleRequestReviewers} disabled={submitting || (!reviewerName.trim() && !teamReviewerName.trim())} className="h-8 border-slate-200 text-xs">
                            Request
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleCancelReviewRequest} disabled={submitting || (!reviewerName.trim() && !teamReviewerName.trim())} className="h-8 border-slate-200 text-xs">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
