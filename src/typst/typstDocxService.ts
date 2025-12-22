/**
 * Typst DOCX Service
 * Provides WASM-based conversion from Typst to DOCX and DOCX preview parsing
 */

import { WasmStorage, type WasmCacheEntry } from "../wasm/storage";

// Dynamic import for WASM module
let wasmModule: any = null;

export class TypstDocxService {
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

			// Load typst-docx-converter (which includes rust-docx functionality)
			const entry = await this.storage.load("typst-docx-converter");
			if (!entry) {
				throw new Error(
					"WASM module 'typst-docx-converter' not found. Please download it in settings."
				);
			}

			// Dynamically import the bindgen module
			const bindgen = await import("../wasm/bindgen/typst_docx");

			// Initialize WASM with the binary data from IndexedDB
			// Create Blob URL for WASM loading
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
				`Typst DOCX Service initialized (v${entry.version}, ${(entry.size / 1024 / 1024).toFixed(2)}MB)`
			);
		} catch (error) {
			console.error("Failed to initialize Typst DOCX Service:", error);
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
	 * Convert Typst source code to DOCX binary data.
	 * @param source Typst source code
	 * @returns DOCX file as Uint8Array
	 */
	async convertTypstToDocx(source: string): Promise<Uint8Array> {
		if (!this.initialized) await this.initialize();

		try {
			return wasmModule.convert_typst_to_docx(source);
		} catch (error) {
			console.error("DOCX Conversion failed:", error);
			throw new Error(
				`DOCX Conversion failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Convert Typst source code to DOCX with additional files (images, etc.)
	 * @param source Typst source code
	 * @param files Object mapping file paths to Uint8Array data
	 * @returns DOCX file as Uint8Array
	 */
	async convertTypstToDocxWithFiles(
		source: string,
		files: Record<string, Uint8Array>
	): Promise<Uint8Array> {
		if (!this.initialized) await this.initialize();

		try {
			return wasmModule.convert_typst_to_docx_with_files(source, files);
		} catch (error) {
			console.error("DOCX Conversion with files failed:", error);
			throw new Error(
				`DOCX Conversion failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Parse DOCX binary data to JSON for preview.
	 * Uses the embedded rust-docx functionality.
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
	 * Get the version of the converter
	 */
	async getVersion(): Promise<string> {
		if (!this.initialized) await this.initialize();
		return wasmModule.get_version();
	}

	/**
	 * Get the WASM storage manager
	 */
	getStorage(): WasmStorage {
		return this.storage;
	}
}
