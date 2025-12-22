import type { TypstSettings } from "./typst/typstSettings";
import { DEFAULT_TYPST_SETTINGS } from "./typst/typstSettings";

/** WASM module loading configuration */
export interface WasmSettings {
	/** Installed WASM version (empty if not installed) */
	installedVersion: string;
	/** GitHub repo owner for downloading */
	repoOwner: string;
	/** GitHub repo name for downloading */
	repoName: string;
}

export const DEFAULT_WASM_SETTINGS: WasmSettings = {
	installedVersion: "",
	repoOwner: "Quorafind",
	repoName: "obsidian-typst-docx",
};

export interface TypstDocxSettings {
	typst: TypstSettings;
	wasm: WasmSettings;
}

export const DEFAULT_SETTINGS: TypstDocxSettings = {
	typst: DEFAULT_TYPST_SETTINGS,
	wasm: DEFAULT_WASM_SETTINGS,
};
