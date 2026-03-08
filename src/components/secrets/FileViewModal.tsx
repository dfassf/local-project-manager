'use client';

import { useState } from 'react';

type Props = {
  name: string;
  content: string;
  onClose: () => void;
};

export function FileViewModal({ name, content, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <code className="text-sm font-mono text-accent-hover">{name}</code>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded transition-colors"
            >
              {copied ? '복사됨' : '복사'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-auto flex-1 whitespace-pre-wrap break-all">
          {content}
        </pre>
      </div>
    </div>
  );
}
