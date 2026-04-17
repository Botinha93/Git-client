import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Github, Server, ShieldCheck } from 'lucide-react';
import { AppIcon } from './AppIcon';

interface AuthProps {
  giteaConfigured: boolean;
  baseUrl: string | null;
}

export function Auth({ giteaConfigured, baseUrl }: AuthProps) {
  const searchParams = new URLSearchParams(window.location.search);
  const authError = searchParams.get('authError');
  const instanceLabel = baseUrl || 'your configured Gitea instance';

  function startLogin() {
    const redirectParams = new URLSearchParams(window.location.search);
    redirectParams.delete('authError');
    const redirectSearch = redirectParams.toString();
    const redirectTo = `${window.location.pathname}${redirectSearch ? `?${redirectSearch}` : ''}` || '/';
    window.location.assign(`/api/auth/gitea/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <Card className="w-full max-w-md border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-900 text-slate-50 p-8">
          <div className="flex items-center gap-3 mb-2">
            <AppIcon className="h-8 w-8 rounded-md" />
            <CardTitle className="text-2xl font-bold">GitFlow</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">
            Sign in with your Gitea account to use the workspace through the backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6 bg-white">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <Server className="mt-0.5 h-4 w-4 text-sky-600" />
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gitea Instance</div>
                <div className="text-sm font-medium text-slate-900 break-all">{instanceLabel}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4" />
              <div>
                Access tokens stay on the server. Developers authenticate with their own Gitea account and the browser only keeps a session cookie.
              </div>
            </div>
          </div>

          {authError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div>
                  {authError === 'oauth_failed' ? 'Gitea sign-in failed. Check the backend OAuth settings and try again.' : 'The sign-in attempt expired or was invalid. Please try again.'}
                </div>
              </div>
            </div>
          )}

          {!giteaConfigured && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Configure `GITEA_BASE_URL`, `GITEA_OAUTH_CLIENT_ID`, `GITEA_OAUTH_CLIENT_SECRET`, and `APP_BASE_URL` on the server to enable developer sign-in.
            </div>
          )}
        </CardContent>
        <CardFooter className="p-8 pt-0 bg-white">
          <Button
            onClick={startLogin}
            disabled={!giteaConfigured}
            className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold h-11 transition-all shadow-md active:scale-[0.98]"
          >
            <Github className="mr-2 h-4 w-4" />
            Continue With Gitea
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
