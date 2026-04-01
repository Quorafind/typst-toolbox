/**
 * Type definition: the convert function injected into the sandbox
 */
export type ConvertFunction = (markdown: string) => Promise<string>;

/**
 * Execute a user script in an isolated context.
 *
 * **Trust model**: This uses AsyncFunction which is NOT a true security sandbox.
 * The restricted globals are guardrails against accidental misuse, not against
 * malicious scripts. Only run scripts you trust.
 *
 * @param scriptCode - The user script code
 * @param content - The input content (Markdown)
 * @param convertFn - Optional conversion function (AST transformer), injected as convertToTypst
 * @param timeoutMs - Execution timeout in ms (default 10000)
 * @returns Promise resolving to the converted output
 */
export async function executeSandbox(
	scriptCode: string,
	content: string,
	convertFn?: ConvertFunction,
	timeoutMs = 10_000,
): Promise<string> {
	try {
		// Use AsyncFunction constructor for async execution
		const AsyncFunction = Object.getPrototypeOf(
			async function () {}
		).constructor;

		// Create sandboxed function, injecting convertToTypst
		const sandbox = new AsyncFunction(
			"content",
			"convertToTypst",
			`"use strict";
const app = undefined;
const window = undefined;
const global = undefined;
${scriptCode}
if (typeof transform !== "function") {
	throw new Error("Script must define a transform() function");
}
return await transform(content);`
		);

		// If convertFn is not provided, use a no-op function (for backward compatibility)
		const defaultConvertFn = async (s: string) => s;

		// Promise.race ensures async scripts that never resolve still time out
		const raceTimeout = new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new Error("Script timed out")),
				timeoutMs,
			);
		});

		return await Promise.race([
			sandbox(content, convertFn || defaultConvertFn),
			raceTimeout,
		]);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Script execution failed: ${message}`);
	}
}
