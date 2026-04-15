import React, { useState, useEffect } from 'react';
import { GiteaService, Issue, Comment, Label, GiteaUser, Milestone, Reaction, Attachment, TrackedTime, Stopwatch } from '@/src/lib/gitea';
import { 
  MessageSquare, 
  CircleDot, 
  CheckCircle2, 
  User, 
  Clock, 
  Plus, 
  Search,
  ArrowLeft,
  Send,
  Tag,
  UserPlus,
  Settings2,
  X,
  ChevronDown,
  Pencil,
  Trash2,
  FileText,
  Calendar,
  Filter,
  Smile,
  Paperclip,
  Download,
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface IssuesViewProps {
  gitea: GiteaService;
  owner: string;
  repo: string;
}

const ISSUE_TEMPLATES = [
  {
    id: 'bug',
    name: 'Bug Report',
    description: 'Create a report to help us improve',
    title: '[BUG] ',
    body: `**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g. iOS]
- Browser [e.g. chrome, safari]
- Version [e.g. 22]`
  },
  {
    id: 'feature',
    name: 'Feature Request',
    description: 'Suggest an idea for this project',
    title: '[FEATURE] ',
    body: `**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.`
  },
  {
    id: 'custom',
    name: 'Custom Issue',
    description: 'Open a blank issue',
    title: '',
    body: ''
  }
];

const REACTION_OPTIONS = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];

const REACTION_LABELS: Record<string, string> = {
  '+1': '+1',
  '-1': '-1',
  laugh: 'laugh',
  hooray: 'hooray',
  confused: 'confused',
  heart: 'heart',
  rocket: 'rocket',
  eyes: 'eyes',
};

