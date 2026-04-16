import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content?: string | null;
  className?: string;
  emptyFallback?: string;
}

export function MarkdownRenderer({ content, className, emptyFallback }: MarkdownRendererProps) {
  const source = content?.trim() ? content : (emptyFallback || '');

  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ className: linkClassName, ...props }) => (
            <a
              {...props}
              className={cn('markdown-link', linkClassName)}
              target={props.href?.startsWith('#') ? undefined : '_blank'}
              rel={props.href?.startsWith('#') ? undefined : 'noreferrer'}
            />
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const inline = !codeClassName;
            if (inline) {
              return (
                <code {...props} className="markdown-inline-code">
                  {children}
                </code>
              );
            }

            return (
              <code {...props} className={cn('markdown-code-block-code', codeClassName)}>
                {children}
              </code>
            );
          },
          pre: ({ className: preClassName, ...props }) => (
            <pre {...props} className={cn('markdown-code-block', preClassName)} />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
