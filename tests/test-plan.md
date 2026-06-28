# Playwright 全功能测试计划

## 概述

对 Open Lovable 进行全面功能测试，覆盖所有用户交互流程和关键 API 端点。

## 测试范围

### 1. 首页 (`/`) — 登录页面

| # | 测试场景 | 预期结果 |
|---|---------|---------|
| 1.1 | 页面基本渲染 | 页面正常加载，标题、输入框、Header、样式选择器可见 |
| 1.2 | URL 输入验证 | 输入有效 URL → 显示样式选择和模型选择器；输入非法文本 → 不显示选项 |
| 1.3 | 搜索功能 | 输入搜索词 → 调用 `/api/search` → 显示结果轮播 |
| 1.4 | 搜索结果轮播 | 结果卡片渲染，hover 显示 "Instant Clone" 和 "Add Instructions" 按钮 |
| 1.5 | Instant Clone | 点击 "Instant Clone" → 跳转到 `/generation` 并携带 URL |
| 1.6 | 样式选择 | 8 种样式可点击切换，选中样式高亮 |
| 1.7 | 模型选择 | 下拉菜单可选择模型，默认 DeepSeek V4 Flash |
| 1.8 | Extend Brand Styles 开关 | 打开开关 → 隐藏样式选择器，显示附加说明输入框 |
| 1.9 | Enter 键提交 | 输入内容后按 Enter → 触发搜索或跳转 |
| 1.10 | 加载状态 | 搜索中显示骨架屏动画 |

### 2. 生成页面 (`/generation`) — 核心工作区

| # | 测试场景 | 预期结果 |
|---|---------|---------|
| 2.1 | 页面渲染 | 页面正常加载，左侧聊天面板、右侧预览区域可见 |
| 2.2 | 沙箱创建 | 页面加载后自动创建沙箱，状态指示器显示 "Sandbox active" |
| 2.3 | 截图捕获 | 从 URL 参数进入后自动截图并显示 |
| 2.4 | AI 对话 | 输入消息 → 发送 → 显示 AI 回复流式输出 |
| 2.5 | 代码生成 | AI 回复中包含代码块 → 代码写入沙箱 → 预览刷新 |
| 2.6 | Code/View 标签切换 | 切换 "Code" 和 "View" 标签显示不同内容 |
| 2.7 | iframe 预览 | View 标签下显示沙箱 URL 的 iframe |
| 2.8 | 文件浏览器 | Code 标签下显示文件树，可展开文件夹、点击查看文件 |
| 2.9 | 下载 ZIP | 点击下载按钮 → 触发 `/api/create-zip` → 下载项目代码 |
| 2.10 | 消息历史 | 对话消息保留，自动滚动到最新消息 |
| 2.11 | 错误状态 | API 失败时显示错误消息和 "Press F to fix" 提示 |

### 3. Builder 页面 (`/builder`)

| # | 测试场景 | 预期结果 |
|---|---------|---------|
| 3.1 | 页面渲染 | 显示侧边栏和预览区域 |
| 3.2 | 下载代码 | 点击下载按钮 → 下载 HTML 文件 |
| 3.3 | 返回首页 | 点击 "Start Over" → 回到 `/` |

### 4. API 端点

| # | 测试场景 | 预期结果 |
|---|---------|---------|
| 4.1 | `POST /api/search` | 返回搜索结果列表 |
| 4.2 | `POST /api/scrape-screenshot` | 返回截图 URL |
| 4.3 | `POST /api/scrape-url-enhanced` | 返回网站内容、元数据、截图 |
| 4.4 | `GET /api/sandbox-status` | 返回沙箱状态（有效或不存在） |
| 4.5 | `POST /api/conversation-state` | 创建/更新/清除会话状态 |

### 5. 端到端流程

| # | 测试场景 | 预期结果 |
|---|---------|---------|
| 5.1 | 完整克隆流程 | 输入 URL → 截图 → 沙箱创建 → AI 生成 → 代码应用 → 预览 |
| 5.2 | 搜索 → 选择 → 克隆 | 搜索 → 选择结果 → 跳转生成页 → 自动生成 |

## 测试配置

- **浏览器**: Chromium (headless)
- **基准 URL**: `http://localhost:3001`
- **超时设置**: 单个测试 30s，断言 10s
- **测试环境**: 需要开发服务器运行

## 运行命令

```bash
# 运行所有测试
pnpm exec playwright test

# 运行指定测试文件
pnpm exec playwright test tests/landing-page.spec.ts

# 运行带 UI 模式的测试
pnpm exec playwright test --ui

# 查看 HTML 报告
pnpm exec playwright show-report
```
