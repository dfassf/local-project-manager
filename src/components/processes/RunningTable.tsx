import Link from 'next/link';
import type { RunningProcess } from '@/types';

type Props = {
  processes: RunningProcess[];
  externalProcesses: RunningProcess[];
  actionLoading: string | null;
  onStop: (pid: number) => void;
};

export function RunningTable({ processes, externalProcesses, actionLoading, onStop }: Props) {
  const total = processes.length + externalProcesses.length;

  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">실행 중 ({total})</h2>
      </div>
      {total === 0 ? (
        <div className="p-8 text-center text-muted text-sm">
          실행 중인 dev 서버가 없습니다
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted border-b border-border">
              <th className="text-left px-4 py-2 font-medium">프로젝트</th>
              <th className="text-left px-4 py-2 font-medium">명령어</th>
              <th className="text-left px-4 py-2 font-medium">포트</th>
              <th className="text-left px-4 py-2 font-medium">PID</th>
              <th className="text-right px-4 py-2 font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {processes.map(proc => (
              <tr key={proc.pid} className="border-b border-border/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link
                    href={`/project/${proc.project_id}`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {proc.project_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted">{proc.command}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-success bg-success/10 px-1.5 py-0.5 rounded">
                    :{proc.port}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted">{proc.pid}</td>
                <td className="px-4 py-3 text-right">
                  {proc.is_managed ? (
                    <button
                      onClick={() => onStop(proc.pid)}
                      disabled={actionLoading === `stop-${proc.pid}`}
                      className="text-xs px-2 py-1 bg-danger/10 hover:bg-danger/20 text-danger rounded transition-colors disabled:opacity-50"
                    >
                      {actionLoading === `stop-${proc.pid}` ? '중지 중...' : '중지'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted bg-white/5 px-1.5 py-0.5 rounded">외부</span>
                  )}
                </td>
              </tr>
            ))}
            {externalProcesses.map(proc => (
              <tr key={proc.pid} className="border-b border-border/50 hover:bg-white/[0.02] opacity-60">
                <td className="px-4 py-3 text-sm text-muted">
                  {proc.cwd ? proc.cwd.split('/').slice(-2).join('/') : '알 수 없음'}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted">{proc.command}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-muted">:{proc.port}</span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted">{proc.pid}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] text-muted bg-white/5 px-1.5 py-0.5 rounded">외부</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
