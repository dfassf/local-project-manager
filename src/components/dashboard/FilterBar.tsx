type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  groups: string[];
};

export function FilterBar({
  search, onSearchChange,
  groupFilter, onGroupFilterChange,
  statusFilter, onStatusFilterChange,
  groups,
}: Props) {
  return (
    <div className="flex gap-3 mb-6">
      <input
        type="text"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="프로젝트 검색..."
        className="flex-1 px-3 py-2 bg-card border border-border rounded-md text-sm placeholder:text-muted focus:outline-none focus:border-accent"
      />
      <select
        value={groupFilter}
        onChange={e => onGroupFilterChange(e.target.value)}
        className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-accent"
      >
        <option value="all">전체 그룹</option>
        {groups.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={e => onStatusFilterChange(e.target.value)}
        className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-accent"
      >
        <option value="all">전체 상태</option>
        <option value="running">실행 중</option>
        <option value="stopped">중지됨</option>
      </select>
    </div>
  );
}
