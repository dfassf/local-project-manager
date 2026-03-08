import type { ProjectDetail, AISummary } from '@/types';

type Props = {
  notes: ProjectDetail['notes'];
  newNote: string;
  onNewNoteChange: (value: string) => void;
  onAddNote: () => void;
  onDeleteNote: (noteId: number) => void;
  aiResult: { status: string; nextSteps: string[] } | null;
  cachedSteps: AISummary | undefined;
};

export function FutureSection({
  notes, newNote, onNewNoteChange, onAddNote, onDeleteNote,
  aiResult, cachedSteps,
}: Props) {
  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h2 className="text-sm font-semibold">미래 — 계획 & 메모</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* 메모 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={e => onNewNoteChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAddNote()}
            placeholder="새 메모 추가... (Enter로 저장)"
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={onAddNote}
            className="px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-md transition-colors"
          >
            추가
          </button>
        </div>

        {/* 메모 목록 */}
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="flex items-start gap-2 bg-white/5 p-3 rounded group">
              <span className="text-accent text-xs mt-0.5">■</span>
              <p className="flex-1 text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              <button
                onClick={() => onDeleteNote(note.id)}
                className="text-xs text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                삭제
              </button>
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-xs text-muted">아직 메모가 없습니다. 위에 입력해보세요!</p>
          )}
        </div>

        {/* AI 다음 단계 추천 */}
        {(aiResult?.nextSteps?.length || cachedSteps) && (
          <div className="pt-3 border-t border-border">
            <h3 className="text-xs font-semibold text-muted mb-2">AI 추천 다음 단계</h3>
            <div className="space-y-1.5">
              {(aiResult?.nextSteps || cachedSteps?.content.split('\n').filter(Boolean) || []).map((step, i) => (
                <div key={i} className="text-sm flex gap-2">
                  <span className="text-accent shrink-0">{i + 1}.</span>
                  <span className="text-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
