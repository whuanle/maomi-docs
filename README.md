# 猫咪文档

基于 Next.js 构建的文档站点，运行时直接读取 `config/site.json` 和 `docs/` 目录内容。

这意味着：

- 站点标题、页头链接、页脚链接、备案信息由 `config/site.json` 控制
- 文档内容由 `docs/` 目录中的 Markdown/MDX 文件控制
- 在 Docker 中挂载这两个路径后，可以按自己的内容定制站点
- Docker 镜像默认不内置 `docs` 内容，文档目录由运行时挂载提供

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
npm run start
```

## MCP 接入

站点现在提供一个标准 JSON-RPC 风格的 MCP 搜索端点：

```text
POST /mcp
```

当前提供的工具：

- `search_docs`：搜索文档内容，参数支持 `query`、`locale`、`limit`

最小初始化请求示例：

```bash
curl http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"demo-client","version":"1.0.0"}}}'
```

列出工具：

```bash
curl http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

调用搜索工具：

```bash
curl http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"kafka consumer","locale":"zh","limit":5}}}'
```

如果 MCP 客户端支持远程 HTTP MCP，可以将服务地址配置为：

```text
http://your-host/mcp
```

### MCP 安全与限流

为了避免恶意流量和并发搜索把服务器拖垮，MCP 与搜索接口都加了服务端保护：

- 按客户端 IP 固定窗口限流
- 搜索任务全局并发上限
- 搜索索引内存缓存，减少反复扫盘
- 可选 Bearer Token 鉴权

支持的环境变量：

- `MCP_AUTH_TOKEN`：设置后，调用 `/mcp` 必须带 `Authorization: Bearer <token>`
- `MCP_RATE_LIMIT_WINDOW_MS`：MCP 限流窗口，默认 `60000`
- `MCP_RATE_LIMIT_MAX_REQUESTS`：每个 IP 在窗口内最大 MCP 请求数，默认 `30`
- `SEARCH_RATE_LIMIT_WINDOW_MS`：普通搜索接口限流窗口，默认 `60000`
- `SEARCH_RATE_LIMIT_MAX_REQUESTS`：每个 IP 在窗口内最大搜索请求数，默认 `90`
- `SEARCH_MAX_CONCURRENT_REQUESTS`：搜索最大并发数，默认 `4`
- `SEARCH_INDEX_TTL_MS`：搜索索引缓存时长，默认 `300000`

如果你要对公网开放，最低要求是同时设置：

- `MCP_AUTH_TOKEN`
- 反向代理层限流
- CDN 或 WAF

## 站点配置

站点配置文件位于 `config/site.json`。

当前支持的主要字段：

- `title`：站点标题
- `description`：站点描述
- `headerLinks`：顶部右侧链接
- `footerLinks`：底部链接
- `beian`：备案信息
- `customHeadHtml`：插入到页面 `<head>` 的自定义 HTML，可用于 Google/Microsoft 统计代码、站点验证标签等
- `customHeadHtmlFile`：可选，指向一个 HTML 片段文件路径，适合直接粘贴第三方原始统计代码

其中 `headerLinks` 和 `footerLinks` 每一项都支持：

- `label`：显示文字
- `href`：跳转地址
- `icon`：可选，支持 Lucide 图标名或图片路径，例如 `github`、`book-open`、`/icons/github.svg`
- `newTab`：可选，是否在新标签页打开

### 插入统计代码

如果你需要添加 Google 统计、Microsoft Clarity 或 Google Search Console 验证标签，有两种方式。

方式一：直接在 `site.json` 中写 `customHeadHtml`。

```json
{
  "title": "猫咪文档",
  "description": "探索技术文档和教程",
  "customHeadHtml": "<meta name=\"google-site-verification\" content=\"your-code\" />\n<script type=\"text/javascript\">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src=\"https://www.clarity.ms/tag/\"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, \"clarity\", \"script\", \"your-clarity-id\");</script>"
}
```

方式二：把原始代码放到单独文件中，再由 `site.json` 引用，通常更方便维护。

`config/site.json`：

```json
{
  "title": "猫咪文档",
  "description": "探索技术文档和教程",
  "customHeadHtmlFile": "config/custom-head.html"
}
```

