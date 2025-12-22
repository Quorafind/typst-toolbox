import {
	Modal,
	Notice,
	Plugin,
	TFile,
	type CachedMetadata,
	debounce,
} from "obsidian";
import { TypstToolboxSettingTab } from "./settingTab";
import { TypstScriptManager } from "./typst/typstScriptManager";
import { TypstConverter } from "./typst/typstConverter";
import {
	DEFAULT_TYPST_SETTINGS,
	type TypstSettings,
} from "./typst/typstSettings";
import { TYPST_VIEW_TYPE, TypstView } from "./typst/typstView";
import {
	TYPST_PREVIEW_VIEW_TYPE,
	TypstPreviewView,
} from "./typst/typstPreviewView";
import { TypstAPI } from "./typst/api";
import { TypstWasmRenderer } from "./typst/typstWasmRenderer";
import { createTypstCodeBlockProcessor } from "./typst/typstCodeBlockProcessor";
import { TypstDocxService } from "./typst/typstDocxService";
import { DOCX_VIEW_TYPE, DocxView } from "./docx/docxView";

export interface TypstDocxSettings {
	typst: TypstSettings;
}

export const DEFAULT_SETTINGS: TypstDocxSettings = {
	typst: DEFAULT_TYPST_SETTINGS,
};

export default class TypstToolboxPlugin extends Plugin {
	private typstConverter: TypstConverter | null = null;
	private typstScriptManager: TypstScriptManager | null = null;
	private typstAPI: TypstAPI | null = null;
	private typstWasmRenderer: TypstWasmRenderer | null = null;
	private typstDocxService: TypstDocxService | null = null;

	public settings: TypstDocxSettings;

	async onload() {
		await this.loadSettings();

		// Register DOCX viewer (always available)
		this.registerView(DOCX_VIEW_TYPE, (leaf) => new DocxView(leaf));
		this.registerExtensions(["docx"], DOCX_VIEW_TYPE);

		this.registerView(TYPST_VIEW_TYPE, (leaf) => new TypstView(leaf));
		this.registerExtensions(["typ"], TYPST_VIEW_TYPE);

		if (this.settings.typst.enableCodeBlock) {
			await this.initializeTypstWasmRenderer();

			this.registerView(
				TYPST_PREVIEW_VIEW_TYPE,
				(leaf) =>
					new TypstPreviewView(
						leaf,
						this.typstWasmRenderer,
						this.typstConverter!,
					),
			);
		}

		await this.initializeTypstFeatures();

		this.registerEvent(
			this.app.metadataCache.on(
				"changed",
				async (file: TFile, data: string, cache: CachedMetadata) => {
					this.triggerDebounce(file, data, cache);
				},
			),
		);

		this.addSettingTab(new TypstToolboxSettingTab(this.app, this));
	}

	onunload() {
		this.unloadTypstFeatures();
	}

	private async initializeTypstFeatures(): Promise<void> {
		this.typstConverter = null;
		this.typstScriptManager = null;
		this.typstAPI = null;

		if (!this.settings.typst) {
			return;
		}

		try {
			this.typstScriptManager = new TypstScriptManager(
				this.app.vault,
				this.settings.typst.scriptDirectory,
			);
			await this.typstScriptManager.ensureScriptDirectory();
			await this.typstScriptManager.initializeDefaultScript();

			this.typstConverter = new TypstConverter(
				this.app,
				this.settings.typst,
				this.typstScriptManager,
			);

			const previewMode = this.settings.typst.previewMode;
			if (previewMode !== "none") {
				this.typstConverter.setPreviewUpdateCallback(
					async (file, typstCode) => {
						await this.updateTypstPreview(
							file,
							typstCode,
							previewMode,
						);
					},
				);
			} else {
				this.typstConverter.setPreviewUpdateCallback(null);
			}

			this.typstAPI = new TypstAPI(
				this.typstConverter,
				this.typstScriptManager,
				this.app,
			);

			this.registerGlobalTypstAPI();
			this.registerTypstCommands();
		} catch (error) {
			console.error("Failed to initialize Typst features", error);
			this.typstConverter = null;
			this.typstScriptManager = null;
			this.typstAPI = null;
		}
	}

	public async refreshTypstFeatures(): Promise<void> {
		await this.initializeTypstFeatures();
	}

