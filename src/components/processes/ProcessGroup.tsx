import Link from 'next/link';

export interface ProcessEntry {
  config_id: number;
  project_id: string;
  project_name: string;
  command: string;
  port: number | null;
  // 실행 중인 경우
  running?: {
    pid: number;
    port: number;
    command: string;
    is_managed: boolean;
  };
}

type Props = {
  group: string;
  entries: ProcessEntry[];
  actionLoading: string | null;
  onStart: (configId: number) => void;
  onStop: (pid: number) => void;
};

export function ProcessGroup({ group, entries, actionLoading, onStart, onStop }: Props) {
  const runningCount = entries.filter(e => e.running).length;

  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {group}
        </h2>
        <span className="text-[10px] text-muted">
          {runningCount}/{entries.length} 실행 중
        </span>
      </div>

      <div className="divide-y divide-border/50">
        {entries.map(entry => (
          <div
            key={entry.config_id}
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${
              !entry.running ? 'opacity-50' : ''
            }`}
          >
            {/* 상태 표시 */}
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              entry.running ? 'bg-success' : 'bg-muted/40'
            }`} />

            {/* 프로젝트명 */}
            <Link
              href={`/project/${entry.project_id}`}
              className="text-sm font-medium text-foreground hover:text-accent min-w-[140px] truncate"
            >
              {entry.project_name}
            </Link>

            {/* 명령어 */}
            <span className="text-xs font-mono text-muted truncate flex-1">
              {entry.running ? entry.running.command : entry.command.split(' ')[0]}
            </span>

            {/* 포트 */}
            <span className={`text-xs font-mono min-w-[60px] text-right ${
              entry.running ? 'text-success' : 'text-muted'
            }`}>
              {entry.running ? `:${entry.running.port}` : entry.port ? `:${entry.port}` : '-'}
            </span>

            {/* PID */}
            <span className="text-xs font-mono text-muted min-w-[50px] text-right">
              {entry.running ? entry.running.pid : ''}
            </span>

            {/* 액션 */}
            <div className="min-w-[70px] flex justify-end items-center gap-1.5">
              {entry.running ? (
                <>
                  {!entry.running.is_managed && (
                    <span className="text-[10px] text-muted bg-white/5 px-1.5 py-0.5 rounded">외부</span>
                  )}
                  <button
                    onClick={() => onStop(entry.running!.pid)}
                    disabled={actionLoading === `stop-${entry.running!.pid}`}
                    className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                      entry.running.is_managed
                        ? 'bg-danger/10 hover:bg-danger/20 text-danger'
                        : 'bg-white/5 hover:bg-danger/10 text-muted hover:text-danger'
                    }`}
                  >
                    {actionLoading === `stop-${entry.running!.pid}` ? '중지 중...' : '중지'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onStart(entry.config_id)}
                  disabled={!!actionLoading}
                  className="text-xs px-2 py-1 bg-success/10 hover:bg-success/20 text-success rounded transition-colors disabled:opacity-50"
                >
                  시작
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
