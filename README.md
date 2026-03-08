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

## 站点配置

站点配置文件位于 `config/site.json`。

当前支持的主要字段：

- `title`：站点标题
- `description`：站点描述
- `headerLinks`：顶部右侧链接
- `footerLinks`：底部链接
- `beian`：备案信息

其中 `headerLinks` 和 `footerLinks` 每一项都支持：

- `label`：显示文字
- `href`：跳转地址
- `icon`：可选，支持 Lucide 图标名或图片路径，例如 `github`、`book-open`、`/icons/github.svg`
- `newTab`：可选，是否在新标签页打开

## Docker 使用

项目已提供根目录 `Dockerfile`，可直接构建镜像。

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
