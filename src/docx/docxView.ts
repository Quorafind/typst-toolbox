/**
 * DOCX File View
 * Renders DOCX files directly in Obsidian using rust-docx WASM
 * Based on NativeViewer implementation pattern
 */

import { TextFileView, WorkspaceLeaf, TFile } from "obsidian";
import { DocxViewerService } from "./docxViewerService";

export const DOCX_VIEW_TYPE = "docx-view";

// Unit conversion constants
const TWIPS_TO_PX = 96 / 1440;
const EMU_TO_PX = 96 / 914400;
const HALF_PT_TO_PT = 0.5;

interface DocxJSON {
	page: PageConfig;
	content: DocxBlock[];
	images: Record<string, string>;
	defaults?: { fontSize?: string; font?: string };
	header?: { content: DocxBlock[] };
	footer?: { content: DocxBlock[] };
}

interface PageConfig {
	width: number;
	height: number;
	margin: { top: number; bottom: number; left: number; right: number };
}

interface DocxBlock {
	type: string;
	[key: string]: any;
}

interface DocxParagraph extends DocxBlock {
	type: "paragraph";
	props?: ParagraphProps;
	runs?: DocxRun[];
}

interface ParagraphProps {
	jc?: string;
	indLeft?: number;
	indRight?: number;
	indFirstLine?: number;
	indHanging?: number;
	spacingBefore?: number;
	spacingAfter?: number;
	spacingLine?: number;
	lineRule?: string;
	styleId?: string;
}

interface DocxRun {
	type: string;
	text?: string;
	props?: RunProps;
	drawing?: Drawing;
	object?: VmlObject;
	link?: LinkInfo;
}

interface RunProps {
	bold?: boolean;
	italic?: boolean;
	underline?: string;
	strike?: boolean;
	color?: string;
	highlight?: string;
	size?: string;
	font?: string;
	vertAlign?: string;
}

interface Drawing {
	type: string;
	width: number;
	height: number;
	posH?: number;
	posV?: number;
	alignH?: string;
	alignV?: string;
	behindDoc?: boolean;
	pic?: { imageRef: string };
	shape?: Shape;
}

interface Shape {
	geom: string;
	fillColor?: string;
	fillImage?: string;
	strokeColor?: string;
	strokeWidth?: number;
	content?: DocxBlock[];
}

interface VmlObject {
	imageRef: string;
	width: number;
	height: number;
}

interface LinkInfo {
	id?: string;
	anchor?: string;
	tooltip?: string;
}

interface DocxTable extends DocxBlock {
	type: "table";
	props?: TableProps;
	grid?: number[];
	rows: TableRow[];
}

interface TableProps {
	width?: number;
	widthType?: string;
	jc?: string;
	borders?: TableBorders;
}

interface TableBorders {
	top?: Border;
	bottom?: Border;
	left?: Border;
	right?: Border;
	insideH?: Border;
	insideV?: Border;
}

interface Border {
	style?: string;
	size?: number;
	color?: string;
}

interface TableRow {
	height?: number;
	cells: TableCell[];
}

interface TableCell {
	width?: number;
	gridSpan?: number;
	vMerge?: string;
	vAlign?: string;
	shade?: string;
	borders?: TableBorders;
	content: DocxBlock[];
}

