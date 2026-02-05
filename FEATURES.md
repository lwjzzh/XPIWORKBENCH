# OmniFlow 功能逻辑与架构说明

OmniFlow 是一个基于 Wails (Go) 和 React 的桌面端 API 编排与执行工具。它允许用户通过可视化的方式定义 API 工作流，并生成用于执行这些工作流的用户界面（对话框或控制面板）。

---

## 1. 核心架构 (Architecture)

### 1.1 技术栈
*   **前端**: React 18, TypeScript, Vite, Tailwind CSS (Glassmorphism UI), Zustand (状态管理), React Router (路由).
*   **后端**: Go (Wails v2), GORM (ORM), SQLite (纯 Go 驱动), `net/http` (代理请求).
*   **交互**: Wails Bridge (JS <-> Go 绑定),自定义事件 (Streaming).

### 1.2 数据流向
1.  **定义**: 用户在前端 Builder 定义 `App` (包含多个 `Component` 和 `Parameter`)。
2.  **存储**: 前端调用后端 `SaveApp`，Go 将结构体序列化为 JSON 并存入 SQLite `Content` 字段。
3.  **执行**: 前端 Runner 加载 App，用户输入参数。前端 `WorkflowEngine` 解析参数，通过插值替换变量，调用后端 `ProxyRequest` 发起实际网络请求。
4.  **响应**: 后端返回原始数据 (JSON/Binary)，前端根据 MIME 类型渲染结果 (文本/图片/视频)。

---

## 2. 功能模块清单 (Feature Modules)

### 2.1 仪表盘 (Dashboard)
*   **应用库展示**:
    *   支持 **网格 (Grid)** 和 **列表 (List)** 两种视图。
    *   **搜索**: 实时过滤应用名称和描述。
    *   **排序**: 置顶应用优先，其次按更新时间倒序。
*   **快捷操作**:
    *   **置顶/取消置顶 (Pin)**: 这是一个本地 UI 偏好，同步至数据库。
    *   **运行模式选择**: 点击运行后，弹窗选择 **Panel Mode** (面板) 或 **Chat Mode** (对话) 启动。

### 2.2 应用管理 (App Manager)
*   **CRUD**: 创建、读取、更新、删除应用。
*   **导入/导出**:
    *   **导出**: 将应用配置导出为 `.omni.json` 文件（自动去除敏感状态如置顶信息）。
    *   **导入**: 读取 JSON 文件并生成新的应用 ID (避免冲突)，支持跨设备迁移。
*   **复制 (Duplicate)**: 快速克隆一个现有应用配置。

### 2.3 构建器 (Builder)
这是核心的低代码编辑界面，分为三个主要区域：

#### A. 画布与编排 (Assembler)
*   **拖拽排序**: 支持拖拽调整步骤 (Component) 的执行顺序。
*   **添加/删除**: 从预设库添加步骤或删除现有步骤。
*   **可视化节点**: 显示请求方法、URL 概览和参数数量。

#### B. 属性检查器 (Inspector Panel)
侧边栏配置面板，包含三个标签页：

1.  **API 请求 (API Config)**:
    *   **Method**: GET, POST, PUT, DELETE, PATCH.
    *   **URL**: 支持变量插值 `{{variable}}`。支持 **cURL 导入**自动解析。
    *   **Headers**: 键值对配置，支持变量。
    *   **Body**:
        *   `JSON`: 内置 Monaco-like 编辑器，支持 JSON 语法高亮和格式化。
        *   `Form-Data`: 支持文本字段和文件上传占位符 `{{file}}`。
    *   **Stream**: 开启后支持 SSE (Server-Sent Events) 流式响应。
    *   **测试运行**: 直接在编辑器内发送请求并查看原始响应。

2.  **变量与界面 (UI Mapper)**:
    *   **变量检测**: 自动扫描 API 配置中的 `{{var}}` 占位符。
    *   **参数定义**:
        *   **UI 类型**: Input, Textarea, Select, Number, Boolean, File, Hidden.
        *   **引用 (Ref)**: 支持引用前序步骤的输出 (e.g., `{{step1.data.id}}`)。
        *   **默认值**: 设置初始值。

3.  **设置 (Settings)**:
    *   **基本信息**: 名称、描述。
    *   **流程控制**:
        *   **失败继续**: 即使此步骤报错，是否继续执行后续步骤。
        *   **自动重试**: 设置重试次数 (0-3) 和延迟。

