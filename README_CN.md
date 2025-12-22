# Typst Toolbox

一个为 Obsidian 打造的全面 Typst 集成工具箱，支持无缝的 Markdown 到 Typst 转换、文档导出和 DOCX 查看。

[English](README.md)

## 功能特性

### Markdown 到 Typst 转换

智能地将 Markdown 笔记转换为 Typst 格式：

- **AST 模式**：使用 unified AST 解析器自动转换，完全支持 Obsidian 语法
- **脚本模式**：使用 JavaScript 脚本自定义转换，支持沙箱化执行

### 内联 Typst 渲染

直接在笔记中嵌入 Typst 代码块，实时 SVG 渲染：

````
```typst
#set text(font: "New Computer Modern")
#align(center)[
  = Hello Typst
]
```
````

### 文档导出

将转换后的文档导出为多种格式：

- **PDF**（需要 Typst CLI）
- **PNG**（需要 Typst CLI）
- **SVG**（基于 WASM，未导入外部包时无需 CLI）
- **DOCX**（实验性功能，通过 Typst-to-DOCX 转换器）

### DOCX 查看器

直接在 Obsidian 中查看 DOCX 文件，无需外部应用程序：

- 基于 Rust WASM 的原生渲染
- 精确的页面布局，支持正确的边距和尺寸（A4、Letter 等）
- 完整的文本格式支持（粗体、斜体、下划线、颜色、字体）
- 表格渲染，支持边框、合并单元格和背景色
- 图片和形状渲染
- 页眉页脚及页码支持

### 实时预览

提供实时预览面板，编辑时自动更新。

### 全局 API

以编程方式访问 Typst 转换能力：

```javascript
// 将 Markdown 转换为 Typst
const typst = await window.bon.typst.convertAsync("# Hello World");

// 列出可用的脚本
const scripts = window.bon.typst.listScripts();

// 执行自定义脚本
const result = window.bon.typst.executeScript("my-script", content);
```

### 自定义脚本管理

创建和管理自定义转换脚本：

- 内置脚本编辑器，支持语法高亮
- 基于 frontmatter 的脚本选择
- 文件夹到脚本的映射

### Typst CLI 集成

自动检测并集成 Typst CLI，支持外部包等高级功能。

## 配置选项

| 选项 | 描述 |
|------|------|
| **触发标签** | 定义自动启用 Typst 转换的标签 |
| **自动编译** | 文件变化时自动编译为 PDF/PNG |
| **转换模式** | 在基于 AST 或基于脚本的转换之间选择 |
| **脚本映射** | 将目录映射到特定的转换脚本 |
| **最大嵌入深度** | 控制嵌入内容的处理深度 |

## 使用方法

### Typst 转换

1. 在插件设置中启用 Typst
2. 在笔记的 frontmatter 中添加触发标签（例如：`tags: ["bon-typst"]`）
3. 正常编辑 Markdown 内容
4. 查看实时预览或导出为 PDF/PNG/SVG/DOCX
5. （可选）为特殊转换需求创建自定义脚本
6. 通过 `typst-script: <script-name>` 在 frontmatter 中选择脚本

### DOCX 查看

只需在 vault 中打开任意 `.docx` 文件，插件将自动以正确的页面布局和格式进行渲染。

## 系统要求

- **Typst CLI**（可选）：PDF/PNG 导出和外部包支持需要
  - 安装方式：`cargo install typst-cli` 或从 [Typst releases](https://github.com/typst/typst/releases) 下载
- **WASM 模块**：已随插件打包，无需额外安装

## 许可证

Apache 2.0
