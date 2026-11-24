# Uranai · 塔罗神谕

一款面向移动端深度优化、支持 PWA 与 Docker 容器化部署的沉浸式塔罗占卜 Web App。

## 核心特性

- **极致拟真 3D 物理卡牌**：350gsm 鎏金立体切边、亚麻纸纹叠层、跟随指针与手机陀螺仪的动态金属高光反射、重力阻尼 3D 翻牌、Web Audio 纸张/洗牌/翻牌微音效与触觉震动。
- **仪式感交互闭环**：多层物理洗牌 → 切牌 → 移动端单指滑动弧形牌扇抽牌 → 逐张或一键展开翻牌 → 全屏 ±22° 3D 赏析弹窗。
- **双卡组无缝切换**：
  - **经典伟特塔罗（Rider–Waite–Smith 1909）**：全套 78 张公版高清 Retina WebP 卡面 + 鎏金星盘牌背。
  - **穆夏风仓鼠塔罗（Mucha Hamster Tarot）**：阿尔丰斯·穆夏新艺术石版画 × 仓鼠主角原创高清卡组 + 专属双鼠星夜牌背。
- **5 套可切换占卜桌布与主题**：暗夜鎏金·午夜丝绒（默认）、复古沙龙·祖母绿绒、极光秘境·紫晶星云、古典画册·暖米亚麻、东方玄月·墨砚素布，切换时联动配色、桌布纹理与 Canvas 动态氛围粒子。
- **全功能占卜与双轨解牌**：
  - **每日一牌 (`/`)**：结合实时月相的每日神谕抽取与 AI 今日启示。
  - **自定义问题占卜 (`/reading`)**：支持 6 大占卜领域与 6 套牌阵（1 / 3 / 3 / 5 / 6 / 10 张凯尔特十字），提供完整 78 张牌结构化正逆位基础牌义 + **OpenAI 兼容流式 AI 深度推理解读**。
  - **78 张卡面鉴赏馆 (`/gallery`)**：搜索、按大阿卡纳/四花色筛选、双卡组对比与全屏 3D 把玩。
  - **历史记录与多端同步 (`/history`)**：自动保存每次占卜与复盘笔记，支持 JSON 导入导出；配置 Supabase 后自动启用账号登录与云端同步。

## 快速开始

### 本地开发

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

### Docker Compose 一键部署

```bash
cp .env.example .env
# 按需填写 AI_API_KEY / NEXT_PUBLIC_SUPABASE_URL 等环境变量
docker compose up -d --build
```

默认监听端口 `3232`（可在 `.env` 中通过 `URANAI_PORT` 修改），内置健康检查接口 `GET /api/health`。

### 启用 Supabase 云端同步（可选）

1. 在 Supabase 项目的 SQL Editor 中执行 [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql)。
2. 在 `.env` 中填入 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 并重新构建启动。
3. 未配置 Supabase 时，应用自动以零门槛本地存储模式运行。
