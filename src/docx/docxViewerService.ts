/**
 * DOCX Viewer Service
 * Lightweight service for directly viewing DOCX files using rust-docx WASM
 * This uses a smaller WASM module (~1.3MB) compared to typst-docx-converter (~27MB)
 */

import { WasmStorage } from "../wasm/storage";

// Dynamic import for WASM module
let wasmModule: any = null;

export class DocxViewerService {
	private storage: WasmStorage;
	private initialized = false;
	private initPromise: Promise<void> | null = null;

	constructor() {
		this.storage = new WasmStorage();
	}

	/**
	 * Initialize the WASM module.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = this.doInitialize();
		return this.initPromise;
	}

	private async doInitialize(): Promise<void> {
		try {
			await this.storage.initialize();

			// Load rust-docx (lightweight DOCX parser)
			const entry = await this.storage.load("rust-docx");
			if (!entry) {
				throw new Error(
					"WASM module 'rust-docx' not found. Please download it in settings."
				);
			}

			// Dynamically import the bindgen module
			const bindgen = await import("../wasm/bindgen/rust_docx");

			// Initialize WASM with the binary data from IndexedDB
			const blob = new Blob([entry.data.buffer], {
				type: "application/wasm",
			});
			const wasmUrl = URL.createObjectURL(blob);

			await bindgen.default(wasmUrl);
			wasmModule = bindgen;

			// Clean up the blob URL
			URL.revokeObjectURL(wasmUrl);

			this.initialized = true;
			console.log(
				`DOCX Viewer Service initialized (v${entry.version}, ${(entry.size / 1024).toFixed(1)}KB)`
			);
		} catch (error) {
			console.error("Failed to initialize DOCX Viewer Service:", error);
			this.initialized = false;
			this.initPromise = null;
			throw error;
		}
	}

	/**
	 * Check if the service is initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Parse DOCX binary data to JSON for rendering.
	 * @param docxData DOCX file as Uint8Array
	 * @returns Parsed document structure as JSON
	 */
	async parseDocxToJson(docxData: Uint8Array): Promise<any> {
		if (!this.initialized) await this.initialize();

		try {
			const result = wasmModule.convertDocxNative(docxData);
			if (result.error) {
				throw new Error(result.error);
			}
			// Parse JSON string to object
			return typeof result.json === "string"
				? JSON.parse(result.json)
				: result.json;
		} catch (error) {
			console.error("DOCX Parsing failed:", error);
			throw new Error(
				`DOCX Parsing failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Convert DOCX to Markdown (legacy interface)
	 * @param docxData DOCX file as Uint8Array
	 * @returns Object with markdown and images
	 */
	async convertDocxToMarkdown(
		docxData: Uint8Array
	): Promise<{ markdown: string; images: Record<string, string> }> {
		if (!this.initialized) await this.initialize();

		try {
			return wasmModule.convertDocx(docxData);
		} catch (error) {
			console.error("DOCX to Markdown conversion failed:", error);
			throw new Error(
				`DOCX conversion failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Get the WASM storage manager
	 */
	getStorage(): WasmStorage {
		return this.storage;
	}
}
