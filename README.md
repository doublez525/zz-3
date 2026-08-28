# Codex + ChatGPT 协作工作流

这是一个不依赖「在两个 AI 之间搬文件」的 GitHub 协作脚手架。它把代码交付的事实来源放在 GitHub：Codex 在任务分支上提交并创建 PR；ChatGPT 依据 PR diff 和交接单审查；你只需要决定合并或打回。

## 角色边界

| 角色 | 负责什么 |
| --- | --- |
| ChatGPT | 拆解任务、审查 PR、给出是否合并及修改意见 |
| Codex | 拉取代码、在任务分支实现、测试、提交、推送、写 handoff |
| GitHub | 保存提交、PR、diff、讨论和审查记录 |
| 你 | 确认范围、处理冲突、批准或关闭 PR |

## 快速开始

要求：Git；如需自动建 PR，再安装并登录 [GitHub CLI](https://cli.github.com/)（`gh auth login`）。

将本目录的 `scripts/collab.py` 放到目标仓库后，在仓库根目录运行：

```powershell
# 1. 从 origin/main 更新，并创建 task_123_login_page
python scripts/collab.py start 123 login_page

# 2. 在该分支完成代码和测试，先生成交接单
python scripts/collab.py handoff 123 --done "完成登录页与测试" --not-done "未接入真实 SSO" --next "审查表单错误提示和无障碍性" --tests "python -m pytest"

# 3. 只暂存确认过的代码和交接单
git status
git add src/login.py tests/test_login.py docs/handoff/task_123_YYYY-MM-DD.md

# 4. 检查暂存区（不会执行 git add .）
python scripts/collab.py preflight

# 5. 提交、推送并创建目标为 main 的 PR
python scripts/collab.py commit 123 "add login page"
python scripts/collab.py push
python scripts/collab.py pr --title "task_123: add login page"

# 6. 将 gh 输出的 PR 链接发给 ChatGPT 审查
```

`start` 会拒绝在工作区有未提交改动时切分支；`preflight` 会列出所有暂存文件，拒绝超大文件（默认 20 MB）并提示未跟踪文件。`commit` 不会自动暂存任何文件，必须先明确执行 `git add <文件>`。

## 给 ChatGPT 的审查提示词

把 PR 链接和以下提示一起提供给 ChatGPT：

```text
请审查这个 PR：<PR_URL>。
先读 docs/handoff/ 中本任务的交接单，再看 PR 的 Files changed。
请检查：
1. 是否只修改了实现此任务必需的文件；
2. 逻辑、错误处理、测试和安全性是否有问题；
3. 交接单中的「未完成」和「下一步」是否准确。
输出按严重程度排序的问题（文件和行号）；若没有阻塞项，明确写“可以合并”。
```

## Handoff 格式

交接单固定写到 `docs/handoff/task_<编号>_<日期>.md`，包括变更文件、已完成、未完成、后续建议、测试状态和 PR 链接。交接单应在提交前生成并随 PR 一起提交；创建 PR 后可选地补上链接再提交一次。它是下一轮 Codex 任务和 PR 审查共同读取的上下文，而不是另一个需要人工搬运的附件。

## 建议的 PR 检查清单

- [ ] 分支名为 `task_<编号>_<简短名>`，PR base 是 `main`
- [ ] `git status` 干净，且没有误提交大文件、密钥或构建产物
- [ ] 已运行与改动匹配的测试
- [ ] 已写入 `docs/handoff/`
- [ ] ChatGPT 已审查 PR，负责人已决定合并或打回


## 阻塞项修复闭环

PR 审查不是只给出“可以合并”或“暂不合并”的结论。审查方发现阻塞项后，应按以下循环处理：

1. 在 PR 内按严重程度列出问题，并标明文件和行号。
2. 若审查方拥有 PR 分支写入权限，且修复无需额外产品、授权或安全决策，直接在该分支修复。
3. 运行与改动相称的验证，再重新审查该 PR。
4. 将每轮发现、修复、验证结果和剩余风险写入 `docs/review/`。
5. 仅当复审不存在阻塞项时，明确写“可以合并”。

如果修复需要用户决定范围、提供凭据/素材、批准对外操作，或缺少写入权限，必须说明具体阻塞条件；其他可直接修复的问题仍应继续处理。

## 审查记录格式

每个 PR 至少保留一份 `docs/review/pr_<编号>_review.md`，包含：

- 审查范围与交接单读取情况；
- 按严重程度列出的问题；
- 每轮实际改动及其原因；
- 验证命令或手工验证步骤与结果；
- 未解决风险，以及最终“可以合并”或阻塞结论。
