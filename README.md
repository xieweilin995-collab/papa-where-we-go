<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Papa Where We Go

一个面向亲子家庭的遛娃行程生成器，基于实时位置、天气和 POI 数据生成更适合当下出发的路线建议。

## Local Development

1. 安装依赖：`npm install`
2. 复制环境变量模板：`cp .env.example .env`
3. 按需填写这些 key：
   `AMAP_API_KEY`
   `OPENWEATHER_API_KEY`
   `DEEPSEEK_API_KEY`
   `GEMINI_API_KEY`
4. 启动本地服务：`npm run dev`

## Release

- 当前 MVP 版本：`0.1.0`
- 发布前建议执行：
  `npm test -- --run`
  `npm run lint`
  `npm run build`

## Deploy To Cloudflare

1. 首次登录 Cloudflare：`npx wrangler login`
2. 初始化或绑定 Pages 项目：
   `npx wrangler pages project create papa-where-we-go`
3. 配置生产 secrets：
   `npx wrangler pages secret put AMAP_API_KEY --project-name papa-where-we-go`
   `npx wrangler pages secret put OPENWEATHER_API_KEY --project-name papa-where-we-go`
   `npx wrangler pages secret put DEEPSEEK_API_KEY --project-name papa-where-we-go`
   `npx wrangler pages secret put GEMINI_API_KEY --project-name papa-where-we-go`
4. 发布：
   `npm run cf:deploy`
