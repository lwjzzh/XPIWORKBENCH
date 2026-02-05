# OmniFlow 构建指南

本文档将指导你如何在本地环境配置、开发和构建 OmniFlow 桌面端应用。

## 1. 环境准备 (Prerequisites)

在开始之前，请确保你的系统已安装以下基础环境：

### 1.1 基础语言环境
*   **Go (Golang)**: 版本 >= 1.21
    *   [下载 Go](https://go.dev/dl/)
*   **Node.js**: 版本 >= 18 (LTS)
    *   [下载 Node.js](https://nodejs.org/)
    *   建议安装 `npm` (随 Node.js 附带)

### 1.2 Wails 框架 CLI
OmniFlow 基于 Wails v2 框架。在安装完 Go 和 Node.js 后，运行以下命令安装 Wails 命令行工具：

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

安装完成后，运行 `wails doctor` 检查环境是否健康。

### 1.3 平台特定依赖

*   **Windows**:
    *   通常不需要额外配置。Wails 会检查是否安装了 WebView2 运行时（Win10/11 默认已安装）。
    *   建议安装 [TDM-GCC](https://jmeubank.github.io/tdm-gcc/) 编译器（为了更好的 CGO 支持，尽管我们使用了纯 Go 的 SQLite 驱动）。

*   **macOS**:
    *   需要安装 Xcode 命令行工具：
    ```bash
    xcode-select --install
    ```

*   **Linux (Debian/Ubuntu)**:
    *   需要安装 GTK 和 WebKit 开发库：
    ```bash
    sudo apt update
    sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
    ```

---

## 2. 初始化项目依赖 (Initialization)

克隆项目后，需要分别安装后端和前端的依赖。

### 2.1 后端依赖 (Go)
在项目根目录下运行：

```bash
# 下载 Go 模块 (包含 GORM 和 SQLite 驱动)
go mod tidy
```

### 2.2 前端依赖 (React/TypeScript)
进入 `frontend` 目录并安装依赖：

```bash
cd frontend
npm install
# 或者使用 pnpm / yarn
# pnpm install
cd ..
```

---

## 3. 开发模式 (Development)

开发模式支持 **热重载 (Hot Reload)**。当你修改 Go 代码或 React 代码时，应用会自动重新编译或刷新。

在项目根目录下运行：

```bash
wails dev
```

*   应用窗口将自动打开。
*   你可以在浏览器中访问 `http://localhost:34115` 来调试前端界面（支持 React DevTools）。

---

## 4. 生产构建 (Production Build)

当应用开发完成准备发布时，执行构建命令生成可执行文件。

### 4.1 标准构建
在项目根目录下运行：

```bash
wails build
```

*   **输出目录**: `build/bin/`
*   **Windows**: 生成 `OmniFlow.exe`
*   **macOS**: 生成 `OmniFlow.app`
*   **Linux**: 生成 `OmniFlow` 二进制文件

### 4.2 压缩构建 (可选)
如果你安装了 `upx` 工具，可以使用以下命令压缩二进制文件体积：

```bash
wails build -upx
```

### 4.3 跨平台编译 (Windows 上编译 Linux/Mac)
Go 支持交叉编译，但在使用 Wails 时，建议在目标平台上进行编译以获得最佳兼容性（特别是涉及 CGO 和 Webview 绑定的部分）。

---

## 5. 数据存储说明

OmniFlow 在生产模式下使用 SQLite 数据库。

*   **数据库位置**: 
    *   Windows: `C:\Users\{用户名}\AppData\Roaming\.omniflow\omniflow.db`
    *   macOS: `/Users/{用户名}/Library/Application Support/.omniflow/omniflow.db`
    *   Linux: `/home/{用户名}/.config/.omniflow/omniflow.db`

应用首次启动时会自动创建数据库文件并执行表结构迁移 (Auto Migrate)，无需手动配置 SQL。

---

## 6. 常见问题 (Troubleshooting)

**Q: 运行 `wails build` 时报错 `gcc: exec: "gcc": executable file not found`?**
A: 你的系统缺少 C 编译器。
*   Windows: 请安装 TDM-GCC 并确保添加到 PATH。
*   Linux/Mac: 确保安装了 `build-essential` 或 Xcode Command Line Tools。

**Q: 前端页面空白或报错？**
A: 请检查 `frontend` 目录下是否执行了 `npm install`。构建时 Wails 会自动调用 `npm run build`，如果依赖未安装会导致构建失败。

**Q: 数据库报错 `binary not supported`?**
A: 请确保在 `go.mod` 中使用的是 `github.com/glebarez/sqlite` (纯 Go 实现)，而不是需要 CGO 的 `gorm.io/driver/sqlite`。
