import type { ProjectDetail, AISummary } from '@/types';

type Props = {
  branches: ProjectDetail['branches'];
  uncommittedChanges: ProjectDetail['uncommitted_changes'];
  todos: ProjectDetail['todos'];
  cachedStatus: AISummary | undefined;
  aiLoading: boolean;
  aiResult: { status: string; nextSteps: string[] } | null;
  onAiAnalyze: () => void;
};

export function PresentSection({
  branches, uncommittedChanges, todos,
  cachedStatus, aiLoading, aiResult, onAiAnalyze,
}: Props) {
  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h2 className="text-sm font-semibold">현재 — 프로젝트 상태</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* 브랜치 & 변경사항 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold text-muted mb-2">브랜치</h3>
            <div className="space-y-1">
              {branches.map(b => (
                <div key={b.name} className={`text-sm ${b.current ? 'text-accent font-medium' : 'text-muted'}`}>
                  {b.current ? '→ ' : '  '}{b.name}
                  <span className="text-[10px] text-muted ml-2">{b.last_commit}</span>
                </div>
              ))}
              {branches.length === 0 && <p className="text-sm text-muted">Git 정보 없음</p>}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted mb-2">
              미커밋 변경 ({uncommittedChanges.length}건)
            </h3>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {uncommittedChanges.map((change, i) => (
                <div key={i} className="text-xs font-mono text-muted">
                  <span className={
                    change.startsWith(' M') ? 'text-warning' :
                    change.startsWith('??') ? 'text-muted' :
                    change.startsWith('A') ? 'text-success' : ''
                  }>{change}</span>
                </div>
              ))}
              {uncommittedChanges.length === 0 && (
                <p className="text-xs text-muted">클린 상태</p>
              )}
            </div>
          </div>
        </div>

        {/* TODO 목록 */}
        {todos.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted mb-2">코드 내 TODO ({todos.length}건)</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {todos.slice(0, 10).map((todo, i) => (
                <div key={i} className="text-xs flex gap-2">
                  <span className={`shrink-0 font-mono ${
                    todo.type === 'FIXME' ? 'text-danger' :
                    todo.type === 'HACK' ? 'text-warning' : 'text-accent'
                  }`}>{todo.type}</span>
                  <span className="text-muted shrink-0">{todo.file}:{todo.line}</span>
                  <span className="text-foreground">{todo.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI 현황 분석 */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted">AI 현황 분석</h3>
            <button
              onClick={onAiAnalyze}
              disabled={aiLoading}
              className="text-[10px] px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded transition-colors disabled:opacity-50"
            >
              {aiLoading ? '분석 중...' : cachedStatus ? '재분석' : '분석 요청'}
            </button>
          </div>
          {(aiResult?.status || cachedStatus) ? (
            <p className="text-sm text-foreground bg-white/5 p-3 rounded">
              {aiResult?.status || cachedStatus?.content}
            </p>
          ) : (
            <p className="text-xs text-muted">AI 분석 버튼을 눌러 현재 상태를 요약해보세요</p>
          )}
        </div>
      </div>
    </section>
  );
}
