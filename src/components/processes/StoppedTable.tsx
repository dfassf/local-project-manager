import Link from 'next/link';

interface StoppedConfig {
  id: number;
  project_id: string;
  project_name: string;
  command: string;
  port: number | null;
}

type Props = {
  configs: StoppedConfig[];
  actionLoading: string | null;
  onStart: (configId: number) => void;
};

export function StoppedTable({ configs, actionLoading, onStart }: Props) {
  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">중지됨 ({configs.length})</h2>
      </div>
      {configs.length === 0 ? (
        <div className="p-8 text-center text-muted text-sm">
          모든 프로젝트가 실행 중이거나 dev 명령어가 설정되지 않았습니다
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted border-b border-border">
              <th className="text-left px-4 py-2 font-medium">프로젝트</th>
              <th className="text-left px-4 py-2 font-medium">명령어</th>
              <th className="text-left px-4 py-2 font-medium">예상 포트</th>
              <th className="text-right px-4 py-2 font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(config => (
              <tr key={config.project_id} className="border-b border-border/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link
                    href={`/project/${config.project_id}`}
                    className="text-sm font-medium text-foreground hover:text-accent"
                  >
                    {config.project_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted">{config.command}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted">
                  {config.port ? `:${config.port}` : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onStart(config.id)}
                    disabled={!!actionLoading}
                    className="text-xs px-2 py-1 bg-success/10 hover:bg-success/20 text-success rounded transition-colors disabled:opacity-50"
                  >
                    시작
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