export function IssuesView({ gitea, owner, repo }: IssuesViewProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueBody, setNewIssueBody] = useState('');
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [availableAssignees, setAvailableAssignees] = useState<GiteaUser[]>([]);
  const [availableMilestones, setAvailableMilestones] = useState<Milestone[]>([]);
  const [currentUser, setCurrentUser] = useState<GiteaUser | null>(null);
  const [issueReactions, setIssueReactions] = useState<Reaction[]>([]);
  const [commentReactions, setCommentReactions] = useState<Record<number, Reaction[]>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [trackedTimes, setTrackedTimes] = useState<TrackedTime[]>([]);
  const [activeStopwatch, setActiveStopwatch] = useState<Stopwatch | null>(null);
  const [reactionSaving, setReactionSaving] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [timeSaving, setTimeSaving] = useState(false);
  const [manualTimeMinutes, setManualTimeMinutes] = useState('');
  const [manualTimeUser, setManualTimeUser] = useState('');
  const [selectedLabelsForNew, setSelectedLabelsForNew] = useState<number[]>([]);
  const [selectedAssigneeForNew, setSelectedAssigneeForNew] = useState<string | null>(null);
  const [selectedMilestoneForNew, setSelectedMilestoneForNew] = useState<number | null>(null);
  const [isManagingLabels, setIsManagingLabels] = useState(false);
  const [isManagingMilestones, setIsManagingMilestones] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('000000');
  const [labelDesc, setLabelDesc] = useState('');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDesc, setMilestoneDesc] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentBody, setEditCommentBody] = useState('');
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [labelFilter, setLabelFilter] = useState<number | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'all'>('all');
  const [milestoneFilter, setMilestoneFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    loadIssues();
    loadRepoMetadata();
    
    // Polling for issues list
    const interval = setInterval(async () => {
      if (!selectedIssue && !isCreating) {
        try {
          const data = await gitea.getIssues(owner, repo, { state: stateFilter });
          setIssues(data);
        } catch (error) {
          console.error('Polling issues failed:', error);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [owner, repo, selectedIssue, isCreating, stateFilter]);

  useEffect(() => {
    if (!selectedIssue) return;

    // Polling for comments
    const interval = setInterval(async () => {
      try {
        const data = await gitea.getIssueComments(owner, repo, selectedIssue.number);
        setComments(data);
      } catch (error) {
        console.error('Polling comments failed:', error);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [owner, repo, selectedIssue]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await gitea.getIssues(owner, repo, { state: stateFilter });
      setIssues(data);
    } catch (error) {
      console.error('Failed to load issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRepoMetadata = async () => {
    try {
      const [labels, assignees, milestones, user] = await Promise.all([
        gitea.getLabels(owner, repo),
        gitea.getRepoAssignees(owner, repo),
        gitea.getMilestones(owner, repo, { state: 'all' }),
        gitea.getUser()
      ]);
      setAvailableLabels(labels);
      setAvailableAssignees(assignees);
      setAvailableMilestones(milestones);
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load repo metadata:', error);
    }
  };

  const loadIssueDetails = async (issue: Issue) => {
    setSelectedIssue(issue);
    setLoadingComments(true);
    try {
      const [data, reactions, issueAttachments, issueTimes, stopwatches] = await Promise.all([
        gitea.getIssueComments(owner, repo, issue.number),
        gitea.getIssueReactions(owner, repo, issue.number),
        gitea.getIssueAttachments(owner, repo, issue.number),
        gitea.getIssueTrackedTimes(owner, repo, issue.number),
        gitea.getStopwatches()
      ]);
      setComments(data);
      setIssueReactions(reactions);
      setAttachments(issueAttachments);
      setTrackedTimes(issueTimes);
      setActiveStopwatch(stopwatches.find((watch) => watch.repo_owner_name === owner && watch.repo_name === repo && watch.issue_index === issue.number) || null);
      if (data.length > 0) {
        const reactionEntries = await Promise.all(
          data.map(async (comment) => [comment.id, await gitea.getIssueCommentReactions(owner, repo, comment.id)] as const)
        );
        setCommentReactions(Object.fromEntries(reactionEntries));
      } else {
        setCommentReactions({});
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
      setAttachments([]);
      setTrackedTimes([]);
      setActiveStopwatch(null);
    } finally {
      setLoadingComments(false);
    }
  };

  const refreshTimeTracking = async (issue = selectedIssue) => {
    if (!issue) return;
    const [issueTimes, stopwatches] = await Promise.all([
      gitea.getIssueTrackedTimes(owner, repo, issue.number),
      gitea.getStopwatches()
    ]);
    setTrackedTimes(issueTimes);
    setActiveStopwatch(stopwatches.find((watch) => watch.repo_owner_name === owner && watch.repo_name === repo && watch.issue_index === issue.number) || null);
  };

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) return;
    try {
      const issue = await gitea.createIssue(owner, repo, {
        title: newIssueTitle,
        body: newIssueBody,
        labels: selectedLabelsForNew,
        assignees: selectedAssigneeForNew ? [selectedAssigneeForNew] : [],
        milestone: selectedMilestoneForNew || undefined
      });
      setIssues([issue, ...issues]);
      setIsCreating(false);
      setNewIssueTitle('');
      setNewIssueBody('');
      setSelectedLabelsForNew([]);
      setSelectedAssigneeForNew(null);
      setSelectedMilestoneForNew(null);
      loadIssueDetails(issue);
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  };

  const handleCreateComment = async () => {
    if (!selectedIssue || !newComment.trim()) return;
    try {
      const comment = await gitea.createIssueComment(owner, repo, selectedIssue.number, newComment);
      setComments([...comments, comment]);
      setCommentReactions({ ...commentReactions, [comment.id]: [] });
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const handleToggleState = async () => {
    if (!selectedIssue) return;
    try {
      const newState = selectedIssue.state === 'open' ? 'closed' : 'open';
      const updated = await gitea.updateIssue(owner, repo, selectedIssue.number, { state: newState });
      setSelectedIssue(updated);
      setIssues(issues.map(i => i.number === updated.number ? updated : i));
    } catch (error) {
      console.error('Failed to update issue state:', error);
    }
  };

  const handleUpdateLabels = async (labelIds: number[]) => {
    if (!selectedIssue) return;
    try {
      const updated = await gitea.updateIssue(owner, repo, selectedIssue.number, { labels: labelIds });
      setSelectedIssue(updated);
      setIssues(issues.map(i => i.number === updated.number ? updated : i));
    } catch (error) {
      console.error('Failed to update issue labels:', error);
    }
  };

  const handleUpdateAssignee = async (username: string | null) => {
    if (!selectedIssue) return;
    try {
      const updated = await gitea.updateIssue(owner, repo, selectedIssue.number, { assignees: username ? [username] : [] });
      setSelectedIssue(updated);
      setIssues(issues.map(i => i.number === updated.number ? updated : i));
    } catch (error) {
      console.error('Failed to update issue assignee:', error);
    }
  };

  const handleUpdateMilestone = async (milestoneId: number | null) => {
    if (!selectedIssue) return;
    try {
      const updated = await gitea.updateIssue(owner, repo, selectedIssue.number, { milestone: milestoneId });
      setSelectedIssue(updated);
      setIssues(issues.map(i => i.number === updated.number ? updated : i));
    } catch (error) {
      console.error('Failed to update issue milestone:', error);
    }
  };

  const handleUpdateComment = async (id: number) => {
    if (!editCommentBody.trim()) return;
    try {
      const updated = await gitea.updateIssueComment(owner, repo, id, editCommentBody);
      setComments(comments.map(c => c.id === id ? updated : c));
      setEditingCommentId(null);
      setEditCommentBody('');
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const handleDeleteComment = async (id: number) => {
    try {
      await gitea.deleteIssueComment(owner, repo, id);
      setComments(comments.filter(c => c.id !== id));
      const nextReactions = { ...commentReactions };
      delete nextReactions[id];
      setCommentReactions(nextReactions);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleUploadAttachment = async (file?: File) => {
    if (!selectedIssue || !file) return;
    setUploadingAttachment(true);
    try {
      const attachment = await gitea.createIssueAttachment(owner, repo, selectedIssue.number, file);
      setAttachments([...attachments, attachment]);
    } catch (error) {
      console.error('Failed to upload issue attachment:', error);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!selectedIssue) return;
    try {
      await gitea.deleteIssueAttachment(owner, repo, selectedIssue.number, attachmentId);
      setAttachments(attachments.filter((attachment) => attachment.id !== attachmentId));
    } catch (error) {
      console.error('Failed to delete issue attachment:', error);
    }
  };

  const handleStartStopwatch = async () => {
    if (!selectedIssue) return;
    setTimeSaving(true);
    try {
      await gitea.startIssueStopwatch(owner, repo, selectedIssue.number);
      await refreshTimeTracking();
    } catch (error) {
      console.error('Failed to start issue stopwatch:', error);
    } finally {
      setTimeSaving(false);
    }
  };

  const handleStopStopwatch = async () => {
    if (!selectedIssue) return;
    setTimeSaving(true);
    try {
      await gitea.stopIssueStopwatch(owner, repo, selectedIssue.number);
      await refreshTimeTracking();
    } catch (error) {
      console.error('Failed to stop issue stopwatch:', error);
    } finally {
      setTimeSaving(false);
    }
  };

  const handleDeleteStopwatch = async () => {
    if (!selectedIssue) return;
    setTimeSaving(true);
    try {
      await gitea.deleteIssueStopwatch(owner, repo, selectedIssue.number);
      await refreshTimeTracking();
    } catch (error) {
      console.error('Failed to delete issue stopwatch:', error);
    } finally {
      setTimeSaving(false);
    }
  };

  const handleAddTrackedTime = async () => {
    if (!selectedIssue) return;
    const minutes = Number(manualTimeMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    setTimeSaving(true);
    try {
      const trackedTime = await gitea.addIssueTrackedTime(owner, repo, selectedIssue.number, {
        time: Math.round(minutes * 60),
        user_name: manualTimeUser.trim() || undefined,
      });
      setTrackedTimes([trackedTime, ...trackedTimes]);
      setManualTimeMinutes('');
      setManualTimeUser('');
    } catch (error) {
      console.error('Failed to add tracked time:', error);
    } finally {
      setTimeSaving(false);
    }
  };

  const handleDeleteTrackedTime = async (timeId: number) => {
    if (!selectedIssue) return;
    setTimeSaving(true);
    try {
      await gitea.deleteIssueTrackedTime(owner, repo, selectedIssue.number, timeId);
      setTrackedTimes(trackedTimes.filter((trackedTime) => trackedTime.id !== timeId));
    } catch (error) {
      console.error('Failed to delete tracked time:', error);
    } finally {
      setTimeSaving(false);
    }
  };

  const handleResetTrackedTimes = async () => {
    if (!selectedIssue) return;
    setTimeSaving(true);
    try {
      await gitea.resetIssueTrackedTimes(owner, repo, selectedIssue.number);
      setTrackedTimes([]);
    } catch (error) {
      console.error('Failed to reset tracked times:', error);
    } finally {
      setTimeSaving(false);
    }
  };

  const handleToggleReaction = async (target: 'issue' | 'comment', content: string, commentId?: number) => {
    if (!selectedIssue) return;
    const key = target === 'issue' ? `issue:${content}` : `comment:${commentId}:${content}`;
    setReactionSaving(key);
    try {
      const reactions = target === 'issue' ? issueReactions : commentReactions[commentId || 0] || [];
      const currentLogin = currentUser?.login || currentUser?.username;
      const hasReaction = !!currentLogin && reactions.some(reaction => reaction.content === content && (reaction.user.login || reaction.user.username) === currentLogin);

      if (target === 'issue') {
        if (hasReaction) {
          await gitea.deleteIssueReaction(owner, repo, selectedIssue.number, content);
        } else {
          await gitea.createIssueReaction(owner, repo, selectedIssue.number, content);
        }
        const updated = await gitea.getIssueReactions(owner, repo, selectedIssue.number);
        setIssueReactions(updated);
      } else if (commentId) {
        if (hasReaction) {
          await gitea.deleteIssueCommentReaction(owner, repo, commentId, content);
        } else {
          await gitea.createIssueCommentReaction(owner, repo, commentId, content);
        }
        const updated = await gitea.getIssueCommentReactions(owner, repo, commentId);
        setCommentReactions({ ...commentReactions, [commentId]: updated });
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    } finally {
      setReactionSaving(null);
    }
  };

  const handleUpdateIssueBody = async () => {
    if (!selectedIssue || !editBody.trim()) return;
    try {
      const updated = await gitea.updateIssue(owner, repo, selectedIssue.number, { body: editBody });
      setSelectedIssue(updated);
      setIssues(issues.map(i => i.number === updated.number ? updated : i));
      setIsEditingBody(false);
    } catch (error) {
      console.error('Failed to update issue body:', error);
    }
  };

  const handleCreateLabel = async () => {
    try {
      const label = await gitea.createLabel(owner, repo, { name: labelName, color: labelColor, description: labelDesc });
      setAvailableLabels([...availableLabels, label]);
      resetLabelForm();
    } catch (error) {
      console.error('Failed to create label:', error);
    }
  };

  const handleUpdateLabel = async () => {
    if (!editingLabel) return;
    try {
      const label = await gitea.updateLabel(owner, repo, editingLabel.id, { name: labelName, color: labelColor, description: labelDesc });
      setAvailableLabels(availableLabels.map(l => l.id === label.id ? label : l));
      resetLabelForm();
    } catch (error) {
      console.error('Failed to update label:', error);
    }
  };

  const handleDeleteLabel = async (id: number) => {
    try {
      await gitea.deleteLabel(owner, repo, id);
      setAvailableLabels(availableLabels.filter(l => l.id !== id));
    } catch (error) {
      console.error('Failed to delete label:', error);
    }
  };

  const handleCreateMilestone = async () => {
    if (!milestoneTitle.trim()) return;
    try {
      const milestone = await gitea.createMilestone(owner, repo, {
        title: milestoneTitle,
        description: milestoneDesc,
        due_on: milestoneDue ? new Date(milestoneDue).toISOString() : undefined,
      });
      setAvailableMilestones([...availableMilestones, milestone]);
      resetMilestoneForm();
    } catch (error) {
      console.error('Failed to create milestone:', error);
    }
  };

  const handleUpdateMilestoneRecord = async () => {
    if (!editingMilestone || !milestoneTitle.trim()) return;
    try {
      const milestone = await gitea.updateMilestone(owner, repo, editingMilestone.id, {
        title: milestoneTitle,
        description: milestoneDesc,
        due_on: milestoneDue ? new Date(milestoneDue).toISOString() : null,
      });
      setAvailableMilestones(availableMilestones.map(m => m.id === milestone.id ? milestone : m));
      resetMilestoneForm();
    } catch (error) {
      console.error('Failed to update milestone:', error);
    }
  };

  const handleToggleMilestoneState = async (milestone: Milestone) => {
    try {
      const updated = await gitea.updateMilestone(owner, repo, milestone.id, {
        state: milestone.state === 'open' ? 'closed' : 'open',
      });
      setAvailableMilestones(availableMilestones.map(m => m.id === updated.id ? updated : m));
    } catch (error) {
      console.error('Failed to update milestone state:', error);
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    try {
      await gitea.deleteMilestone(owner, repo, id);
      setAvailableMilestones(availableMilestones.filter(m => m.id !== id));
      if (selectedMilestoneForNew === id) setSelectedMilestoneForNew(null);
      if (milestoneFilter === id) setMilestoneFilter('all');
    } catch (error) {
      console.error('Failed to delete milestone:', error);
    }
  };

  const resetLabelForm = () => {
    setEditingLabel(null);
    setLabelName('');
    setLabelColor('000000');
    setLabelDesc('');
  };

  const resetMilestoneForm = () => {
    setEditingMilestone(null);
    setMilestoneTitle('');
    setMilestoneDesc('');
    setMilestoneDue('');
  };

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.number.toString().includes(searchQuery);
    const matchesState = stateFilter === 'all' || issue.state === stateFilter;
    const matchesLabel = labelFilter === 'all' || issue.labels.some(label => label.id === labelFilter);
    const matchesAssignee = assigneeFilter === 'all' || issue.assignee?.login === assigneeFilter;
    const matchesMilestone = milestoneFilter === 'all' || issue.milestone?.id === milestoneFilter;
    return matchesSearch && matchesState && matchesLabel && matchesAssignee && matchesMilestone;
  });

  const formatDuration = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.round(seconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const totalTrackedSeconds = trackedTimes.reduce((total, trackedTime) => total + (trackedTime.time || 0), 0);

  const renderReactions = (target: 'issue' | 'comment', reactions: Reaction[], commentId?: number) => {
    const currentLogin = currentUser?.login || currentUser?.username;
    const grouped = reactions.reduce<Record<string, Reaction[]>>((acc, reaction) => {
      acc[reaction.content] = [...(acc[reaction.content] || []), reaction];
      return acc;
    }, {});

    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {Object.entries(grouped).map(([content, items]) => {
          const active = !!currentLogin && items.some(reaction => (reaction.user.login || reaction.user.username) === currentLogin);
          return (
            <Button
              key={content}
              variant="outline"
              size="sm"
              disabled={reactionSaving === (target === 'issue' ? `issue:${content}` : `comment:${commentId}:${content}`)}
              onClick={() => handleToggleReaction(target, content, commentId)}
              className={cn(
                "h-7 gap-1 border-slate-200 px-2 text-xs text-slate-600",
                active && "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
              )}
            >
              <span className="font-bold">{REACTION_LABELS[content] || content}</span>
              <span>{items.length}</span>
            </Button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-sky-600">
              <Smile className="w-3.5 h-3.5 mr-1" /> React
            </Button>
          } />
          <DropdownMenuContent align="start" className="w-40 bg-white">
            {REACTION_OPTIONS.map((content) => (
              <DropdownMenuItem
                key={content}
                disabled={reactionSaving === (target === 'issue' ? `issue:${content}` : `comment:${commentId}:${content}`)}
                onClick={() => handleToggleReaction(target, content, commentId)}
                className="text-xs"
              >
                {REACTION_LABELS[content]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full bg-slate-200" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {!selectedIssue && !isCreating ? (
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search issues..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-10 bg-white border-slate-200 focus-visible:ring-sky-400"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-10 border-slate-200 bg-white text-slate-600">
                    <Filter className="w-4 h-4 mr-2" /> {stateFilter === 'all' ? 'All' : stateFilter}
                  </Button>
                } />
                <DropdownMenuContent align="start" className="w-48 bg-white">
                  {(['open', 'closed', 'all'] as const).map(state => (
                    <DropdownMenuItem key={state} onClick={() => setStateFilter(state)} className="text-xs capitalize">
                      {state}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-10 border-slate-200 bg-white text-slate-600">
                    <Tag className="w-4 h-4 mr-2" /> {labelFilter === 'all' ? 'Label' : availableLabels.find(l => l.id === labelFilter)?.name}
                  </Button>
                } />
                <DropdownMenuContent align="start" className="w-56 bg-white">
                  <DropdownMenuItem onClick={() => setLabelFilter('all')} className="text-xs">Any label</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {availableLabels.map(label => (
                    <DropdownMenuItem key={label.id} onClick={() => setLabelFilter(label.id)} className="text-xs flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${label.color}` }} />
                      {label.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-10 border-slate-200 bg-white text-slate-600">
                    <UserPlus className="w-4 h-4 mr-2" /> {assigneeFilter === 'all' ? 'Assignee' : assigneeFilter}
                  </Button>
                } />
                <DropdownMenuContent align="start" className="w-56 bg-white">
                  <DropdownMenuItem onClick={() => setAssigneeFilter('all')} className="text-xs">Anyone</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {availableAssignees.map(user => (
                    <DropdownMenuItem key={user.id} onClick={() => setAssigneeFilter(user.login)} className="text-xs flex items-center gap-2">
                      <img src={user.avatar_url} className="w-4 h-4 rounded-full" alt="" />
                      {user.login}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-10 border-slate-200 bg-white text-slate-600">
                    <Calendar className="w-4 h-4 mr-2" /> {milestoneFilter === 'all' ? 'Milestone' : availableMilestones.find(m => m.id === milestoneFilter)?.title}
                  </Button>
                } />
                <DropdownMenuContent align="start" className="w-56 bg-white">
                  <DropdownMenuItem onClick={() => setMilestoneFilter('all')} className="text-xs">Any milestone</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {availableMilestones.map(milestone => (
                    <DropdownMenuItem key={milestone.id} onClick={() => setMilestoneFilter(milestone.id)} className="text-xs">
                      {milestone.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-3">
              <Dialog open={isManagingLabels} onOpenChange={setIsManagingLabels}>
                <DialogTrigger render={
                  <Button variant="outline" className="h-10 border-slate-200 text-slate-600">
                    <Tag className="w-4 h-4 mr-2" /> Labels
                  </Button>
                } />
                <DialogContent className="sm:max-w-xl bg-white">
                  <DialogHeader>
                    <DialogTitle>Manage Labels</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</label>
                          <Input value={labelName} onChange={e => setLabelName(e.target.value)} placeholder="Label name" className="h-9 text-xs" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Color (Hex)</label>
                          <div className="flex gap-2">
                            <div className="w-9 h-9 rounded border border-slate-200 shrink-0" style={{ backgroundColor: `#${labelColor}` }} />
                            <Input value={labelColor} onChange={e => setLabelColor(e.target.value.replace('#', ''))} placeholder="000000" className="h-9 text-xs font-mono" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                        <Input value={labelDesc} onChange={e => setLabelDesc(e.target.value)} placeholder="Optional description" className="h-9 text-xs" />
                      </div>
                      <div className="flex justify-end gap-2">
                        {editingLabel && <Button variant="ghost" size="sm" onClick={resetLabelForm}>Cancel</Button>}
                        <Button size="sm" onClick={editingLabel ? handleUpdateLabel : handleCreateLabel} disabled={!labelName.trim()} className="bg-sky-600 hover:bg-sky-700 text-white">
                          {editingLabel ? 'Update Label' : 'Create Label'}
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-64 pr-4">
                      <div className="space-y-2">
                        {availableLabels.map(label => (
                          <div key={label.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                            <div className="flex items-center gap-3">
                              <Badge style={{ backgroundColor: `#${label.color}`, color: '#fff' }} className="border-none text-[10px]">
                                {label.name}
                              </Badge>
                              <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{label.description}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-sky-600" onClick={() => {
                                setEditingLabel(label);
                                setLabelName(label.name);
                                setLabelColor(label.color);
                                setLabelDesc(label.description || '');
                              }}>
                                <Settings2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDeleteLabel(label.id)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isManagingMilestones} onOpenChange={setIsManagingMilestones}>
                <DialogTrigger render={
                  <Button variant="outline" className="h-10 border-slate-200 text-slate-600">
                    <Calendar className="w-4 h-4 mr-2" /> Milestones
                  </Button>
                } />
                <DialogContent className="sm:max-w-xl bg-white">
                  <DialogHeader>
                    <DialogTitle>Manage Milestones</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <div className="grid grid-cols-[1fr_150px] gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</label>
                          <Input value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} placeholder="Milestone title" className="h-9 text-xs" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due date</label>
                          <Input type="date" value={milestoneDue} onChange={e => setMilestoneDue(e.target.value)} className="h-9 text-xs" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                        <Input value={milestoneDesc} onChange={e => setMilestoneDesc(e.target.value)} placeholder="Optional description" className="h-9 text-xs" />
                      </div>
                      <div className="flex justify-end gap-2">
                        {editingMilestone && <Button variant="ghost" size="sm" onClick={resetMilestoneForm}>Cancel</Button>}
                        <Button size="sm" onClick={editingMilestone ? handleUpdateMilestoneRecord : handleCreateMilestone} disabled={!milestoneTitle.trim()} className="bg-sky-600 hover:bg-sky-700 text-white">
                          {editingMilestone ? 'Update Milestone' : 'Create Milestone'}
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-64 pr-4">
                      <div className="space-y-2">
                        {availableMilestones.map(milestone => {
                          const total = milestone.open_issues + milestone.closed_issues;
                          const percent = total ? Math.round((milestone.closed_issues / total) * 100) : 0;
                          return (
                            <div key={milestone.id} className="p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-colors space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 truncate">{milestone.title}</span>
                                    <Badge className={cn("text-[10px]", milestone.state === 'open' ? "bg-green-600" : "bg-purple-600")}>{milestone.state}</Badge>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">{milestone.description || 'No description'}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-sky-600" onClick={() => {
                                    setEditingMilestone(milestone);
                                    setMilestoneTitle(milestone.title);
                                    setMilestoneDesc(milestone.description || '');
                                    setMilestoneDue(milestone.due_on ? milestone.due_on.slice(0, 10) : '');
                                  }}>
                                    <Settings2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-purple-600" onClick={() => handleToggleMilestoneState(milestone)}>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDeleteMilestone(milestone.id)}>
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full bg-sky-500" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={() => setIsCreating(true)} className="bg-sky-600 hover:bg-sky-700 text-white h-10">
                <Plus className="w-4 h-4 mr-2" /> New Issue
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-slate-100">
              {filteredIssues.map((issue) => (
                <div 
                  key={issue.id} 
                  onClick={() => loadIssueDetails(issue)}
                  className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex gap-4 items-start"
                >
                  <div className={cn(
                    "mt-1",
                    issue.state === 'open' ? "text-green-600" : "text-purple-600"
                  )}>
                    {issue.state === 'open' ? <CircleDot className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 hover:text-sky-600">{issue.title}</span>
                      {issue.labels.map(label => (
                        <Badge 
                          key={label.id} 
                          style={{ backgroundColor: `#${label.color}`, color: '#fff' }}
                          className="text-[10px] px-1.5 py-0 border-none"
                        >
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>#{issue.number} opened {new Date(issue.created_at).toLocaleDateString()} by {issue.user.login}</span>
                      {issue.comments > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> {issue.comments}
                        </span>
                      )}
                      {issue.milestone && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {issue.milestone.title}
                        </span>
                      )}
                    </div>
                  </div>
                  {issue.assignee && (
                    <img src={issue.assignee.avatar_url} className="w-5 h-5 rounded-full border border-slate-200" title={`Assigned to ${issue.assignee.login}`} alt="" />
                  )}
                </div>
              ))}
              {filteredIssues.length === 0 && (
                <div className="p-12 text-center space-y-3">
                  <CircleDot className="w-12 h-12 text-slate-200 mx-auto" />
                  <div className="text-slate-500 font-medium">No issues found</div>
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
            <h2 className="text-sm font-bold text-slate-900">Create New Issue</h2>
          </div>
          <div className="p-8 max-w-5xl mx-auto w-full flex gap-8">
            <div className="flex-1 space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Template</label>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" size="sm" className="h-8 border-slate-200 text-xs font-medium bg-white flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Select Template
                      <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                    </Button>
                  } />
                  <DropdownMenuContent align="end" className="w-64 bg-white">
                    {ISSUE_TEMPLATES.map(template => (
                      <DropdownMenuItem 
                        key={template.id} 
                        onClick={() => {
                          setNewIssueTitle(template.title);
                          setNewIssueBody(template.body);
                        }}
                        className="flex flex-col items-start gap-1 p-2"
                      >
                        <span className="text-xs font-bold text-slate-900">{template.name}</span>
                        <span className="text-[10px] text-slate-500">{template.description}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title</label>
                <Input 
                  placeholder="Title" 
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  className="h-11 bg-white border-slate-200 text-base font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description (Markdown supported)</label>
                <textarea 
                  placeholder="Leave a comment" 
                  value={newIssueBody}
                  onChange={(e) => setNewIssueBody(e.target.value)}
                  className="w-full h-64 p-4 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-sm font-medium resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button onClick={handleCreateIssue} disabled={!newIssueTitle.trim()} className="bg-green-600 hover:bg-green-700 text-white px-6">
                  Submit New Issue
                </Button>
              </div>
            </div>

            <div className="w-64 space-y-6 shrink-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assignee</span>
                  <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" className="w-full justify-between h-10 border-slate-200 text-xs font-medium bg-white">
                      {selectedAssigneeForNew ? (
                        <div className="flex items-center gap-2">
                          <img src={availableAssignees.find(a => a.login === selectedAssigneeForNew)?.avatar_url} className="w-4 h-4 rounded-full" alt="" />
                          {selectedAssigneeForNew}
                        </div>
                      ) : "No assignee"}
                      <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                    </Button>
                  } />
                  <DropdownMenuContent align="end" className="w-56 bg-white">
                    <DropdownMenuItem onClick={() => setSelectedAssigneeForNew(null)} className="text-xs">
                      No assignee
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {availableAssignees.map(user => (
                      <DropdownMenuItem key={user.id} onClick={() => setSelectedAssigneeForNew(user.login)} className="text-xs flex items-center gap-2">
                        <img src={user.avatar_url} className="w-4 h-4 rounded-full" alt="" />
                        {user.login}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Labels</span>
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-white border border-slate-200 rounded-lg">
                  {selectedLabelsForNew.length === 0 && <span className="text-[10px] text-slate-400 italic p-1">No labels selected</span>}
                  {selectedLabelsForNew.map(id => {
                    const label = availableLabels.find(l => l.id === id);
                    if (!label) return null;
                    return (
                      <Badge 
                        key={id} 
                        style={{ backgroundColor: `#${label.color}`, color: '#fff' }}
                        className="text-[10px] px-1.5 py-0 border-none flex items-center gap-1"
                      >
                        {label.name}
                        <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-80" onClick={() => setSelectedLabelsForNew(selectedLabelsForNew.filter(l => l !== id))} />
                      </Badge>
                    );
                  })}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" size="sm" className="w-full h-8 border-slate-200 text-[10px] font-bold uppercase tracking-wider bg-white">
                      Select Labels
                    </Button>
                  } />
                  <DropdownMenuContent align="end" className="w-56 bg-white">
                    {availableLabels.map(label => (
                      <DropdownMenuCheckboxItem 
                        key={label.id}
                        checked={selectedLabelsForNew.includes(label.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedLabelsForNew([...selectedLabelsForNew, label.id]);
                          else setSelectedLabelsForNew(selectedLabelsForNew.filter(id => id !== label.id));
                        }}
                        className="text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${label.color}` }} />
                          {label.name}
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Milestone</span>
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" className="w-full justify-between h-10 border-slate-200 text-xs font-medium bg-white">
                      {selectedMilestoneForNew ? availableMilestones.find(m => m.id === selectedMilestoneForNew)?.title : 'No milestone'}
                      <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                    </Button>
                  } />
                  <DropdownMenuContent align="end" className="w-56 bg-white">
                    <DropdownMenuItem onClick={() => setSelectedMilestoneForNew(null)} className="text-xs">
                      No milestone
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {availableMilestones.filter(m => m.state === 'open').map(milestone => (
                      <DropdownMenuItem key={milestone.id} onClick={() => setSelectedMilestoneForNew(milestone.id)} className="text-xs">
                        {milestone.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedIssue(null)} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-slate-900">{selectedIssue.title} <span className="text-slate-400 font-normal ml-1">#{selectedIssue.number}</span></h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5",
                    selectedIssue.state === 'open' ? "bg-green-600" : "bg-purple-600"
                  )}>
                    {selectedIssue.state === 'open' ? <CircleDot className="w-3 h-3 mr-1 inline" /> : <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                    {selectedIssue.state}
                  </Badge>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {selectedIssue.user.login} opened this issue on {new Date(selectedIssue.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToggleState}
              className={cn(
                "h-8 border-slate-200",
                selectedIssue.state === 'open' ? "text-slate-600 hover:bg-slate-50" : "text-green-600 hover:bg-green-50 border-green-100"
              )}
            >
              {selectedIssue.state === 'open' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Close Issue
                </>
              ) : (
                <>
                  <CircleDot className="w-3.5 h-3.5 mr-2" /> Reopen Issue
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1 bg-slate-50/30">
            <div className="p-8 max-w-6xl mx-auto flex gap-8">
              <div className="flex-1 space-y-8">
                {/* Original Issue Body */}
                <div className="flex gap-4 items-start">
                  <img src={selectedIssue.user.avatar_url} className="w-10 h-10 rounded-full border border-slate-200 shrink-0" alt="" />
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">{selectedIssue.user.login} <span className="text-slate-400 font-normal">commented on {new Date(selectedIssue.created_at).toLocaleDateString()}</span></span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-400 hover:text-sky-600"
                        onClick={() => {
                          setIsEditingBody(true);
                          setEditBody(selectedIssue.body || '');
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="p-4">
                      {isEditingBody ? (
                        <div className="space-y-3">
                          <textarea 
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            className="w-full h-64 p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-sm font-medium resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsEditingBody(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleUpdateIssueBody} className="bg-sky-600 hover:bg-sky-700 text-white">Save Changes</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate prose-sm max-w-none">
                          <ReactMarkdown>{selectedIssue.body || '_No description provided._'}</ReactMarkdown>
                        </div>
                      )}
                      {!isEditingBody && renderReactions('issue', issueReactions)}
                    </div>
                  </div>
                </div>

                {/* Comments */}
                {loadingComments ? (
                  <div className="space-y-6 pl-14">
                    {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full bg-slate-200" />)}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-4 items-start">
                        <img src={comment.user.avatar_url} className="w-10 h-10 rounded-full border border-slate-200 shrink-0" alt="" />
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700">{comment.user.login} <span className="text-slate-400 font-normal">commented on {new Date(comment.created_at).toLocaleDateString()}</span></span>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-slate-400 hover:text-sky-600"
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditCommentBody(comment.body);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-slate-400 hover:text-red-600"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="p-4">
                            {editingCommentId === comment.id ? (
                              <div className="space-y-3">
                                <textarea 
                                  value={editCommentBody}
                                  onChange={(e) => setEditCommentBody(e.target.value)}
                                  className="w-full h-32 p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-sm font-medium resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                                  <Button size="sm" onClick={() => handleUpdateComment(comment.id)} className="bg-sky-600 hover:bg-sky-700 text-white">Save Changes</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="prose prose-slate prose-sm max-w-none">
                                <ReactMarkdown>{comment.body}</ReactMarkdown>
                              </div>
                            )}
                            {editingCommentId !== comment.id && comment.assets && comment.assets.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {comment.assets.map((asset) => (
                                  <a
                                    key={asset.id}
                                    href={asset.browser_download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    {asset.name}
                                  </a>
                                ))}
                              </div>
                            )}
                            {editingCommentId !== comment.id && renderReactions('comment', commentReactions[comment.id] || [], comment.id)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Comment Box */}
                <div className="flex gap-4 items-start pt-4 border-t border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <textarea 
                      placeholder="Leave a comment" 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400/20 focus:border-sky-400 transition-all text-sm font-medium resize-none shadow-sm"
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleCreateComment} 
                        disabled={!newComment.trim()}
                        className="bg-sky-600 hover:bg-sky-700 text-white px-6"
                      >
                        <Send className="w-3.5 h-3.5 mr-2" /> Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Sidebar */}
              <div className="w-64 space-y-8 shrink-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assignee</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-sky-600">
                          <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="w-56 bg-white">
                        <DropdownMenuItem onClick={() => handleUpdateAssignee(null)} className="text-xs">
                          No assignee
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {availableAssignees.map(user => (
                          <DropdownMenuItem key={user.id} onClick={() => handleUpdateAssignee(user.login)} className="text-xs flex items-center gap-2">
                            <img src={user.avatar_url} className="w-4 h-4 rounded-full" alt="" />
                            {user.login}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedIssue.assignee ? (
                      <>
                        <img src={selectedIssue.assignee.avatar_url} className="w-6 h-6 rounded-full border border-slate-200" alt="" />
                        <span className="text-xs font-bold text-slate-700">{selectedIssue.assignee.login}</span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No one assigned</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Labels</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-sky-600">
                          <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="w-56 bg-white">
                        {availableLabels.map(label => (
                          <DropdownMenuCheckboxItem 
                            key={label.id}
                            checked={selectedIssue.labels.some(l => l.id === label.id)}
                            onCheckedChange={(checked) => {
                              const currentIds = selectedIssue.labels.map(l => l.id);
                              const nextIds = checked 
                                ? [...currentIds, label.id]
                                : currentIds.filter(id => id !== label.id);
                              handleUpdateLabels(nextIds);
                            }}
                            className="text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${label.color}` }} />
                              {label.name}
                            </div>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIssue.labels.length === 0 && <span className="text-xs text-slate-400 italic">No labels</span>}
                    {selectedIssue.labels.map(label => (
                      <Badge 
                        key={label.id} 
                        style={{ backgroundColor: `#${label.color}`, color: '#fff' }}
                        className="text-[10px] px-1.5 py-0 border-none"
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Milestone</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-sky-600">
                          <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="w-56 bg-white">
                        <DropdownMenuItem onClick={() => handleUpdateMilestone(null)} className="text-xs">
                          No milestone
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {availableMilestones.filter(m => m.state === 'open').map(milestone => (
                          <DropdownMenuItem key={milestone.id} onClick={() => handleUpdateMilestone(milestone.id)} className="text-xs">
                            {milestone.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {selectedIssue.milestone ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {selectedIssue.milestone.title}
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-sky-500"
                          style={{
                            width: `${selectedIssue.milestone.open_issues + selectedIssue.milestone.closed_issues
                              ? Math.round((selectedIssue.milestone.closed_issues / (selectedIssue.milestone.open_issues + selectedIssue.milestone.closed_issues)) * 100)
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No milestone</span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time tracking</span>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0">
                      {formatDuration(totalTrackedSeconds + (activeStopwatch?.seconds || 0))}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {activeStopwatch ? (
                      <div className="rounded-lg border border-sky-100 bg-sky-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-bold text-sky-800">
                              <Clock className="w-3.5 h-3.5" />
                              Stopwatch running
                            </div>
                            <div className="mt-1 text-[10px] text-sky-700">{formatDuration(activeStopwatch.seconds)} on this issue</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" disabled={timeSaving} onClick={handleStopStopwatch} className="h-7 border-sky-200 bg-white px-2 text-xs text-sky-700 hover:bg-sky-100">
                              Stop
                            </Button>
                            <Button variant="ghost" size="icon" disabled={timeSaving} onClick={handleDeleteStopwatch} className="h-7 w-7 text-sky-700 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" disabled={timeSaving} onClick={handleStartStopwatch} className="h-8 w-full border-slate-200 text-xs text-slate-600">
                        <Clock className="w-3.5 h-3.5 mr-2" /> Start stopwatch
                      </Button>
                    )}
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={manualTimeMinutes}
                        onChange={(event) => setManualTimeMinutes(event.target.value)}
                        placeholder="Minutes"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={manualTimeUser}
                        onChange={(event) => setManualTimeUser(event.target.value)}
                        placeholder="User"
                        className="h-8 text-xs"
                      />
                      <Button variant="outline" size="icon" disabled={timeSaving || !manualTimeMinutes.trim()} onClick={handleAddTrackedTime} className="h-8 w-8 border-slate-200">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {trackedTimes.slice(0, 5).map((trackedTime) => (
                        <div key={trackedTime.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-700">{formatDuration(trackedTime.time)}</div>
                            <div className="truncate text-[10px] text-slate-400">
                              {trackedTime.user_name || 'Unknown user'} · {trackedTime.created ? new Date(trackedTime.created).toLocaleDateString() : 'Tracked time'}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" disabled={timeSaving} onClick={() => handleDeleteTrackedTime(trackedTime.id)} className="h-6 w-6 shrink-0 text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {trackedTimes.length === 0 && <span className="text-xs text-slate-400 italic">No tracked time</span>}
                      {trackedTimes.length > 5 && <div className="text-[10px] text-slate-400">{trackedTimes.length - 5} more entries</div>}
                    </div>
                    {trackedTimes.length > 0 && (
                      <Button variant="ghost" size="sm" disabled={timeSaving} onClick={handleResetTrackedTimes} className="h-7 px-2 text-xs text-slate-400 hover:text-red-600">
                        Reset all tracked time
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attachments</span>
                    <label className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-sky-600">
                      <Paperclip className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingAttachment}
                        onChange={(event) => {
                          handleUploadAttachment(event.target.files?.[0]);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-lg border border-slate-200 bg-white p-2">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={attachment.browser_download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-sky-600"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{attachment.name}</span>
                          </a>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAttachment(attachment.id)} className="h-6 w-6 text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">{Math.ceil((attachment.size || 0) / 1024)} KB · {attachment.download_count || 0} downloads</div>
                      </div>
                    ))}
                    {attachments.length === 0 && <span className="text-xs text-slate-400 italic">No attachments</span>}
                    {uploadingAttachment && <div className="text-xs text-sky-600">Uploading...</div>}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
