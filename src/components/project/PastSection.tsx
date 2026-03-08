import type { ProjectDetail } from '@/types';

type Props = {
  commits: ProjectDetail['commits'];
  claudeSessions: ProjectDetail['claude_sessions'];
};

export function PastSection({ commits, claudeSessions }: Props) {
  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h2 className="text-sm font-semibold">과거 — 커밋 이력</h2>
      </div>
      <div className="p-4">
        {commits.length === 0 ? (
          <p className="text-sm text-muted">커밋 이력이 없습니다</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {commits.map((commit) => (
              <div key={commit.hash} className="flex items-start gap-3 text-sm">
                <span className="text-[10px] font-mono text-muted bg-white/5 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  {commit.hash.slice(0, 7)}
                </span>
                <span className="flex-1 text-foreground">{commit.message}</span>
                <span className="text-xs text-muted shrink-0">{commit.relative_date}</span>
              </div>
            ))}
          </div>
        )}

        {claudeSessions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-muted mb-2">Claude Code 작업 이력</h3>
            <div className="space-y-1.5">
              {claudeSessions.slice(0, 5).map((session) => (
                <div key={session.id} className="text-xs text-muted flex items-start gap-2">
                  <span className="text-accent shrink-0">●</span>
                  <span className="flex-1 line-clamp-2">{session.first_message}</span>
                  {session.last_activity && (
                    <span className="shrink-0 text-[10px]">
                      {new Date(session.last_activity).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
