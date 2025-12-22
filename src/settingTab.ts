import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TypstToolboxPlugin from "./main";
import { renderTypstSettings } from "./typst/typstSettingTab";
import {
	WasmStorage,
	downloadWasmModules,
	loadLocalZip,
	getLatestVersion,
	type DownloadProgress,
} from "./wasm";

export class TypstToolboxSettingTab extends PluginSettingTab {
	plugin: TypstToolboxPlugin;
	private wasmStorage: WasmStorage;

	constructor(app: App, plugin: TypstToolboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.wasmStorage = new WasmStorage();
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setHeading().setName("Typst Toolbox");

		// DOCX WASM Management Section (for rust-docx and typst-docx-converter)
		this.renderDocxWasmSection(containerEl);

		// Typst Settings Section (only if enabled)
		renderTypstSettings(containerEl, this.plugin, this);
	}

	/**
	 * Render DOCX WASM module management section
	 * For rust-docx (DOCX preview) and typst-docx-converter (Typst→DOCX)
	 */
	private async renderDocxWasmSection(
		containerEl: HTMLElement,
	): Promise<void> {
		const section = containerEl.createDiv({ cls: "docx-wasm-settings" });

		new Setting(section)
			.setHeading()
			.setName("DOCX WASM Modules")
			.setDesc("WASM modules for DOCX preview and Typst→DOCX conversion");

		// Status display
		const statusEl = section.createDiv({ cls: "wasm-status" });
		await this.updateDocxWasmStatus(statusEl);

		// Download from GitHub
		const downloadSetting = new Setting(section)
			.setName("Download from GitHub")
			.setDesc("Download WASM modules from the latest GitHub release");

		const progressEl = section.createDiv({ cls: "wasm-progress" });
		progressEl.style.display = "none";
		progressEl.style.padding = "8px";
		progressEl.style.marginBottom = "8px";
		progressEl.style.backgroundColor = "var(--background-secondary)";
		progressEl.style.borderRadius = "4px";

		downloadSetting.addButton((btn) => {
			btn.setButtonText("Download")
				.setCta()
				.onClick(async () => {
					btn.setDisabled(true);
					progressEl.style.display = "block";

					try {
						const repo = {
							owner: "aspect-apps",
							repo: "typst-toolbox-wasm",
						};

						// Get latest version
						progressEl.textContent = "Checking latest version...";
						const version = await getLatestVersion(repo);

						// Download and extract
						await downloadWasmModules(
							this.wasmStorage,
							version,
							(progress: DownloadProgress) => {
								progressEl.textContent = progress.message;
								if (progress.status === "downloading") {
									const pct = Math.round(
										(progress.loaded / progress.total) *
											100,
									);
									progressEl.textContent = `Downloading: ${pct}%`;
								}
							},
							repo,
						);

						new Notice(
							`WASM modules v${version} installed successfully!`,
						);
						await this.updateDocxWasmStatus(statusEl);
					} catch (error) {
						const msg =
							error instanceof Error
								? error.message
								: "Unknown error";
						new Notice(`Download failed: ${msg}`);
						progressEl.textContent = `Error: ${msg}`;
					} finally {
						btn.setDisabled(false);
						setTimeout(() => {
							progressEl.style.display = "none";
						}, 3000);
					}
				});
		});

		// Load from local file
		new Setting(section)
			.setName("Load from local file")
			.setDesc("Load WASM modules from a local wasm-modules.zip file")
			.addButton((btn) => {
				btn.setButtonText("Select ZIP").onClick(() => {
					const input = document.createElement("input");
					input.type = "file";
					input.accept = ".zip";
					input.onchange = async () => {
						const file = input.files?.[0];
						if (!file) return;

						try {
							const count = await loadLocalZip(
								this.wasmStorage,
								file,
								"local",
							);

							new Notice(
								`Loaded ${count} WASM module(s) from ${file.name}`,
							);
							await this.updateDocxWasmStatus(statusEl);
						} catch (error) {
							const msg =
								error instanceof Error
									? error.message
									: "Unknown error";
							new Notice(`Failed to load: ${msg}`);
						}
					};
					input.click();
				});
			});

		// Clear cache
		new Setting(section)
			.setName("Clear WASM cache")
			.setDesc("Remove all cached DOCX WASM modules")
			.addButton((btn) => {
				btn.setButtonText("Clear")
					.setWarning()
					.onClick(async () => {
						await this.wasmStorage.clear();
						new Notice("DOCX WASM cache cleared");
						await this.updateDocxWasmStatus(statusEl);
					});
			});
	}

	/**
	 * Update the DOCX WASM status display
	 */
	private async updateDocxWasmStatus(statusEl: HTMLElement): Promise<void> {
		statusEl.empty();

		try {
			await this.wasmStorage.initialize();
			const modules = await this.wasmStorage.list();

			if (modules.length === 0) {
				const warningEl = statusEl.createEl("p", {
					text: "⚠️ No DOCX WASM modules installed",
					cls: "wasm-status-warning",
				});
				warningEl.style.color = "var(--text-warning)";
				warningEl.style.marginBottom = "8px";

				// Show required modules
				const infoEl = statusEl.createEl("div", {
					cls: "wasm-required-modules",
				});
				infoEl.style.fontSize = "12px";
				infoEl.style.color = "var(--text-muted)";
				infoEl.createEl("p", {
					text: "Required modules:",
				});
				const list = infoEl.createEl("ul");
				list.style.marginLeft = "16px";
				list.createEl("li", {
					text: "rust-docx (~1.3 MB) - Direct DOCX file preview",
				});
				list.createEl("li", {
					text: "typst-docx-converter (~27 MB) - Typst → DOCX export",
				});
			} else {
				const okEl = statusEl.createEl("p", {
					text: `✅ ${modules.length} module(s) installed`,
					cls: "wasm-status-ok",
				});
				okEl.style.color = "var(--text-success)";
				okEl.style.marginBottom = "8px";

				const list = statusEl.createEl("ul", {
					cls: "wasm-module-list",
				});
				list.style.fontSize = "12px";
				list.style.marginLeft = "16px";

				for (const mod of modules) {
					const sizeMB = (mod.size / 1024 / 1024).toFixed(2);
					const date = new Date(mod.timestamp).toLocaleDateString();
					list.createEl("li", {
						text: `${mod.name}: v${mod.version} (${sizeMB} MB, ${date})`,
					});
				}
			}
		} catch (error) {
			const errorEl = statusEl.createEl("p", {
				text: "❌ Failed to check WASM status",
				cls: "wasm-status-error",
			});
			errorEl.style.color = "var(--text-error)";
		}
	}

	hide(): void {
		this.wasmStorage.close();
	}
}
