import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content?: string | null;
  className?: string;
  emptyFallback?: string;
}

function extractLanguageFromClassName(className?: string): string | null {
  if (!className) {
    return null;
  }

  const match = className.match(/language-([\w-]+)/i);
  return match?.[1] ?? null;
}

export function MarkdownRenderer({ content, className, emptyFallback }: MarkdownRendererProps) {
  const source = content?.trim() ? content : (emptyFallback || '');

  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
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
            const hasFenceLanguage = Boolean(extractLanguageFromClassName(codeClassName));
            const hasHighlightClass = Boolean(codeClassName?.includes('hljs'));
            const hasMultilineContent = String(children).includes('\n');
            const inline = !(hasFenceLanguage || hasHighlightClass || hasMultilineContent);

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
          pre: ({ className: preClassName, children, ...props }) => {
            const childNodes = React.Children.toArray(children);
            const codeNode = childNodes.find(
              (node): node is React.ReactElement<{ className?: string }> =>
                React.isValidElement<{ className?: string }>(node) && node.type === 'code'
            );
            const codeClassName = String(codeNode?.props.className || '');
            const language = extractLanguageFromClassName(codeClassName);

            return (
              <div className={cn('markdown-code-block-wrap', language && 'has-language')}>
                {language ? (
                  <div className="markdown-code-block-header">
                    <span className="markdown-code-block-language">{language}</span>
                  </div>
                ) : null}
                <pre {...props} className={cn('markdown-code-block', preClassName)}>
                  {children}
                </pre>
              </div>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
