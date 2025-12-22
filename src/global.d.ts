/**
 * Global type declarations
 */

interface TypstGlobalAPI {
	convert: (
		markdown: string,
		options?: Record<string, unknown>
	) => Promise<string>;
	convertAsync: (
		markdown: string,
		options?: Record<string, unknown>
	) => Promise<string>;
	listScripts: () => Promise<string[]>;
}

interface BonGlobalNamespace {
	typst?: TypstGlobalAPI;
}

declare global {
	interface Window {
		bon?: BonGlobalNamespace;
	}
}

export {};
