# Multi-Page Website Clone 设计文档

## 概述

在 Open Lovable 现有的单页克隆功能基础上，扩展支持**多页面网站克隆**。用户输入一个网站 URL，系统自动发现站点结构，用户选择需要克隆的页面，AI 综合分析后生成一个完整的 React SPA（含 react-router-dom 路由）。

## 用户流程

```
输入 URL → [单页模式 / 多页模式] 切换
  → 多页模式: Map 发现站点结构 → 展示页面树
  → 用户勾选要克隆的页面 (默认选中首页 + 一级栏目)
  → 批量抓取选中页面（并行，逐条推送进度）
  → AI 综合分析所有页面内容
  → 生成完整 react-router SPA
  → 应用代码到沙箱 → iframe 预览（支持页面间导航）
```

## 新增 API 端点

### 1. POST /api/website-map

调用 Firecrawl map() 发现站点结构。

**请求：**
```json
{ "url": "https://decard.com" }
```

**响应：**
```json
{
  "success": true,
  "url": "https://decard.com",
  "pages": [
    { "path": "/", "title": "首页", "depth": 0 },
    { "path": "/products", "title": "产品中心", "depth": 1 },
    { "path": "/products/reader", "title": "IC卡读写器", "depth": 2 },
    { "path": "/about", "title": "关于我们", "depth": 1 }
  ]
}
```

**实现方式：** 直接 fetch 调用 Firecrawl API `POST /v2/map`（复用现有代码模式，避免 SDK 兼容性问题）。

### 2. POST /api/batch-scrape

并发抓取多个页面的内容 + 截图，以 SSE 流式推送结果。

**请求：**
```json
{ "urls": ["https://decard.com", "https://decard.com/products", ...] }
```

**SSE 事件：**
```
event: page-start  → { url, index, total }
event: page-done   → { url, title, content, screenshot }
event: page-error  → { url, error }
event: complete    → { totalPages, successfulPages }
```

**实现方式：** Promise.all 并发抓取（限制 maxConcurrency=3），每完成一个立即推送 SSE。复用现有 scrape-url-enhanced 的内部逻辑。

### 3. POST /api/generate-multi-page

基于多个页面的内容，让 AI 生成完整 react-router SPA。

**请求：**
```json
{
  "pages": [
    { "url": "/", "title": "首页", "content": "..." },
    { "url": "/products", "title": "产品中心", "content": "..." }
  ],
  "model": "openai/deepseek-v4-flash"
}
```

**SSE 事件：** 复用现有的 streaming 事件格式（status, thinking, file, stream, complete）。

**AI Prompt 策略：**
- 所有页面内容合并为一个结构化 prompt
- 指示 AI 创建 react-router-dom v6 SPA
- 每页一个独立组件文件：src/pages/{PageName}.jsx
- 共享组件：src/components/Layout.jsx, Header.jsx, Footer.jsx
- App.jsx 中配置 BrowserRouter + Routes
- 统一 Tailwind 设计风格

**大文件分段处理：**
- 10+ 页面时分两阶段：
  1. 先生成共享组件（Layout, Header, Footer, App.jsx）
  2. 再逐个生成页面组件，最后更新 App.jsx 路由

## 前端 UI 变更

### 首页输入区 (`app/page.tsx`)

在现有输入区域添加「单页/多页」切换开关，位置在样式选择器/Extend Brand Toggle 附近。

### 页面选择器（新组件）

`components/app/(home)/sections/hero-input/PageSelector.tsx`

Map 结果展示为可勾选的树形列表，支持：
- 全选/取消全选
- 按深度层级批量选择
- 默认选中首页 + depth=1 的页面
- 显示已选页数统计
- 「开始克隆」按钮触发后续流程

### 生成页进度展示 (`app/generation/page.tsx`)

在加载覆盖层中增加三阶段进度显示：
1. 发现网站结构
2. 抓取页面内容（显示每页状态）
3. AI 生成网站

### 生成的文件结构

多页模式下生成的文件树：
```
src/
  App.jsx              ← BrowserRouter + Routes
  main.jsx             ← 入口
  index.css            ← Tailwind
  components/
    Layout.jsx         ← 通用布局
    Header.jsx         ← 导航栏
    Footer.jsx         ← 页脚
  pages/
    Home.jsx           ← 首页
    Products.jsx       ← 产品中心
    About.jsx          ← 关于我们
    Contact.jsx        ← 联系方式
    ...
```

## 复用现有基础设施

无需改动：
- `lib/sandbox/` — 沙箱管理完全复用
- `app/api/apply-ai-code-stream` — 代码应用完全复用
- `app/api/get-sandbox-files` — 文件浏览完全复用

## 变更文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `app/api/website-map/route.ts` | 新建 | Firecrawl map API |
| `app/api/batch-scrape/route.ts` | 新建 | 批量抓取 SSE API |
| `app/api/generate-multi-page/route.ts` | 新建 | 多页 AI 生成 SSE API |
| `app/page.tsx` | 修改 | 添加单页/多页切换开关 |
| `components/app/(home)/sections/hero-input/PageSelector.tsx` | 新建 | 页面选择器 |
| `app/generation/page.tsx` | 修改 | 集成多页生成流程 |
| `config/app.config.ts` | 修改 | 添加多页相关配置 |
| `types/multi-page.ts` | 新建 | 多页相关类型定义 |

## 未涉及的范围

- 不改动现有单页克隆流程
- 不改动沙箱提供者（local/vercel/e2b）
- 不改动 AI provider manager
- 不改动代码应用机制