export class DocxView extends TextFileView {
	private viewerService: DocxViewerService;
	private contentContainer: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.viewerService = new DocxViewerService();
	}

	getViewType(): string {
		return DOCX_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "DOCX Viewer";
	}

	getIcon(): string {
		return "file-text";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("docx-view");

		this.contentContainer = container.createDiv({
			cls: "docx-view-content",
		});
	}

	async onClose(): Promise<void> {
		this.contentContainer?.empty();
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		await this.renderDocx();
	}

	getViewData(): string {
		return "";
	}

	setViewData(data: string, clear: boolean): void {}

	clear(): void {
		this.contentContainer?.empty();
	}

	private async renderDocx(): Promise<void> {
		if (!this.file) return;

		this.contentContainer.empty();

		const loadingEl = this.contentContainer.createDiv({
			cls: "docx-view-loading",
			text: "Loading DOCX...",
		});

		try {
			const arrayBuffer = await this.app.vault.adapter.readBinary(
				this.file.path,
			);
			const docxData = new Uint8Array(arrayBuffer);
			const json: DocxJSON =
				await this.viewerService.parseDocxToJson(docxData);

			loadingEl.remove();

			const wrapper = this.contentContainer.createDiv({
				cls: "docx-document-wrapper",
			});

			// Apply page dimensions and margins from DOCX
			if (json.page) {
				const { width, height, margin } = json.page;

				// Page width and minimum height
				if (width) {
					wrapper.style.width = `${width * TWIPS_TO_PX}px`;
				}
				if (height) {
					wrapper.style.minHeight = `${height * TWIPS_TO_PX}px`;
				}

				// Page margins as padding
				if (margin) {
					wrapper.style.paddingTop = `${(margin.top || 0) * TWIPS_TO_PX}px`;
					wrapper.style.paddingBottom = `${(margin.bottom || 0) * TWIPS_TO_PX}px`;
					wrapper.style.paddingLeft = `${(margin.left || 0) * TWIPS_TO_PX}px`;
					wrapper.style.paddingRight = `${(margin.right || 0) * TWIPS_TO_PX}px`;
				}
			}

			// Apply dynamic font settings via CSS custom properties
			if (json.defaults?.font) {
				wrapper.style.setProperty(
					"--docx-font-family",
					`"${json.defaults.font}", "SimSun", serif`,
				);
				wrapper.style.fontFamily = `var(--docx-font-family)`;
			}
			if (json.defaults?.fontSize) {
				const fontSize =
					parseInt(json.defaults.fontSize) * HALF_PT_TO_PT;
				wrapper.style.setProperty("--docx-font-size", `${fontSize}pt`);
				wrapper.style.fontSize = `var(--docx-font-size)`;
			}

			this.renderContent(json.content, wrapper, json.images);
		} catch (error) {
			loadingEl.remove();
			this.showError(error);
		}
	}

	private renderContent(
		content: DocxBlock[],
		container: HTMLElement,
		images: Record<string, string>,
	): void {
		for (const block of content) {
			if (!block || !block.type) continue;

			switch (block.type) {
				case "paragraph":
					this.renderParagraph(
						block as DocxParagraph,
						container,
						images,
					);
					break;
				case "table":
					this.renderTable(block as DocxTable, container, images);
					break;
				case "pageBreak":
					container.createEl("hr", { cls: "docx-page-break" });
					break;
				case "sectionBreak":
					break;
			}
		}
	}

	private renderParagraph(
		para: DocxParagraph,
		container: HTMLElement,
		images: Record<string, string>,
	): void {
		const p = container.createEl("p", { cls: "docx-paragraph" });
		this.applyParagraphStyle(p, para.props);

		if (para.runs) {
			for (const run of para.runs) {
				this.renderRun(run, p, images);
			}
		}

		if (!p.textContent && p.children.length === 0) {
			p.innerHTML = "&nbsp;";
		}
	}

	private applyParagraphStyle(el: HTMLElement, props?: ParagraphProps): void {
		if (!props) return;

		// Alignment - use CSS classes
		if (props.jc) {
			const alignMap: Record<string, string> = {
				left: "docx-align-left",
				start: "docx-align-left",
				center: "docx-align-center",
				right: "docx-align-right",
				end: "docx-align-right",
				both: "docx-align-justify",
				distribute: "docx-align-justify",
			};
			const alignClass = alignMap[props.jc];
			if (alignClass) el.addClass(alignClass);
		}

		// Dynamic indentation values (must use inline styles for computed values)
		if (props.indLeft) {
			el.style.marginLeft = `${props.indLeft * TWIPS_TO_PX}px`;
		}
		if (props.indRight) {
			el.style.marginRight = `${props.indRight * TWIPS_TO_PX}px`;
		}
		if (props.indFirstLine) {
			el.style.textIndent = `${props.indFirstLine * TWIPS_TO_PX}px`;
		}
		if (props.indHanging) {
			el.style.textIndent = `${-props.indHanging * TWIPS_TO_PX}px`;
			el.style.paddingLeft = `${props.indHanging * TWIPS_TO_PX}px`;
		}

		// Dynamic spacing values
		if (props.spacingBefore) {
			el.style.marginTop = `${props.spacingBefore * TWIPS_TO_PX}px`;
		}
		if (props.spacingAfter) {
			el.style.marginBottom = `${props.spacingAfter * TWIPS_TO_PX}px`;
		}

		// Line spacing
		if (props.spacingLine && props.spacingLine > 0) {
			const rule = props.lineRule || "auto";
			if (rule === "auto") {
				el.style.lineHeight = (props.spacingLine / 240).toFixed(2);
			} else {
				el.style.lineHeight = `${props.spacingLine * TWIPS_TO_PX}px`;
			}
		}

		// Heading styles - use CSS classes
		if (props.styleId) {
			const styleId = props.styleId.toLowerCase();
			if (/heading1|标题\s?1/.test(styleId)) {
				el.addClass("docx-heading1");
			} else if (/heading2|标题\s?2/.test(styleId)) {
				el.addClass("docx-heading2");
			} else if (/heading3|标题\s?3/.test(styleId)) {
				el.addClass("docx-heading3");
			}
		}
	}

	private renderRun(
		run: DocxRun,
		container: HTMLElement,
		images: Record<string, string>,
	): void {
		if (!run) return;

		switch (run.type) {
			case "text":
				this.renderTextRun(run, container);
				break;
			case "tab":
				container.createSpan({ text: "\t" });
				break;
			case "break":
				if (run.text === "page") {
					container.createEl("hr", { cls: "docx-line-break" });
				} else {
					container.createEl("br");
				}
				break;
			case "image":
				if (run.drawing) {
					this.renderDrawing(run.drawing, container, images);
				}
				break;
			case "object":
				if (run.object) {
					this.renderVmlObject(run.object, container, images);
				}
				break;
		}
	}

	private renderTextRun(run: DocxRun, container: HTMLElement): void {
		const span = container.createSpan();
		this.applyRunStyle(span, run.props);
		span.textContent = run.text || "";

		if (run.link) {
			const wrapper = container.createEl("a", { cls: "docx-link" });

			if (run.link.anchor) {
				wrapper.href = `#${run.link.anchor}`;
			}
			if (run.link.tooltip) {
				wrapper.title = run.link.tooltip;
			}
			if (run.props?.underline) {
				wrapper.addClass("docx-underline");
			}

			// Move span inside link
			container.removeChild(span);
			wrapper.appendChild(span);
		}
	}

	private applyRunStyle(el: HTMLElement, props?: RunProps): void {
		if (!props) return;

		// Use CSS classes for common styles
		if (props.bold) el.addClass("docx-bold");
		if (props.italic) el.addClass("docx-italic");
		if (props.underline && props.underline !== "none") {
			el.addClass("docx-underline");
		}
		if (props.strike) {
			el.addClass("docx-strike");
		}
		if (props.vertAlign === "superscript") {
			el.addClass("docx-superscript");
		} else if (props.vertAlign === "subscript") {
			el.addClass("docx-subscript");
		}

		// Dynamic color values (must use inline styles)
		if (props.color && props.color !== "auto") {
			el.style.color = `#${props.color}`;
		}
		if (props.highlight) {
			el.style.backgroundColor = this.getHighlightColor(props.highlight);
		}
		if (props.size) {
			el.style.fontSize = `${parseInt(props.size) * HALF_PT_TO_PT}pt`;
		}
		if (props.font) {
			el.style.fontFamily = `"${props.font}", serif`;
		}
	}

	private renderDrawing(
		drawing: Drawing,
		container: HTMLElement,
		images: Record<string, string>,
	): void {
		const width = drawing.width * EMU_TO_PX;
		const height = drawing.height * EMU_TO_PX;

		const wrapper = container.createDiv({ cls: "docx-drawing" });
		// Dynamic size must use inline styles
		wrapper.style.maxWidth = `min(${width}px, 100%)`;
		wrapper.style.aspectRatio = `${width} / ${height}`;

		if (drawing.pic?.imageRef && images[drawing.pic.imageRef]) {
			this.renderPicture(drawing.pic.imageRef, images, wrapper);
		} else if (drawing.shape) {
			this.renderShape(drawing.shape, width, height, wrapper, images);
		}
	}

	private renderPicture(
		imageRef: string,
		images: Record<string, string>,
		container: HTMLElement,
	): void {
		const imgData = images[imageRef];
		if (!imgData) return;

		if (imgData.startsWith("data:image/svg+xml;base64,")) {
			try {
				const svgContent = atob(
					imgData.replace("data:image/svg+xml;base64,", ""),
				);
				container.innerHTML = svgContent;
				const svg = container.querySelector("svg");
				if (svg) {
					svg.style.width = "100%";
					svg.style.height = "100%";
				}
				return;
			} catch {}
		}

		const img = container.createEl("img", { cls: "docx-image" });
		img.src = imgData;
	}

	private renderShape(
		shape: Shape,
		width: number,
		height: number,
		container: HTMLElement,
		images: Record<string, string>,
	): void {
		// Image fill
		if (shape.fillImage && images[shape.fillImage]) {
			this.renderPicture(shape.fillImage, images, container);
			return;
		}

		const isLine =
			shape.geom === "line" || shape.geom === "straightConnector1";
		const strokeWidth = shape.strokeWidth
			? shape.strokeWidth * EMU_TO_PX
			: isLine
				? 1
				: 0;
		const strokeColor = shape.strokeColor || "#000000";
		const fillColor = shape.fillColor || "none";

		// Create SVG
		const svgNS = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(svgNS, "svg");
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		svg.setAttribute("preserveAspectRatio", "none");
		svg.classList.add("docx-shape-svg");

		let shapeEl: SVGElement;

		switch (shape.geom) {
			case "ellipse":
			case "circle":
				shapeEl = document.createElementNS(svgNS, "ellipse");
				shapeEl.setAttribute("cx", String(width / 2));
				shapeEl.setAttribute("cy", String(height / 2));
				shapeEl.setAttribute("rx", String(width / 2));
				shapeEl.setAttribute("ry", String(height / 2));
				break;
			case "line":
			case "straightConnector1":
				shapeEl = document.createElementNS(svgNS, "line");
				shapeEl.setAttribute("x1", "0");
				shapeEl.setAttribute("y1", String(height / 2));
				shapeEl.setAttribute("x2", String(width));
				shapeEl.setAttribute("y2", String(height / 2));
				break;
			case "roundRect":
				shapeEl = document.createElementNS(svgNS, "rect");
				const radius = Math.min(width, height) * 0.1;
				shapeEl.setAttribute("x", "0");
				shapeEl.setAttribute("y", "0");
				shapeEl.setAttribute("width", String(width));
				shapeEl.setAttribute("height", String(height));
				shapeEl.setAttribute("rx", String(radius));
				shapeEl.setAttribute("ry", String(radius));
				break;
			default:
				shapeEl = document.createElementNS(svgNS, "rect");
				shapeEl.setAttribute("x", "0");
				shapeEl.setAttribute("y", "0");
				shapeEl.setAttribute("width", String(width));
				shapeEl.setAttribute("height", String(height));
		}

		shapeEl.setAttribute("fill", fillColor);
		shapeEl.setAttribute("stroke", strokeWidth > 0 ? strokeColor : "none");
		shapeEl.setAttribute("stroke-width", String(strokeWidth));

		svg.appendChild(shapeEl);
		container.appendChild(svg);

		// Text content in shape
		if (shape.content && shape.content.length > 0) {
			const textBox = container.createDiv({ cls: "docx-shape-textbox" });
			this.renderContent(shape.content, textBox, images);
		}
	}

	private renderVmlObject(
		object: VmlObject,
		container: HTMLElement,
		images: Record<string, string>,
	): void {
		if (!object.imageRef || !images[object.imageRef]) return;

		const width = object.width * EMU_TO_PX;
		const height = object.height * EMU_TO_PX;
		const imgData = images[object.imageRef];

		const wrapper = container.createSpan({ cls: "docx-object" });
		// Dynamic size must use inline styles
		if (width > 0) wrapper.style.width = `${width}px`;
		if (height > 0) wrapper.style.height = `${height}px`;

		if (imgData.startsWith("data:image/svg+xml;base64,")) {
			try {
				const svgContent = atob(
					imgData.replace("data:image/svg+xml;base64,", ""),
				);
				wrapper.innerHTML = svgContent;
				return;
			} catch {}
		}

		const img = wrapper.createEl("img", { cls: "docx-image" });
		img.src = imgData;
	}

	private renderTable(
		table: DocxTable,
		container: HTMLElement,
		images: Record<string, string>,
	): void {
		const tableEl = container.createEl("table", { cls: "docx-table" });

		// Table width - dynamic values require inline styles
		if (table.props?.width) {
			if (table.props.widthType === "pct") {
				tableEl.style.width = `${table.props.width / 50}%`;
			} else if (
				table.props.widthType === "auto" ||
				table.props.widthType === "nil"
			) {
				tableEl.style.width = "auto";
			} else {
				tableEl.style.width = `${table.props.width * TWIPS_TO_PX}px`;
			}
		}

		if (table.props?.jc === "center") {
			tableEl.addClass("docx-table-center");
		}

		const tbody = tableEl.createEl("tbody");
		const rowCount = table.rows.length;
		const colCount = table.rows[0]?.cells.length || 0;
		const gridTotal = table.grid?.reduce((a, b) => a + b, 0) || 0;

		for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
			const row = table.rows[rowIndex];
			const tr = tbody.createEl("tr");

			// Dynamic row height
			if (row.height) {
				tr.style.height = `${row.height * TWIPS_TO_PX}px`;
			}

			for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
				const cell = row.cells[cellIndex];

				// Skip continue cells (vertical merge)
				if (cell.vMerge === "continue") continue;

				const td = tr.createEl("td");
				this.applyCellStyle(
					td,
					cell,
					cellIndex,
					rowIndex,
					table,
					rowCount,
					colCount,
					gridTotal,
				);

				// ColSpan
				if (cell.gridSpan && cell.gridSpan > 1) {
					td.colSpan = cell.gridSpan;
				}

				// RowSpan
				if (cell.vMerge === "restart") {
					let rowSpan = 1;
					for (let i = rowIndex + 1; i < table.rows.length; i++) {
						const nextCell = table.rows[i].cells[cellIndex];
						if (nextCell?.vMerge === "continue") {
							rowSpan++;
						} else {
							break;
						}
					}
					if (rowSpan > 1) {
						td.rowSpan = rowSpan;
					}
				}

				// Render cell content
				if (cell.content) {
					this.renderContent(cell.content, td, images);
				}
			}
		}
	}

	private applyCellStyle(
		td: HTMLTableCellElement,
		cell: TableCell,
		cellIndex: number,
		rowIndex: number,
		table: DocxTable,
		rowCount: number,
		colCount: number,
		gridTotal: number,
	): void {
		// Width - dynamic values require inline styles
		if (table.props?.widthType === "pct" && gridTotal > 0) {
			const cellWidth = cell.width || table.grid?.[cellIndex] || 0;
			if (cellWidth > 0) {
				td.style.width = `${(cellWidth / gridTotal) * 100}%`;
			}
		} else if (cell.width) {
			td.style.width = `${cell.width * TWIPS_TO_PX}px`;
		} else if (table.grid?.[cellIndex]) {
			td.style.width = `${table.grid[cellIndex] * TWIPS_TO_PX}px`;
		}

		// Vertical align - use CSS classes
		if (cell.vAlign) {
			const vAlignClassMap: Record<string, string> = {
				top: "docx-cell-valign-top",
				center: "docx-cell-valign-middle",
				bottom: "docx-cell-valign-bottom",
			};
			const vAlignClass = vAlignClassMap[cell.vAlign];
			if (vAlignClass) td.addClass(vAlignClass);
		}

		// Background - dynamic values require inline styles
		if (cell.shade && cell.shade !== "auto") {
			td.style.backgroundColor = `#${cell.shade}`;
		}

		// Borders - dynamic values require inline styles
		const borders =
			cell.borders ||
			this.deriveBorders(
				table.props?.borders,
				rowIndex,
				cellIndex,
				rowCount,
				colCount,
			);
		if (borders) {
			if (borders.top) td.style.borderTop = this.borderToCSS(borders.top);
			if (borders.bottom)
				td.style.borderBottom = this.borderToCSS(borders.bottom);
			if (borders.left)
				td.style.borderLeft = this.borderToCSS(borders.left);
			if (borders.right)
				td.style.borderRight = this.borderToCSS(borders.right);
		}
	}

	private deriveBorders(
		tableBorders: TableBorders | undefined,
		rowIndex: number,
		cellIndex: number,
		rowCount: number,
		colCount: number,
	): TableBorders | null {
		if (!tableBorders) return null;

		const isFirstRow = rowIndex === 0;
		const isLastRow = rowIndex === rowCount - 1;
		const isFirstCol = cellIndex === 0;
		const isLastCol = cellIndex === colCount - 1;

		return {
			top: isFirstRow ? tableBorders.top : tableBorders.insideH,
			bottom: isLastRow ? tableBorders.bottom : tableBorders.insideH,
			left: isFirstCol ? tableBorders.left : tableBorders.insideV,
			right: isLastCol ? tableBorders.right : tableBorders.insideV,
		};
	}

	private borderToCSS(border: Border): string {
		if (!border || border.style === "nil" || border.style === "none") {
			return "none";
		}
		const size = Math.max(1, (border.size || 4) / 8);
		const color =
			border.color && border.color !== "auto"
				? `#${border.color}`
				: "#000000";
		const styleMap: Record<string, string> = {
			single: "solid",
			double: "double",
			dotted: "dotted",
			dashed: "dashed",
			thick: "solid",
		};
		return `${size}px ${styleMap[border.style || "single"] || "solid"} ${color}`;
	}

	private getHighlightColor(name: string): string {
		const colors: Record<string, string> = {
			yellow: "#ffff00",
			green: "#00ff00",
			cyan: "#00ffff",
			magenta: "#ff00ff",
			blue: "#0000ff",
			red: "#ff0000",
			darkBlue: "#000080",
			darkCyan: "#008080",
			darkGreen: "#008000",
			darkMagenta: "#800080",
			darkRed: "#800000",
			darkYellow: "#808000",
			darkGray: "#808080",
			lightGray: "#c0c0c0",
			black: "#000000",
		};
		return colors[name] || name;
	}

	private showError(error: unknown): void {
		const errorContainer = this.contentContainer.createDiv({
			cls: "docx-view-error",
		});

		errorContainer.createDiv({
			cls: "docx-error-title",
			text: "Failed to load DOCX",
		});

		const message = error instanceof Error ? error.message : String(error);
		errorContainer.createEl("pre", {
			cls: "docx-error-message",
			text: message,
		});
	}
}
