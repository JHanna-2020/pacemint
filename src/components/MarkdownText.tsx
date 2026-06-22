import { Fragment, ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);

  return (
    <div className="markdown-text">
      {lines.map((line, index) => {
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);

        if (bullet) {
          return (
            <p className="markdown-list-line" key={index}>
              <span aria-hidden="true">•</span>
              <span>{renderInline(bullet[1])}</span>
            </p>
          );
        }

        if (numbered) {
          return (
            <p className="markdown-list-line" key={index}>
              <span aria-hidden="true">{line.trim().split(/[.)]/)[0]}.</span>
              <span>{renderInline(numbered[1])}</span>
            </p>
          );
        }

        return line.trim() ? <p key={index}>{renderInline(line)}</p> : <br key={index} />;
      })}
    </div>
  );
}
