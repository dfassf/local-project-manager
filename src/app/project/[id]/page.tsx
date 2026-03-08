'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import type { ProjectDetail } from '@/types';
import { PastSection } from '@/components/project/PastSection';
import { PresentSection } from '@/components/project/PresentSection';
import { FutureSection } from '@/components/project/FutureSection';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ status: string; nextSteps: string[] } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('조회 실패');
      setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await fetch(`/api/projects/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNote }),
    });
    setNewNote('');
    fetchData();
  };

  const handleDeleteNote = async (noteId: number) => {
    await fetch(`/api/projects/${id}/notes?note_id=${noteId}`, { method: 'DELETE' });
    fetchData();
  };

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      });
      if (res.ok) {
        setAiResult(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted">
        불러오는 중...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen text-muted">
        프로젝트를 찾을 수 없습니다
      </div>
    );
  }

  const { project, commits, branches, uncommitted_changes, todos, notes, ai_summaries, claude_sessions, process_status } = data;
  const isRunning = !!process_status;
  const cachedStatus = ai_summaries.find(s => s.summary_type === 'status');
  const cachedSteps = ai_summaries.find(s => s.summary_type === 'next_steps');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/" className="text-xs text-muted hover:text-foreground mb-2 inline-block">
            ← 대시보드로
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.display_name || project.name}</h1>
            {isRunning && (
              <span className="text-xs font-mono text-success bg-success/10 px-2 py-1 rounded">
                실행 중 :{process_status.port}
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1">
            {project.project_type} · {project.group_name} · {project.path}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <PastSection commits={commits} claudeSessions={claude_sessions} />
        <PresentSection
          branches={branches}
          uncommittedChanges={uncommitted_changes}
          todos={todos}
          cachedStatus={cachedStatus}
          aiLoading={aiLoading}
          aiResult={aiResult}
          onAiAnalyze={handleAiAnalyze}
        />
        <FutureSection
          notes={notes}
          newNote={newNote}
          onNewNoteChange={setNewNote}
          onAddNote={handleAddNote}
          onDeleteNote={handleDeleteNote}
          aiResult={aiResult}
          cachedSteps={cachedSteps}
        />
      </div>
    </div>
  );
}
