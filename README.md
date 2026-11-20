# Antigravity Quota & Usage Stats

适用于 Antigravity 桌面端的订阅配额与本地 Token 用量统计插件：在左侧边栏“设置”按钮上方原生融入订阅额度卡片，点击弹出多维分析弹窗，提供 **Gemini 主池 5 小时 / 周额度**、独立模型池（**Claude & GPT**、**Gemini 4 Argon**）、模型调用占比与固定全量日期热力图。

## 核心特性

- **原生长相侧栏入口卡（`sidecars/quota_bar/inject.js`）**：无选中时与侧边栏背景融为一体，仅悬停/打开详情后高亮；主卡聚焦展示 Gemini 5 小时余量、周额度余量、周期净耗与准确重置时刻。
- **多模型池精准隔离（`lib/proto.mjs` & `lib/stats.mjs`）**：
  - 将 `Claude / GPT`、`Gemini 4 Argon`（含 `Orchestrator (Argon)`）从 Gemini 主额度统计中剥离，分别展示独立余量与周期消耗。
  - 在弹窗“模型”明细中为每个模型标注所属配额池（`[Gemini]` / `[Argon]` / `[Claude·GPT]`）。
- **实时双路同步 + 零延时融合（`sidecars/quota_bar/main.mjs` & `inject.js`）**：
  - 被动监听原生 `RetrieveUserQuotaSummary` 响应并结合 React Context 中的 `modelOptions` 实时余量与重置时间戳。
  - 在同一重置周期内自动采纳更低余量（最新消耗），并在本地步骤新增时温和防抖调用 `ctx.refreshModels()` 主动同步。
- **全量历史热力图**：在 `全部 / 30天 / 7天` 间切换筛选上方 KPI 与模型占比时，下方 7×24 网格日期始终完整保留全周期历史热力图分布。

## 目录结构

- `plugin.json`：插件清单
- `assets/logo.svg`：插件图标
- `lib/proto.mjs`：Protobuf / 模型池分类与显示规则
- `lib/stats.mjs`：本地对话数据库与 Transcript 聚合统计
- `sidecars/quota_bar/`：Sidecar 进程、CDP 注入脚本与辅助网页视图
- `skills/quota-stats/SKILL.md`：`/quota-stats` 技能说明

## 安装与启用

1. 确保 Antigravity 启动时开启本地 CDP 调试端口（在快捷方式目标末尾追加 `--remote-debugging-port=9222`）。
2. 从 [Releases](../../releases) 下载最新的 `.zip` 安装包并解压，或直接克隆仓库至 `~/.gemini/config/plugins/antigravity-quota-stats`：
   ```bash
   agy plugin validate ~/.gemini/config/plugins/antigravity-quota-stats
   agy plugin enable antigravity-quota-stats
   ```
3. 重启或刷新 Antigravity 后，即可在左侧边栏底部“设置”上方看到额度卡片。