### 2.4 执行器 (Runner)
支持两种完全不同的运行时体验：

#### A. 面板模式 (Panel Mode)
*   **布局**: 左侧填写表单，右侧展示时间轴和结果。
*   **会话保持**: 自动保存最后的输入状态 (Session Persistence)，刷新不丢失数据。
*   **执行流**:
    *   顺序执行所有步骤。
    *   实时显示每个步骤的状态 (Running/Success/Error) 和耗时。
    *   **结果渲染**: 自动识别 JSON, 图片 URL, 视频 URL, 音频 URL 并渲染为可视化组件。
*   **历史记录**: 右侧抽屉查看最近的执行历史。

#### B. 对话模式 (Chat Mode)
*   **交互**: 类似 ChatGPT 的界面。
*   **工作流嵌入**:
    *   用户的每条消息触发一次完整的工作流执行。
    *   **思维链 (Chain of Thought)**: 消息气泡下方显示折叠的“工作流执行过程”，展开可查看每一步的详细状态。
*   **多媒体输入**: 输入框支持上传图片/文件，自动映射到配置为 `File` 类型的参数。
*   **会话管理**: 左侧侧边栏管理历史会话，支持重命名、置顶和删除。

### 2.5 系统设置 (Settings)
*   **环境变量 (Secrets)**: 定义全局敏感数据（如 `API_KEY`），在 Builder 中通过 `{{env.API_KEY}}` 引用。
*   **存储路径**: 配置本地文件保存路径（用于保存生成的结果文件，暂未完全实装文件写入逻辑，目前为路径选择器）。
*   **数据管理**: 查看本地数据库状态（统计信息）。

---

## 3. 数据逻辑 (Data & Storage)

后端使用 **SQLite** 数据库，通过 **GORM** 进行 ORM 映射。

### 3.1 数据库模型
采用了 **混合存储 (Hybrid Storage)** 策略：
*   **AppModel**:
    *   `ID` (PK), `Name`, `UpdatedAt` (Index), `IsPinned` (Index): 用于快速列表查询和排序。
    *   `Content` (Text): 存储完整的应用配置 JSON (包含 Components, API Config 等所有深层嵌套结构)。
*   **SessionModel**:
    *   `ID` (PK), `AppID` (Index), `Type` (Chat/Panel).
    *   `Content` (Text): 存储会话数据 JSON (聊天记录或面板输入状态)。

### 3.2 启动逻辑
1.  检测用户配置目录 (UserConfigDir)。
2.  创建 `.omniflow` 文件夹。
3.  初始化 `omniflow.db`。
4.  执行 `AutoMigrate` 自动建表/更表。

---

## 4. 核心引擎逻辑 (Workflow Engine)

位于前端 `services/workflowEngine.ts`。

### 4.1 变量插值 (Interpolation)
*   **字符串插值**: 使用正则替换 `{{key}}` 或 `{{step.data.key}}`。
*   **JSON 插值**: 深度遍历 JSON 对象，替换值中的变量。支持 **对象替换** (如果变量本身是对象/数组，直接替换而非转为字符串)。

### 4.2 执行流程
1.  **加载上下文**: 合并用户输入 (`inputs`) 和 全局环境 (`envVars`)。
2.  **遍历步骤**: 按顺序处理 `app.components`。
3.  **预处理**: 解析当前步骤的 URL、Headers、Body 中的变量。
4.  **请求代理**: 调用 Wails 后端 `ProxyRequest`。
5.  **流式处理**:
    *   如果开启 `stream`，调用 `ProxyStreamRequest`。
    *   后端通过 Wails Events (`stream:data:UUID`) 实时推送数据块。
    *   前端自动处理 SSE 格式 (`data: {...}`) 拼接。
6.  **结果回写**: 将当前步骤结果写入上下文 (`context[stepId] = result`)，供后续步骤引用。
7.  **错误处理**: 根据 `flowControl` 配置决定是中断还是重试。

---

## 5. 网络代理逻辑 (Network Proxy)

位于后端 `app.go`。

*   **跨域解决**: 桌面端应用直接发起请求，绕过浏览器 CORS 限制。
*   **Multipart 支持**: 自动将前端的 Base64 文件数据转换为标准的 `multipart/form-data` 二进制流。
*   **二进制响应**: 检测响应 `Content-Type`，如果是图片/音频/视频，自动转为 Base64 Data URI 返回给前端渲染。
