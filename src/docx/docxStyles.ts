/**
 * DOCX Viewer Styles for Shadow DOM
 * These styles are injected into the Shadow DOM to ensure complete isolation
 * from external CSS while maintaining full styling capabilities.
 */

export const DOCX_STYLES = `
/* ========================================
   DOCX Viewer Styles (Shadow DOM Isolated)
   ======================================== */

/* Main container */
.docx-view-content {
	max-width: 800px;
	margin: 0 auto;
	background: var(--background-primary);
	min-height: 100%;
}

/* Loading state */
.docx-view-loading {
	text-align: center;
	color: var(--text-muted);
}

/* Document wrapper - white background for document content */
.docx-document-wrapper {
	background: white;
	color: black;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	border-radius: 4px;
	box-sizing: border-box;
	margin: 0 auto;
	font-family: "SimSun", serif;
	font-size: 10.5pt;
	line-height: 1.7;
}

/* Paragraph base styles */
.docx-paragraph {
	margin: 0;
	padding: 0;
	white-space: pre-wrap;
	word-wrap: break-word;
	margin-bottom: 0.5em;
}

/* Paragraph alignment */
.docx-align-left {
	text-align: left;
}

.docx-align-center {
	text-align: center;
}

.docx-align-right {
	text-align: right;
}

.docx-align-justify {
	text-align: justify;
}

/* Heading styles */
.docx-heading1 {
	font-size: 24pt;
	font-weight: bold;
	margin-top: 24px;
	margin-bottom: 12px;
}

.docx-heading2 {
	font-size: 18pt;
	font-weight: bold;
	margin-top: 18px;
	margin-bottom: 8px;
}

.docx-heading3 {
	font-size: 14pt;
	font-weight: bold;
	margin-top: 14px;
	margin-bottom: 6px;
}

/* Run text styles */
.docx-bold {
	font-weight: bold;
}

.docx-italic {
	font-style: italic;
}

.docx-underline {
	text-decoration: underline;
}

.docx-strike {
	text-decoration: line-through;
}

.docx-underline.docx-strike {
	text-decoration: underline line-through;
}

.docx-superscript {
	vertical-align: super;
	font-size: 0.8em;
}

.docx-subscript {
	vertical-align: sub;
	font-size: 0.8em;
}

/* Link styles */
.docx-link {
	color: inherit;
	text-decoration: none;
	cursor: pointer;
}

.docx-link.docx-underline {
	text-decoration: underline;
}

/* Page break */
.docx-page-break {
	border-top: 2px dashed #ccc;
	margin: 2em 0;
}

.docx-line-break {
	border-top: 2px dashed #ccc;
	margin: 1em 0;
}

/* Drawing container */
.docx-drawing {
	display: inline-block;
	vertical-align: bottom;
	width: auto;
	height: auto;
	position: relative;
}

/* Image styles */
.docx-image {
	width: 100%;
	height: 100%;
	display: block;
	object-fit: contain;
}

/* Shape SVG container */
.docx-shape-svg {
	position: absolute;
	left: 0;
	top: 0;
}

/* Shape textbox */
.docx-shape-textbox {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 4px;
	box-sizing: border-box;
	overflow: hidden;
}

/* VML Object */
.docx-object {
	display: inline-block;
	vertical-align: bottom;
}

/* Table styles */
.docx-table {
	border-collapse: collapse;
	margin: 8px 0;
}

.docx-table-center {
	margin-left: auto;
	margin-right: auto;
}

/* Table cell base styles */
.docx-table td {
	padding: 4px 8px;
	vertical-align: top;
}

/* Table cell vertical alignment */
.docx-cell-valign-top {
	vertical-align: top;
}

.docx-cell-valign-middle {
	vertical-align: middle;
}

.docx-cell-valign-bottom {
	vertical-align: bottom;
}

/* Error display */
.docx-view-error {
	text-align: center;
	padding: 40px;
	color: var(--text-error);
}

.docx-error-title {
	font-weight: bold;
	margin-bottom: 10px;
}

.docx-error-message {
	margin-top: 10px;
	font-size: 12px;
	white-space: pre-wrap;
	font-family: var(--font-monospace);
}
`;