	public unloadTypstFeatures(): void {
		this.unregisterGlobalTypstAPI();
		this.typstConverter = null;
		this.typstScriptManager = null;
		this.typstAPI = null;
	}

	private async initializeTypstWasmRenderer(): Promise<void> {
		try {
			this.typstWasmRenderer = new TypstWasmRenderer(
				this.settings.typst?.codeBlockCacheSize ?? 100,
			);

			await this.typstWasmRenderer.initialize();

			this.registerMarkdownCodeBlockProcessor(
				"typst",
				createTypstCodeBlockProcessor(this.typstWasmRenderer),
			);

			console.log("Typst WASM renderer initialized and registered");
		} catch (error) {
			console.error("Failed to initialize Typst WASM renderer:", error);
			new Notice(
				`Typst code block rendering initialization failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private registerGlobalTypstAPI(): void {
		if (!this.typstAPI) {
			console.warn(
				"[TypstDocx] Cannot register global API: typstAPI is null",
			);
			return;
		}

		try {
			if (typeof window.bon === "undefined") {
				window.bon = {};
			}

			window.bon.typst = {
				convert: this.typstAPI.convert.bind(this.typstAPI),
				convertAsync: this.typstAPI.convertAsync.bind(this.typstAPI),
				listScripts: this.typstAPI.listScripts.bind(this.typstAPI),
			};

			console.log(
				"[TypstDocx] Global Typst API registered at window.bon.typst",
			);
		} catch (error) {
			console.error(
				"[TypstDocx] Failed to register global Typst API:",
				error,
			);
		}
	}

	private unregisterGlobalTypstAPI(): void {
		try {
			if (window.bon?.typst) {
				delete window.bon.typst;
				console.log("[TypstDocx] Global Typst API unregistered");
			}

			if (window.bon && Object.keys(window.bon).length === 0) {
				delete window.bon;
			}
		} catch (error) {
			console.error(
				"[TypstDocx] Failed to unregister global Typst API:",
				error,
			);
		}
	}

	public getTypstScriptManager(): TypstScriptManager | null {
		return this.typstScriptManager;
	}

	public getTypstWasmRenderer(): TypstWasmRenderer | null {
		return this.typstWasmRenderer;
	}

	public getTypstConverter(): TypstConverter | null {
		return this.typstConverter;
	}

	private triggerDebounce = debounce(
		async (file: TFile, _data: string, cache: CachedMetadata) => {
			if (this.typstConverter && this.settings.typst?.autoCompile) {
				try {
					const shouldConvert = this.typstConverter.shouldConvert(
						file,
						cache,
					);
					const previewMode =
						this.settings.typst.previewMode ?? "wasm";

					if (shouldConvert && previewMode !== "none") {
						const silent =
							!this.settings.typst.showNoticeOnAutoCompile;
						await this.typstConverter.convertFile(file, cache, {
							silent,
						});
					}
				} catch (error) {
					console.error("Typst auto conversion failed", error);
				}
			}
		},
		1000,
	);

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.settings.typst = {
			...DEFAULT_TYPST_SETTINGS,
			...(this.settings.typst ?? {}),
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async activateTypstPreviewView(): Promise<void> {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(TYPST_PREVIEW_VIEW_TYPE)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("split", "vertical");
			if (leaf) {
				await leaf.setViewState({
					type: TYPST_PREVIEW_VIEW_TYPE,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	private async updateTypstPreview(
		file: TFile,
		typstCode: string,
		mode: "wasm" | "compile",
	): Promise<void> {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(TYPST_PREVIEW_VIEW_TYPE);

		if (leaves.length > 0) {
			for (const leaf of leaves) {
				const view = leaf.view;
				if (view instanceof TypstPreviewView) {
					if (mode === "wasm") {
						const format =
							this.settings.typst?.compileFormat ?? "svg";
						await view.updatePreviewWithFallback(
							file,
							typstCode,
							format,
						);
					} else if (mode === "compile" && this.typstConverter) {
						try {
							const typstPath = this.buildTypstPath(file);
							const format =
								this.settings.typst?.compileFormat ?? "svg";

							await this.typstConverter.writeTypstFile(
								typstPath,
								typstCode,
							);
							const outputPath =
								await this.typstConverter.compileTypstFile(
									typstPath,
									format,
									true,
								);

							await view.updatePreviewFromFile(
								file,
								outputPath,
								format,
							);
						} catch (error) {
							console.error("CLI compile failed:", error);
							new Notice(
								`Typst CLI compilation failed: ${
									error instanceof Error
										? error.message
										: String(error)
								}`,
							);
						}
					}
				}
			}
		}
	}

	private buildTypstPath(file: TFile): string {
		const extensionPattern = new RegExp(`\\.${file.extension}$`, "i");
		if (!extensionPattern.test(file.path)) {
			return `${file.path}.typ`;
		}
		return file.path.replace(extensionPattern, ".typ");
	}

	private async showConfirmDialog(
		title: string,
		message: string,
	): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText(title);
			modal.contentEl.createEl("p", { text: message });

			const buttonContainer = modal.contentEl.createDiv({
				cls: "modal-button-container",
			});

			buttonContainer
				.createEl("button", { text: "Cancel" })
				.addEventListener("click", () => {
					modal.close();
					resolve(false);
				});

			buttonContainer
				.createEl("button", { text: "Confirm", cls: "mod-warning" })
				.addEventListener("click", () => {
					modal.close();
					resolve(true);
				});

			modal.open();
		});
	}

	private async cleanTypstFiles(): Promise<number> {
		const files = this.app.vault.getFiles();
		const typFiles = files.filter((f) => f.extension === "typ");

		let count = 0;
		for (const file of typFiles) {
			try {
				await this.app.vault.delete(file);
				count++;
			} catch (error) {
				console.error(`Failed to delete ${file.path}:`, error);
			}
		}

		return count;
	}

	/**
	 * Export a Markdown file to DOCX using WASM
	 */
	private async exportToDocx(file: TFile): Promise<void> {
		if (!this.typstConverter) {
			new Notice("Typst converter not initialized");
			return;
		}

		// Initialize DOCX service if needed
		if (!this.typstDocxService) {
			this.typstDocxService = new TypstDocxService();
		}

		try {
			new Notice("Converting to DOCX...");

			// Read markdown content
			const markdown = await this.app.vault.read(file);

			// Get metadata for script/template selection
			const cache = this.app.metadataCache.getFileCache(file);

			// Select script (uses frontmatter > folder mapping > default)
			const selectedScript = this.typstConverter.selectScript(
				file,
				cache,
			);

			// Select template (if enabled)
			const selectedTemplate = this.settings.typst.enableTemplateSystem
				? this.typstConverter.selectTemplate(file, cache)
				: undefined;

			// Convert Markdown to Typst using the full template/script pipeline
			const typstCode = await this.typstConverter.convertMarkdown(
				markdown,
				{
					transformMode: "script",
					scriptName: selectedScript,
					templateName: selectedTemplate,
					maxEmbedDepth: this.settings.typst.maxEmbedDepth,
					currentFile: file.path,
				},
			);

			// Extract file references from Typst code and load them
			const files = await this.collectReferencedFiles(typstCode, file);

			// Convert Typst to DOCX using WASM
			let docxData: Uint8Array;
			if (Object.keys(files).length > 0) {
				docxData =
					await this.typstDocxService.convertTypstToDocxWithFiles(
						typstCode,
						files,
					);
			} else {
				docxData =
					await this.typstDocxService.convertTypstToDocx(typstCode);
			}

			// Build output path
			const docxPath = file.path.replace(/\.md$/i, ".docx");

			// Write DOCX file
			await this.app.vault.adapter.writeBinary(docxPath, docxData);

			new Notice(`DOCX exported: ${docxPath}`);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			console.error("DOCX export failed:", error);
			new Notice(`DOCX export failed: ${message}`);
		}
	}

	/**
	 * Collect all referenced files (images, PDFs) from Typst code
	 */
	private async collectReferencedFiles(
		typstCode: string,
		sourceFile: TFile,
	): Promise<Record<string, Uint8Array>> {
		const files: Record<string, Uint8Array> = {};

		// Match #image("path") patterns
		const imagePattern = /#image\s*\(\s*"([^"]+)"/g;
		let match;

		while ((match = imagePattern.exec(typstCode)) !== null) {
			const filePath = match[1];
			// Skip if already loaded or is a URL
			if (files[filePath] || filePath.startsWith("http")) {
				continue;
			}

			try {
				// Resolve relative path from source file
				const resolvedPath = this.resolveFilePath(filePath, sourceFile);
				if (resolvedPath) {
					const data =
						await this.app.vault.adapter.readBinary(resolvedPath);
					files[filePath] = new Uint8Array(data);
					console.log(`Loaded embedded file: ${filePath}`);
				}
			} catch (error) {
				console.warn(
					`Failed to load referenced file: ${filePath}`,
					error,
				);
			}
		}

		return files;
	}

	/**
	 * Resolve a file path relative to the source file
	 */
	private resolveFilePath(
		filePath: string,
		sourceFile: TFile,
	): string | null {
		// Remove leading slash if present
		const cleanPath = filePath.replace(/^\//, "");

		// Try direct path first
		const directFile = this.app.vault.getAbstractFileByPath(cleanPath);
		if (directFile instanceof TFile) {
			return directFile.path;
		}

		// Try relative to source file directory
		const sourceDir = sourceFile.parent?.path || "";
		const relativePath = sourceDir
			? `${sourceDir}/${cleanPath}`
			: cleanPath;
		const relativeFile = this.app.vault.getAbstractFileByPath(relativePath);
		if (relativeFile instanceof TFile) {
			return relativeFile.path;
		}

		// Try to find by name in vault
		const fileName = cleanPath.split("/").pop();
		if (fileName) {
			const allFiles = this.app.vault.getFiles();
			const found = allFiles.find((f) => f.name === fileName);
			if (found) {
				return found.path;
			}
		}

		return null;
	}

	private registerTypstCommands(): void {
		const checkConvertToTypst = (
			checking: boolean,
			format: "pdf" | "png" | "svg",
		) => {
			if (!this.typstConverter) {
				return false;
			}
			const file = this.app.workspace.getActiveFile();
			if (!file || file.extension.toLowerCase() !== "md") {
				return false;
			}
			if (checking) {
				return true;
			}
			this.typstConverter
				.convertFile(file, this.app.metadataCache.getFileCache(file), {
					silent: false,
					format,
				})
				.catch((error) =>
					console.error("Typst conversion failed", error),
				);
			return true;
		};

		this.addCommand({
			id: "convert-to-typst-pdf",
			name: "Convert current note to Typst and compile to PDF",
			checkCallback: (checking) => checkConvertToTypst(checking, "pdf"),
		});

		this.addCommand({
			id: "convert-to-typst-png",
			name: "Convert current note to Typst and compile to PNG",
			checkCallback: (checking) => checkConvertToTypst(checking, "png"),
		});

		this.addCommand({
			id: "convert-to-typst-svg",
			name: "Convert current note to Typst and compile to SVG",
			checkCallback: (checking) => checkConvertToTypst(checking, "svg"),
		});

		this.addCommand({
			id: "open-typst-preview",
			name: "Open Typst preview",
			checkCallback: (checking) => {
				if (!this.settings.typst?.enableCodeBlock) {
					return false;
				}
				if (checking) {
					return true;
				}
				this.activateTypstPreviewView();
				return true;
			},
		});

		// DOCX export command (WASM-based, no CLI required)
		this.addCommand({
			id: "convert-to-typst-docx",
			name: "Convert current note to Typst and export to DOCX (WASM)",
			checkCallback: (checking) => {
				if (!this.typstConverter) {
					return false;
				}
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension.toLowerCase() !== "md") {
					return false;
				}
				if (checking) {
					return true;
				}
				this.exportToDocx(file).catch((error) =>
					console.error("DOCX export failed", error),
				);
				return true;
			},
		});

		this.addCommand({
			id: "clean-typst-intermediate-files",
			name: "Clean intermediate .typ files",
			callback: async () => {
				if (!this.typstConverter) {
					new Notice("Typst converter not initialized");
					return;
				}

				const confirmed = await this.showConfirmDialog(
					"Clean .typ files",
					"This will delete all intermediate .typ files. Continue?",
				);

				if (!confirmed) {
					return;
				}

				try {
					const count = await this.cleanTypstFiles();
					new Notice(`Cleaned ${count} .typ file(s)`);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					new Notice(`Failed to clean: ${message}`);
				}
			},
		});
	}
}
