# Codex Antigravity ACP

在 Codex 里邀请 **Gemini 4 Carbon High** 独立评审方案，并在同一议题下连续追问。本项目是社区维护的非官方 MCP 连接器，通过 Google 官方的 `agy acp` 传递问题和回复。

> [!WARNING]
> **请避免使用个人 Antigravity 订阅额度运行这套 Codex 工作流。** 即使手动输入 `/Gemini`，也是 Codex 发起工具调用、接收回复，并可能继续追问。将个人登录用于这种第三方代理编排，有违反 Antigravity 附加条款第 6 条的风险。Google 建议第三方编码代理使用 Google AI Studio API key 或 Gemini Enterprise。[Google Antigravity 条款](https://antigravity.google/terms) · [官方 FAQ](https://antigravity.google/docs/faq)
>
> **使用后果由使用者自行承担**，包括调用费用、向 Google 发送代码或资料带来的数据披露风险，以及违规可能导致的 Antigravity 或 Gemini CLI 服务暂停或终止。启用前，请确认账号、用途和拟提交的数据符合适用条款及所在组织的政策。

```text
Codex (CLI / 桌面端) ──stdio MCP──> server.mjs ──ACP v1──> agy acp ──> Google Antigravity
```

每次发问前，连接器都会核对 ACP 会话的模型 `gemini-4-carbon` 和推理档位 `thought_level=high`。认证由本机 `agy` 管理，它可能复用缓存的登录凭据。实际使用的凭据和计费项目须由使用者另行确认。[Google ACP 认证说明](https://antigravity.google/docs/ide/extensions/acp#authentication)

配套的 **Gemini Skill** 提供桌面端 `/Gemini` 快捷入口，也支持“让 Gemini 看看这个方案”这样的自然语言。

## 测试环境

已在 Windows 上使用 PowerShell、Node.js `26.13.0` 和 Antigravity CLI `1.5.5` 验证连接、模型档位校验和跨轮追问。API key 和企业凭据下的 Carbon High 端到端运行仍待验证。当前实现使用 Windows 命名管道为每个讨论加锁。下面的命令需要本机已安装 Git、Node.js/npm、Antigravity CLI 和 Codex CLI。CLI 注册的 MCP 服务也可在同机的 Codex 桌面端使用。

## 快速开始

### 1. 确认认证方式与可用模型

先在官方 Antigravity CLI 中配置并核对适用于第三方代理的身份。

- **Google AI Studio API key**　在本机 `~/.gemini/antigravity-cli/settings.json` 中将 `modelProvider` 设为 `gemini`，并在启动 Codex 的环境中提供 `GEMINI_API_KEY`。打开官方 CLI，确认界面显示 `Gemini API key`，再核对密钥所属的计费项目。[Google API key 认证指引](https://antigravity.google/docs/install)
- **Gemini Enterprise**　使用管理员已授权用于此工作流的企业身份和项目。请按组织指引确认适用协议、使用权限和计费归属。[Google 认证文档](https://antigravity.google/docs/install)

在同一环境下用 PowerShell 检查 ACP 命令和当前身份可用的模型。

```powershell
agy acp --help
agy models
```

确认输出列表包含 `gemini-4-carbon-high`。如果 ACP 仍在使用个人订阅，或认证来源不明，请先暂停从 Codex 调用，核实配置后再继续。

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

### 4. 配置超时与凭据传递

打开 `~/.codex/config.toml`，找到上一步生成的 `[mcp_servers.antigravity]` 段，在同一段中加入两行，为 High 档位的回复留出时间。

```toml
startup_timeout_sec = 30
tool_timeout_sec = 600
```

使用 API key 时，在同一段的 `env_vars` 列表中加入 `"GEMINI_API_KEY"`，按名称将环境变量传给 MCP 子进程。配置文件只填写变量名，密钥值由启动 Codex 的环境提供。[Codex MCP 配置文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

```toml
env_vars = ["GEMINI_API_KEY"]
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

- **发送的内容**由 `question` 给出。问题及随附的代码片段会交给 Google 处理，请只提交你有权分享的内容。子进程在专用的 `workspace/` 下运行，讨论角色配置为 `tools: []`，连接器会取消 ACP 权限请求。
- **会话记录**由 Antigravity 管理。本地 `sessions/` 仅保存讨论 ID 到 ACP 会话 ID 的映射，继续旧议题时需要保留这份映射。
- **会话忙**表示同一 `discussion_id` 已有一轮正在进行。等该轮结束后再重试。
- **认证或模型校验失败**时，按第 1 步核对认证来源，再用 `agy models` 检查目标项目的 Carbon High 权限。API key 模式还需核对第 4 步的环境变量传递。**调用超时**时，运行 `codex mcp get antigravity` 核对 `tool_timeout_sec` 是否为 `600`。

## 参考文档

- [Antigravity CLI ACP 文档](https://antigravity.google/docs/cli/acp/)
- [Antigravity 模型文档](https://antigravity.google/docs/models)
- [OpenAI Codex MCP 文档](https://developers.openai.com/codex/mcp/)
