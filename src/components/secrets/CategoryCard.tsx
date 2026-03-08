export interface SecretFile {
  name: string;
  path: string;
  type: 'pem' | 'key' | 'pub' | 'json' | 'sh' | 'other';
  size: number;
  group?: string;
}

export interface TelegramBot {
  name: string;
  description: string;
  token: string;
  chatId: string;
  project?: string;
}

export interface SecretCard {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  tags: { label: string; color: string }[];
  instances?: { shape: string; ip?: string; ocpus?: number; memoryGb?: number; status?: string }[];
  files: SecretFile[];
  bots?: TelegramBot[];
}

const TYPE_COLORS: Record<string, string> = {
  pem: 'bg-danger/20 text-danger',
  key: 'bg-warning/20 text-warning',
  pub: 'bg-success/20 text-success',
  json: 'bg-accent/20 text-accent-hover',
  sh: 'bg-purple-500/20 text-purple-400',
  other: 'bg-muted/20 text-muted',
};

const TYPE_LABELS: Record<string, string> = {
  pem: 'PEM',
  key: 'PRIVATE',
  pub: 'PUBLIC',
  json: 'JSON',
  sh: 'SCRIPT',
  other: 'FILE',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function maskToken(token: string): string {
  if (token.length < 10) return '••••••';
  return token.slice(0, 6) + '••••' + token.slice(-4);
}

type Props = {
  card: SecretCard;
  onViewFile: (file: SecretFile) => void;
  onCopyText: (text: string) => void;
};

export function CategoryCard({ card, onViewFile, onCopyText }: Props) {
  // 파일을 group별로 분류
  const fileGroups = card.files.reduce<Record<string, SecretFile[]>>((acc, f) => {
    const g = f.group || '기타';
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {});

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="text-lg">{card.icon}</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{card.title}</h3>
          {card.subtitle && <p className="text-[10px] text-muted">{card.subtitle}</p>}
        </div>
        {card.tags.map((tag, i) => (
          <span key={i} className="px-2 py-0.5 bg-white/5 text-muted rounded text-[10px] font-mono">
            {tag.label}
          </span>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* 인스턴스 정보 */}
        {card.instances && card.instances.map((inst, i) => (
          <div key={i} className="flex items-center gap-2 text-xs bg-white/5 rounded px-3 py-2">
            <span className="text-foreground font-medium">{inst.shape}</span>
            {inst.ip && (
              <button
                onClick={() => onCopyText(inst.ip!)}
                className="text-accent hover:underline cursor-pointer"
              >
                {inst.ip}
              </button>
            )}
            {inst.ocpus && <span className="text-muted">{inst.ocpus}C / {inst.memoryGb}GB</span>}
            {inst.status && (
              <span className={inst.status === 'creating' ? 'text-warning' : 'text-success'}>
                {inst.status}
              </span>
            )}
          </div>
        ))}

        {/* 파일 (group별) */}
        {Object.entries(fileGroups).map(([groupName, files]) => (
          <div key={groupName}>
            <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">{groupName}</h4>
            <div className="space-y-1">
              {files.map(file => (
                <div
                  key={file.name}
                  className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-md group hover:bg-white/10 transition-colors"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[file.type]}`}>
                    {TYPE_LABELS[file.type]}
                  </span>
                  <code className="text-xs font-mono text-foreground flex-1 truncate">{file.name}</code>
                  <span className="text-[10px] text-muted">{formatBytes(file.size)}</span>
                  <button
                    onClick={() => onViewFile(file)}
                    className="text-[10px] text-muted hover:text-accent-hover opacity-0 group-hover:opacity-100 transition-all"
                  >
                    보기
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 텔레그램 봇 */}
        {card.bots && card.bots.map(bot => (
          <div key={bot.name} className="bg-white/5 rounded-md px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">@{bot.name}</span>
              {bot.project && (
                <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent-hover rounded">{bot.project}</span>
              )}
            </div>
            <p className="text-[11px] text-muted">{bot.description}</p>
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted pt-1">
              <button
                onClick={() => onCopyText(bot.token)}
                className="hover:text-accent-hover transition-colors cursor-pointer"
                title="토큰 복사"
              >
                token: {maskToken(bot.token)}
              </button>
              {bot.chatId && (
                <button
                  onClick={() => onCopyText(bot.chatId)}
                  className="hover:text-accent-hover transition-colors cursor-pointer"
                  title="Chat ID 복사"
                >
                  chat: {bot.chatId}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
