/**
 * SettingGroup - A helper class for organizing settings into visual groups
 *
 * This class mimics Obsidian's internal SettingGroup implementation,
 * providing a clean API for creating grouped settings with headers.
 *
 * Usage:
 * ```typescript
 * const group = new SettingGroup(containerEl)
 *     .setHeading("General Settings")
 *     .addSetting(setting => {
 *         setting.setName("Option 1").addToggle(...);
 *     });
 * ```
 */

import { Setting, ExtraButtonComponent, SearchComponent } from "obsidian";

export class SettingGroup {
	private groupEl: HTMLElement;
	private headerEl: HTMLElement;
	private headerInnerEl: HTMLElement;
	private controlEl: HTMLElement;
	private listEl: HTMLElement;
	private searchContainerEl: HTMLElement | null = null;
	private components: (ExtraButtonComponent | SearchComponent)[] = [];

	constructor(container: HTMLElement) {
		// Create the main group container
		this.groupEl = container.createDiv("setting-group");

		// Create header element (detached initially, attached when setHeading is called)
		this.headerEl = document.createElement("div");
		this.headerEl.addClass("setting-item", "setting-item-heading");

		// Header inner elements
		this.headerInnerEl = this.headerEl.createDiv("setting-item-name");
		this.controlEl = this.headerEl.createDiv("setting-item-control");

		// Create the list container for settings
		this.listEl = this.groupEl.createDiv("setting-items");
	}

	/**
	 * Set the heading text for this group
	 * @param text The heading text. If empty, the header will be hidden.
	 */
	setHeading(text: string): this {
		this.headerInnerEl.setText(text);
		const isAttached = this.headerEl.parentElement !== null;

		if (text && !isAttached) {
			// Attach header to the group
			this.groupEl.prepend(this.headerEl);
		} else if (!text && isAttached) {
			// Detach header from the group
			this.headerEl.detach();
		}
		return this;
	}

	/**
	 * Add a CSS class to the group container
	 */
	addClass(className: string): this {
		this.groupEl.addClass(className);
		return this;
	}

	/**
	 * Add a setting to this group
	 * @param callback A function that receives a Setting instance to configure
	 */
	addSetting(callback: (setting: Setting) => void): this {
		const setting = new Setting(this.listEl);
		callback(setting);
		return this;
	}

	/**
	 * Add a search component to the group header
	 * @param callback A function that receives a SearchComponent instance
	 */
	addSearch(callback: (search: SearchComponent) => void): this {
		if (!this.searchContainerEl) {
			this.searchContainerEl = createDiv("setting-group-search");
			this.groupEl.insertBefore(this.searchContainerEl, this.listEl);
		}
		const search = new SearchComponent(this.searchContainerEl);
		this.components.push(search);
		callback(search);
		return this;
	}

	/**
	 * Add an extra button to the group header control area
	 * @param callback A function that receives an ExtraButtonComponent instance
	 */
	addExtraButton(callback: (button: ExtraButtonComponent) => void): this {
		const button = new ExtraButtonComponent(this.controlEl);
		this.components.push(button);
		callback(button);
		return this;
	}

	/**
	 * Get the group container element
	 */
	getGroupEl(): HTMLElement {
		return this.groupEl;
	}

	/**
	 * Get the list container element (where settings are added)
	 */
	getListEl(): HTMLElement {
		return this.listEl;
	}
}
