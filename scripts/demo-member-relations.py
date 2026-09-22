"""Generate the review inventory from the EF snapshot; no database access/dependencies."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "backend/src/Alife.Infrastructure/Persistence/Migrations/AlifeDbContextModelSnapshot.cs"
OUTPUT = ROOT / "scripts/demo-member-relations.md"


def inventory(source):
    entities = {}
    for name, body in re.findall(r'modelBuilder.Entity\("([^"]+)", b =>\s*\{(.*?)\n                \}\);', source, re.S):
        entity = entities.setdefault(name, {"columns": {}, "refs": {}})
        table = re.search(r'b.ToTable\("([^"]+)"', body)
        if table:
            entity["table"] = table[1]
        for typ, prop, chain in re.findall(r'b.Property<([^>]+)>\("([^"]+)"\)(.*?);', body, re.S):
            column = re.search(r'HasColumnName\("([^"]+)"\)', chain)
            if column:
                entity["columns"][prop] = (column[1], typ)
        for principal, chain in re.findall(r'b.HasOne\("([^"]+)"[^\n]*\)(.*?);', body, re.S):
            if principal == "Alife.Domain.Entities.Member":
                prop = re.search(r'HasForeignKey\("([^"]+)"\)', chain)
                action = re.search(r'OnDelete\(DeleteBehavior\.(\w+)\)', chain)
                if prop:
                    entity["refs"][prop[1]] = action[1] if action else "ClientSetNull (SQL NO ACTION)"
    rows = []
    for e in entities.values():
        for prop, (column, typ) in e["columns"].items():
            if prop in e["refs"] or ("Guid" in typ and (prop.endswith("MemberId") or prop == "MemberId")):
                rows.append((e["table"], column, e["refs"].get(prop, "逻辑引用（无 Member 外键）")))
    return sorted(rows)


def render(rows):
    return "\n".join([
        "# 虚拟成员关联清单", "",
        "来源：当前 EF migration snapshot；这是结构清单，不代表生产环境已有这些记录。",
        "清理脚本另行扫描目标数据库的实际外键、所有 GUID 列及文本中的 ID，输出实际命中行和阻断项。",
        "本表覆盖 Member 外键与按 MemberId 命名的逻辑引用；其他命名、JSON、外部缓存以运行检查为准。", "",
        f"共 {len(rows)} 个成员引用字段，涉及 {len(set(r[0] for r in rows))} 张表。", "",
        "| 表 | 字段 | EF 删除规则／引用类型 |", "|---|---|---|",
        *(f"| `{table}` | `{column}` | {action} |" for table, column, action in rows), "",
        "间接依赖由运行时外键检查覆盖；允许自动清理的个人附属链及保留策略见 [操作说明](cleanup-demo-members.md)。", "",
    ])


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rows = inventory(SNAPSHOT.read_text(encoding="utf-8-sig"))
    assert ("group_memberships", "member_id", "Cascade") in rows
    assert any(t == "event_task_approval_actions" and c == "actor_member_id" for t, c, _ in rows)
    result = render(rows)
    if args.check:
        assert OUTPUT.read_text(encoding="utf-8") == result, "Relationship inventory is stale"
    else:
        OUTPUT.write_text(result, encoding="utf-8")
    print(f"Verified {len(rows)} member reference columns across {len(set(r[0] for r in rows))} tables.")
