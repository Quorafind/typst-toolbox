# Typst Toolbox

A comprehensive Typst integration toolbox for Obsidian, enabling seamless Markdown-to-Typst conversion, document export, and DOCX viewing.

[中文文档](README_CN.md)

## Features

### Markdown to Typst Conversion

Convert your Markdown notes to Typst format with intelligent transformation:

- **AST Mode**: Automatic conversion using unified AST parser with full Obsidian syntax support
- **Script Mode**: Customizable transformation using JavaScript scripts with sandboxed execution

### Inline Typst Rendering

Embed Typst code blocks directly in your notes with real-time SVG rendering:

````
```typst
#set text(font: "New Computer Modern")
#align(center)[
  = Hello Typst
]
```
````

### Document Export

Export your converted documents to multiple formats:

- **PDF** (requires Typst CLI)
- **PNG** (requires Typst CLI)
- **SVG** (WASM-based, no CLI required if no external packages are imported)
- **DOCX** (experimental, via Typst-to-DOCX converter)

### DOCX Viewer

View DOCX files directly in Obsidian without external applications:

- Native rendering powered by Rust WASM
- Accurate page layout with proper margins and dimensions (A4, Letter, etc.)
- Full support for text formatting (bold, italic, underline, colors, fonts)
- Tables with borders, merged cells, and background colors
- Images and shapes rendering
- Headers and footers with page numbers

### Live Preview

Real-time preview pane with automatic updates as you edit.

### Global API

Access Typst conversion capabilities programmatically:

```javascript
// Convert Markdown to Typst
const typst = await window.bon.typst.convertAsync("# Hello World");

// List available scripts
const scripts = window.bon.typst.listScripts();

// Execute custom script
const result = window.bon.typst.executeScript("my-script", content);
```

### Custom Script Management

Create and manage custom transformation scripts:

- Built-in script editor with syntax highlighting
- Frontmatter-based script selection
- Folder-to-script mappings

### Typst CLI Integration

Automatic detection and integration with Typst CLI for advanced features like external package support.

## Configuration

| Option | Description |
|--------|-------------|
| **Trigger Tags** | Define tags that automatically enable Typst conversion |
| **Auto-compile** | Automatically compile to PDF/PNG when files change |
| **Transform Mode** | Choose between AST-based or script-based transformation |
| **Script Mappings** | Map folders to specific transformation scripts |
| **Max Embed Depth** | Control the depth of embedded content processing |

## Usage

### Typst Conversion

1. Enable Typst in plugin settings
2. Add trigger tags to your note's frontmatter (e.g., `tags: ["bon-typst"]`)
3. Edit your Markdown content normally
4. View the live preview or export to PDF/PNG/SVG/DOCX
5. (Optional) Create custom scripts for specialized transformation needs
6. Use `typst-script: <script-name>` in frontmatter to select a custom script

### DOCX Viewing

Simply open any `.docx` file in your vault - the plugin will automatically render it with proper page layout and formatting.

## Requirements

- **Typst CLI** (optional): Required for PDF/PNG export and external package support
  - Install via: `cargo install typst-cli` or download from [Typst releases](https://github.com/typst/typst/releases)
- **WASM modules**: Bundled with the plugin, no additional installation needed

## License

Apache 2.0
