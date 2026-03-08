'use client';

import { useState, useEffect } from 'react';
import { CategoryCard, type SecretCard, type SecretFile } from '@/components/secrets/CategoryCard';
import { FileViewModal } from '@/components/secrets/FileViewModal';

export default function SecretsPage() {
  const [cards, setCards] = useState<SecretCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/secrets')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setCards(data);
        setLoading(false);
      });
  }, []);

  const handleView = async (file: SecretFile) => {
    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: file.path }),
    });
    if (res.ok) {
      const { content } = await res.json();
      setViewingFile({ name: file.name, content });
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setToast('복사됨');
    setTimeout(() => setToast(null), 1500);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">키 관리</h1>
        <p className="text-sm text-muted">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">키 관리</h1>
          <p className="text-xs text-muted mt-1">API 키, PEM 파일, SSH 키, 인증 정보</p>
        </div>
        <div className="text-[10px] text-muted bg-card border border-border rounded px-2 py-1">
          <code>.secrets/</code>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted">.secrets/ 디렉토리에 파일이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map(card => (
            <CategoryCard
              key={card.id}
              card={card}
              onViewFile={handleView}
              onCopyText={handleCopy}
            />
          ))}
        </div>
      )}

      {viewingFile && (
        <FileViewModal
          name={viewingFile.name}
          content={viewingFile.content}
          onClose={() => setViewingFile(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-success/90 text-white text-xs px-3 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
