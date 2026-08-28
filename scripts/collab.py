#!/usr/bin/env python3
"""Safe GitHub handoff workflow for Codex/ChatGPT collaboration."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import subprocess
import sys
from pathlib import Path

MAX_FILE_SIZE = 20 * 1024 * 1024
BRANCH_RE = re.compile(r"^task_(?P<id>[A-Za-z0-9-]+)_(?P<name>[a-z0-9][a-z0-9_-]*)$")


def run(*args: str, capture: bool = False) -> str:
    """Run git/gh visibly, stopping on any failed command."""
    result = subprocess.run(args, text=True, capture_output=capture)
    if result.returncode:
        if capture:
            sys.stderr.write(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout.strip() if capture else ""


def git(*args: str, capture: bool = False) -> str:
    return run("git", *args, capture=capture)


def require_repo() -> None:
    if git("rev-parse", "--is-inside-work-tree", capture=True) != "true":
        raise SystemExit("请在 Git 仓库根目录或其子目录中运行此命令。")


def current_branch() -> str:
    return git("branch", "--show-current", capture=True)


def ensure_clean() -> None:
    if git("status", "--porcelain", capture=True):
        raise SystemExit("工作区不干净。请先处理或提交已有改动，再创建任务分支。")


def branch_name(task_id: str, short_name: str) -> str:
    candidate = f"task_{task_id}_{short_name.lower()}"
    if not BRANCH_RE.fullmatch(candidate):
        raise SystemExit("任务编号仅可含字母、数字和 -；简短名仅可含小写字母、数字、_、-。")
    return candidate


def staged_files() -> list[Path]:
    output = git("diff", "--cached", "--name-only", "-z", capture=True)
    return [Path(item) for item in output.split("\0") if item]


def preflight() -> None:
    files = staged_files()
    if not files:
        raise SystemExit("暂存区为空。请先用 git add <相关文件> 明确选择要提交的文件。")
    too_large = [str(path) for path in files if path.exists() and path.stat().st_size > MAX_FILE_SIZE]
    print("将提交的文件：")
    for path in files:
        print(f"  - {path}")
    untracked = git("ls-files", "--others", "--exclude-standard", capture=True)
    if untracked:
        print("\n注意：发现未跟踪文件（不会自动提交）：")
        print(untracked)
    if too_large:
        raise SystemExit("拒绝提交超过 20 MB 的文件：\n" + "\n".join(too_large))
    print("\n预检通过。请确认上面的文件确实都属于当前任务。")


def task_from_branch() -> str:
    match = BRANCH_RE.fullmatch(current_branch())
    if not match:
        raise SystemExit("当前不在 task_<编号>_<简短名> 分支上。")
    return match.group("id")


def write_handoff(args: argparse.Namespace) -> None:
    task_id = args.task_id
    branch = current_branch()
    if not branch.startswith(f"task_{task_id}_"):
        raise SystemExit(f"当前分支 {branch} 与任务编号 {task_id} 不匹配。")
    committed = git("diff", "--name-status", "main...HEAD", capture=True)
    staged = git("diff", "--cached", "--name-status", capture=True)
    changed = "\n".join(part for part in (committed, staged) if part) or "（尚未发现相对 main 的改动）"
    status = git("status", "--short", capture=True) or "干净"
    target = Path("docs") / "handoff" / f"task_{task_id}_{dt.date.today().isoformat()}.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    text = f"""# Task {task_id} 交接单

- 日期：{dt.date.today().isoformat()}
- 分支：`{branch}`
- PR：{args.pr or "待创建"}

## 已完成

{args.done}

## 未完成 / 已知限制

{args.not_done}

## 下一步建议

{args.next}

## 相对 main 的变更文件

```text
{changed}
```

## 当前工作区状态

```text
{status}
```

## 测试

{args.tests}
"""
    target.write_text(text, encoding="utf-8")
    print(f"已写入交接单：{target}")


def create_pr(args: argparse.Namespace) -> None:
    task_from_branch()
    if not shutil.which("gh"):
        raise SystemExit("未找到 gh。请安装 GitHub CLI 并运行 gh auth login，或在 GitHub 网页手动创建 PR。")
    command = ["gh", "pr", "create", "--base", "main", "--head", current_branch(), "--title", args.title]
    if args.body:
        command.extend(["--body", args.body])
    run(*command)


def main() -> None:
    parser = argparse.ArgumentParser(description="Codex + ChatGPT GitHub 协作流程")
    commands = parser.add_subparsers(dest="command", required=True)
    start = commands.add_parser("start", help="更新 main 并创建任务分支")
    start.add_argument("task_id")
    start.add_argument("short_name")
    commands.add_parser("preflight", help="检查明确暂存的提交内容")
    commit = commands.add_parser("commit", help="预检并提交已暂存内容")
    commit.add_argument("task_id")
    commit.add_argument("message")
    commands.add_parser("push", help="推送当前任务分支")
    pr = commands.add_parser("pr", help="用 GitHub CLI 创建到 main 的 PR")
    pr.add_argument("--title", required=True)
    pr.add_argument("--body", default="")
    handoff = commands.add_parser("handoff", help="生成任务交接单")
    handoff.add_argument("task_id")
    handoff.add_argument("--done", required=True)
    handoff.add_argument("--not-done", default="无")
    handoff.add_argument("--next", default="等待 PR 审查")
    handoff.add_argument("--tests", default="未记录")
    handoff.add_argument("--pr", default="")
    args = parser.parse_args()
    require_repo()
    if args.command == "start":
        ensure_clean()
        name = branch_name(args.task_id, args.short_name)
        git("checkout", "main")
        git("pull", "--ff-only", "origin", "main")
        git("checkout", "-b", name)
    elif args.command == "preflight":
        preflight()
    elif args.command == "commit":
        if args.task_id != task_from_branch():
            raise SystemExit("任务编号与当前分支不匹配。")
        preflight()
        git("commit", "-m", f"task_{args.task_id}: {args.message}")
    elif args.command == "push":
        task_from_branch()
        git("push", "-u", "origin", current_branch())
    elif args.command == "pr":
        create_pr(args)
    elif args.command == "handoff":
        write_handoff(args)


if __name__ == "__main__":
    main()

