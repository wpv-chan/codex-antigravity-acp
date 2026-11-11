# Codex Antigravity ACP

在 Codex 里邀请 **Gemini 4 Carbon High** 独立评审方案，并在同一议题下连续追问。这个本地 MCP 服务把 Codex 的 `discuss` 调用交给 Google 官方的 `agy acp`，复用使用者自己的 Antigravity 登录状态。

```text
Codex (CLI / 桌面端) ──stdio MCP──> server.mjs ──ACP v1──> agy acp ──> Google Antigravity
```

每次发问前，服务都会核对 ACP 会话的模型 `gemini-4-carbon` 与推理档位 `thought_level=high`。两项都匹配后才发送问题。

配套的 **Gemini Skill** 提供桌面端 `/Gemini` 快捷入口，也支持“让 Gemini 看看这个方案”这样的自然语言。

## 测试环境

已在 Windows 上使用 PowerShell、Node.js `26.13.0` 和 Antigravity CLI `1.5.5` 完成实测。当前实现使用 Windows 命名管道为每个讨论加锁。下面的命令需要本机已安装 Git、Node.js/npm、Antigravity CLI 和 Codex CLI。CLI 注册的 MCP 服务也可在同机的 Codex 桌面端使用。

## 快速开始

### 1. 检查登录与可用模型

在 Windows PowerShell 中检查 `agy acp` 命令并查看当前账号可见模型。

```powershell
agy acp --help
agy models
```

确认输出列表包含 `gemini-4-carbon-high`。若尚未登录，先运行 `agy acp --login` 完成登录，再重新执行 `agy models` 核对。

### 2. 获取仓库并安装依赖

```powershell
git clone https://github.com/wpv-chan/codex-antigravity-acp.git
Set-Location codex-antigravity-acp
npm.cmd ci --ignore-scripts
```

### 3. 注册本地 MCP 服务

```powershell
$nodeExe = (Get-Command node.exe).Source
$agyExe = (Get-Command agy.exe).Source
$bridge = (Resolve-Path .\server.mjs).Path
codex mcp add antigravity -- $nodeExe $bridge $agyExe
```

### 4. 配置超时时间

打开 `~/.codex/config.toml`，找到上一步生成的 `[mcp_servers.antigravity]` 段，在同一段中加入两行，为 High 档位的回复留出时间。

```toml
startup_timeout_sec = 30
tool_timeout_sec = 600
```

### 5. 核对与移除

运行以下命令核对登记信息，或在 Codex 客户端输入 `/mcp` 查看状态。后续如需移除注册，可执行 `codex mcp remove antigravity`。

```powershell
codex mcp get antigravity
```

### 6. 安装 Gemini 快捷入口

在仓库根目录运行下面的 PowerShell 命令，把配套 Skill 安装到当前用户的 Codex 技能目录。

```powershell
$codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$skillsDir = Join-Path $codexDir 'skills'
$target = Join-Path $skillsDir 'gemini'
if (Test-Path -LiteralPath $target) { throw "已有同名 Skill，请先核对目录 $target" }
New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
Copy-Item -LiteralPath .\skills\gemini -Destination $target -Recurse
```

- **Codex 桌面端**　在聊天框输入 `/Gemini`，选中候选项 **Gemini**，接着输入问题。以 `/Gemini` 开头的整行聊天文本也可触发同一 Skill。
- **Codex CLI**　输入 `$gemini 你的问题`，或通过 `/skills` 选择 **Gemini**。
- **自然语言**　直接说“让 Gemini 评审这个方案”或“你和 Gemini 一起探讨”。同一议题可以交替使用快捷入口和自然语言追问。

Codex 会自动发现新安装的 Skill。若当前窗口尚未显示候选项，可重启 Codex 后再次打开菜单。[Codex 桌面斜杠菜单](https://learn.chatgpt.com/docs/app/slash-commands) · [Codex Skills 文档](https://learn.chatgpt.com/docs/build-skills)

## 提问与追问

在 Codex 桌面端用快捷入口发起一次方案评审。

```text
/Gemini 商品价格缓存十分钟，促销新价要立即生效，缓存策略该怎么设计？
```

收到首轮回复后，可在同一议题下继续追问。

```text
继续问 Gemini，如果价格更新时主动删除缓存，哪些并发时序还可能把旧值写回？
```

通过 MCP 调用时，追问要带上首轮返回的 `discussion_id`。省略该字段会开启独立讨论。

## 工具契约

`antigravity` 服务的 `discuss` 工具输入参数与返回字段如下。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `question` | 非空字符串 | 是 | 提交讨论的问题正文以及需要分享的背景信息 |
| `discussion_id` | 字符串 | 否 | 上次返回的 UUID，传入可延续原议题，省略则新建讨论 |

| 返回字段 | 说明 |
| --- | --- |
| `model` | 当前会话生效的模型标识 |
| `thinking_level` | 当前会话生效的思考等级 |
| `discussion_id` | 当前讨论的 UUID，供后续追问传入 |
| `reply` | 代理返回的回复正文 |

## 数据、隔离与排错

- **发送的内容**由 `question` 给出。把想分享的背景或代码片段写进提问，这些文本由 Google 处理。子进程在专用的 `workspace/` 下运行，讨论角色配置为 `tools: []`，连接器会取消 ACP 权限请求。
- **会话记录**由 Antigravity 管理。本地 `sessions/` 仅保存讨论 ID 到 ACP 会话 ID 的映射，继续旧议题时需要保留这份映射。
- **会话忙**表示同一 `discussion_id` 已有一轮正在进行。等该轮结束后再重试。
- **模型校验失败**时，运行 `agy models` 确认当前账号可见 `gemini-4-carbon-high`。**调用超时**时，运行 `codex mcp get antigravity` 核对 `tool_timeout_sec` 是否为 `600`。

## 参考文档

- [Antigravity CLI ACP 文档](https://antigravity.google/docs/cli/acp/)
- [Antigravity 模型文档](https://antigravity.google/docs/models)
- [OpenAI Codex MCP 文档](https://developers.openai.com/codex/mcp/)