`config/custom-head.html`：

```html
<meta name="google-site-verification" content="your-code" />
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "your-clarity-id");
</script>
```

如果同时配置了 `customHeadHtmlFile` 和 `customHeadHtml`，系统会先读取文件内容，再追加内联内容。

## Docker 使用

项目已提供根目录 `Dockerfile`，可直接构建镜像。

如果你需要一键构建并推送到 Docker Hub，可以直接使用根目录脚本：

```bash
./docker-publish.sh 0.0.3
```

默认镜像名是 `whuanle/maomi-docs`，脚本会依次执行：

```text
docker build -t whuanle/maomi-docs:latest .
docker tag whuanle/maomi-docs:latest whuanle/maomi-docs:0.0.3
docker push whuanle/maomi-docs:0.0.3
docker push whuanle/maomi-docs:latest
```

如果以后要改镜像名，可以额外传入第二个参数：

```bash
./docker-publish.sh 0.0.3 yourname/maomi-docs
```

如果你当前只方便用 PowerShell，也可以继续使用：

```powershell
.\docker-publish.ps1 -Version 0.0.3
```

### 1. 构建镜像

```bash
docker build -t maomi-docs:latest .
```

### 2. 使用镜像直接启动

```bash
docker run --rm -p 3000:3000 maomi-docs:latest
```

如果不做任何挂载，容器会使用镜像内部自带的 `config/` 内容。

注意：镜像默认不打包 `docs/` 文档目录，因此如果你希望站点显示实际文档内容，需要在运行容器时挂载 `/app/docs`。

启动后访问：

```text
http://localhost:3000
```

## 自定义 `site.json` 映射

容器内配置路径是：

```text
/app/config/site.json
```

如果你只想替换站点配置文件，可以把宿主机上的 `site.json` 挂载到这个位置。

Linux / macOS：

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/config/site.json:/app/config/site.json:ro" \
  maomi-docs:latest
```

Windows PowerShell：

```powershell
docker run --rm -p 3000:3000 `
  -v "${PWD}\config\site.json:/app/config/site.json:ro" `
  maomi-docs:latest
```

如果你希望整个配置目录一起替换，也可以挂载整个 `config` 目录：

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/config:/app/config:ro" \
  maomi-docs:latest
```

## 自定义 `docs` 目录映射

容器内文档目录路径是：

```text
/app/docs
```

镜像不会把仓库里的 `docs/` 打进最终运行层，容器会在运行时读取 `/app/docs`。

如果你想让容器读取自己维护的文档目录，可以直接挂载宿主机 `docs`：

Linux / macOS：

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/docs:/app/docs:ro" \
  maomi-docs:latest
```

Windows PowerShell：

```powershell
docker run --rm -p 3000:3000 `
  -v "${PWD}\docs:/app/docs:ro" `
  maomi-docs:latest
```

## 同时映射 `site.json` 和 `docs`

这是最常见的使用方式：镜像固定，配置和文档都由宿主机控制，无需因为文档更新而重建镜像。

Linux / macOS：

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/config/site.json:/app/config/site.json:ro" \
  -v "$(pwd)/docs:/app/docs:ro" \
  maomi-docs:latest
```

Windows PowerShell：

```powershell
docker run --rm -p 3000:3000 `
  -v "${PWD}\config\site.json:/app/config/site.json:ro" `
  -v "${PWD}\docs:/app/docs:ro" `
  maomi-docs:latest
```

## Docker 目录约定

容器内最终使用的路径如下：

```text
/app
├── config
│   └── site.json
├── docs
├── public
└── server.js
```

因此：

- 想改站点标题、顶部/底部链接、备案信息：映射 `/app/config/site.json`
- 想改文档内容：映射 `/app/docs`
- 想一起完全自定义：同时映射两者

## 说明

- `Dockerfile` 使用 Next.js `standalone` 输出，运行镜像更轻量
- 镜像默认监听 `3000` 端口
- 镜像默认只内置应用代码、静态资源和 `config/`，不内置 `docs/`
- 示例中的 `:ro` 表示只读挂载，推荐保留
