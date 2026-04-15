import React, { useState, useEffect } from 'react';
import { GiteaService, Issue, Comment } from '@/src/lib/gitea';
import { 
  MessageSquare, 
  CircleDot, 
  CheckCircle2, 
  User, 
  Clock, 
  Plus, 
  Search,
  ArrowLeft,
  Send
} from 'lucide-react';
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

  useEffect(() => {
    loadIssues();
    
    // Polling for issues list
    const interval = setInterval(async () => {
      if (!selectedIssue && !isCreating) {
        try {
          const data = await gitea.getIssues(owner, repo);
          setIssues(data);
        } catch (error) {
          console.error('Polling issues failed:', error);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [owner, repo, selectedIssue, isCreating]);

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
      const data = await gitea.getIssues(owner, repo);
      setIssues(data);
    } catch (error) {
      console.error('Failed to load issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIssueDetails = async (issue: Issue) => {
    setSelectedIssue(issue);
    setLoadingComments(true);
    try {
      const data = await gitea.getIssueComments(owner, repo, issue.number);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) return;
    try {
      const issue = await gitea.createIssue(owner, repo, {
        title: newIssueTitle,
        body: newIssueBody
      });
      setIssues([issue, ...issues]);
      setIsCreating(false);
      setNewIssueTitle('');
      setNewIssueBody('');
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

  const filteredIssues = issues.filter(issue => 
    issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.number.toString().includes(searchQuery)
  );

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
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search issues..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 bg-white border-slate-200 focus-visible:ring-sky-400"
              />
            </div>
            <Button onClick={() => setIsCreating(true)} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> New Issue
            </Button>
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
          <div className="p-8 max-w-3xl mx-auto w-full space-y-6">
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
            <div className="p-8 max-w-4xl mx-auto space-y-8">
              {/* Original Issue Body */}
              <div className="flex gap-4 items-start">
                <img src={selectedIssue.user.avatar_url} className="w-10 h-10 rounded-full border border-slate-200 shrink-0" alt="" />
                <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">{selectedIssue.user.login} <span className="text-slate-400 font-normal">commented on {new Date(selectedIssue.created_at).toLocaleDateString()}</span></span>
                  </div>
                  <div className="p-4 prose prose-slate prose-sm max-w-none">
                    <ReactMarkdown>{selectedIssue.body || '_No description provided._'}</ReactMarkdown>
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
                        </div>
                        <div className="p-4 prose prose-slate prose-sm max-w-none">
                          <ReactMarkdown>{comment.body}</ReactMarkdown>
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
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
