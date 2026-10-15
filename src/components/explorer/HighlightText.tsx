import React, { memo } from 'react';

interface HighlightTextProps {
  text: string | number | null | undefined;
  query?: string;
  className?: string;
}

export const HighlightText = memo(function HighlightText({
  text,
  query,
  className = '',
}: HighlightTextProps) {
  if (text === null || text === undefined || text === '') {
    return <span className={className}>-</span>;
  }

  const str = String(text);
  if (!query || !query.trim()) {
    return <span className={className}>{str}</span>;
  }

  // Split query terms by whitespace to support multi-word search
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) {
    return <span className={className}>{str}</span>;
  }

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = str.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
        return isMatch ? (
          <mark
            key={index}
            className="bg-amber-300/35 text-foreground dark:bg-amber-400/30 dark:text-amber-200 font-semibold px-0.5 rounded-xs"
          >
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </span>
  );
});
