import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Github, Key, Link as LinkIcon } from 'lucide-react';

interface AuthProps {
  onLogin: (baseUrl: string, token: string) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [baseUrl, setBaseUrl] = useState('https://gitea.com');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (baseUrl && token) {
      onLogin(baseUrl, token);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <Card className="w-full max-w-md border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-900 text-slate-50 p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-indigo-400 rounded-md" />
            <CardTitle className="text-2xl font-bold">GitFlow</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">
            Connect to your Gitea instance to manage repositories.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6 bg-white">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5" /> Instance URL
            </label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://gitea.com"
              className="border-slate-200 rounded-lg focus-visible:ring-sky-400/20 focus-visible:border-sky-400 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Key className="w-3.5 h-3.5" /> Personal Access Token
            </label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your Gitea token"
              className="border-slate-200 rounded-lg focus-visible:ring-sky-400/20 focus-visible:border-sky-400 transition-all"
            />
          </div>
        </CardContent>
        <CardFooter className="p-8 pt-0 bg-white">
          <Button
            onClick={handleSubmit}
            className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold h-11 transition-all shadow-md active:scale-[0.98]"
          >
            Authenticate
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
