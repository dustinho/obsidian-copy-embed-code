import { Menu, Notice, Plugin, TFile } from 'obsidian';

/**
 * Plugin that adds "Copy Embed Code" to the right-click context menu for images.
 * Works in Live Preview, Reading Mode, and handles nested embeds.
 *
 * - Local images: Copies wikilink format ![[filename.png]]
 * - External images: Copies markdown format ![](url)
 */
export default class CopyEmbedUrlPlugin extends Plugin {
	private lastClickedImage: { src: string; isExternal: boolean } | null = null;

	async onload() {
		// Capture image info when user right-clicks (before menu appears)
		this.registerDomEvent(document, 'contextmenu', (evt: MouseEvent) => {
			this.captureImageInfo(evt);
		}, true);

		// Hook into Obsidian's editor menu API (works in edit mode)
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu) => {
				this.addMenuItemIfImage(menu);
			})
		);

		// Fallback: inject into DOM for reading mode and nested embeds
		// where editor-menu event doesn't fire
		this.registerDomEvent(document, 'contextmenu', () => {
			if (this.lastClickedImage) {
				setTimeout(() => this.injectIntoExistingMenu(), 0);
			}
		});
	}

	/**
	 * Checks if the right-click target is an image and stores its info.
	 * Walks up the DOM tree to handle clicks on nested elements.
	 */
	private captureImageInfo(evt: MouseEvent): void {
		let target = evt.target as HTMLElement | null;
		let imgElement: HTMLImageElement | null = null;

		while (target) {
			if (target.tagName === 'IMG') {
				imgElement = target as HTMLImageElement;
				break;
			}
			target = target.parentElement;
		}

		if (!imgElement) {
			this.lastClickedImage = null;
			return;
		}

		const src = imgElement.getAttribute('src') || imgElement.src;
		if (!src) {
			this.lastClickedImage = null;
			return;
		}

		const isExternal = src.startsWith('http://') || src.startsWith('https://');
		this.lastClickedImage = { src, isExternal };
	}

	/**
	 * Adds menu item via Obsidian's Menu API (used by editor-menu event).
	 */
	private addMenuItemIfImage(menu: Menu): void {
		if (!this.lastClickedImage) return;

		const { src, isExternal } = this.lastClickedImage;

		menu.addItem((item) => {
			item
				.setTitle('Copy embed code')
				.setIcon('copy')
				.onClick(() => this.copyEmbedCode(src, isExternal));
		});
	}

	/**
	 * Injects menu item directly into DOM for cases where editor-menu doesn't fire.
	 * Finds Obsidian's .menu element and appends our item.
	 */
	private injectIntoExistingMenu(): void {
		if (!this.lastClickedImage) return;

		const menuEl = document.querySelector('.menu:not([data-copy-embed-injected])');
		if (!menuEl) return;

		// Prevent duplicate injections
		menuEl.setAttribute('data-copy-embed-injected', 'true');

		const { src, isExternal } = this.lastClickedImage;

		const menuItem = document.createElement('div');
		menuItem.className = 'menu-item';

		// Build icon element
		const iconDiv = document.createElement('div');
		iconDiv.className = 'menu-item-icon';
		const svgNS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(svgNS, 'svg');
		svg.setAttribute('width', '24');
		svg.setAttribute('height', '24');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '2');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');
		svg.classList.add('svg-icon', 'lucide-copy');
		const rect = document.createElementNS(svgNS, 'rect');
		rect.setAttribute('x', '9');
		rect.setAttribute('y', '9');
		rect.setAttribute('width', '13');
		rect.setAttribute('height', '13');
		rect.setAttribute('rx', '2');
		rect.setAttribute('ry', '2');
		const path = document.createElementNS(svgNS, 'path');
		path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
		svg.appendChild(rect);
		svg.appendChild(path);
		iconDiv.appendChild(svg);

		// Build title element
		const titleDiv = document.createElement('div');
		titleDiv.className = 'menu-item-title';
		titleDiv.textContent = 'Copy embed code';

		menuItem.appendChild(iconDiv);
		menuItem.appendChild(titleDiv);

		menuItem.addEventListener('click', () => {
			void this.copyEmbedCode(src, isExternal);
			(menuEl as HTMLElement).classList.add('is-hidden');
		});

		menuItem.addEventListener('mouseenter', () => menuItem.classList.add('selected'));
		menuItem.addEventListener('mouseleave', () => menuItem.classList.remove('selected'));

		menuEl.appendChild(menuItem);
	}

	/**
	 * Copies the appropriate embed code to clipboard and shows notification.
	 */
	private async copyEmbedCode(src: string, isExternal: boolean): Promise<void> {
		const embedCode = this.generateEmbedCode(src, isExternal);
		if (embedCode) {
			await navigator.clipboard.writeText(embedCode);
			new Notice(`Copied: ${embedCode}`);
		} else {
			new Notice('Could not determine image path');
		}
	}

	/**
	 * Generates the embed code based on image type.
	 * - External URLs: ![](url)
	 * - Local files: ![[filename]]
	 */
	private generateEmbedCode(src: string, isExternal: boolean): string | null {
		if (isExternal) {
			return `![](${src})`;
		}

		// Try to resolve vault file for accurate filename
		const imageFile = this.resolveImageFile(src);
		if (imageFile) {
			return `![[${imageFile.name}]]`;
		}

		// Fallback: extract filename from src path
		const fallbackName = this.extractFilenameFromSrc(src);
		if (fallbackName) {
			return `![[${fallbackName}]]`;
		}

		return null;
	}

	/**
	 * Extracts filename from a src URL/path by taking the last path segment.
	 */
	private extractFilenameFromSrc(src: string): string | null {
		try {
			let decoded = decodeURIComponent(src);

			const queryIndex = decoded.indexOf('?');
			if (queryIndex !== -1) {
				decoded = decoded.substring(0, queryIndex);
			}

			const segments = decoded.split('/');
			const lastSegment = segments[segments.length - 1];

			if (lastSegment && /\.\w+$/.test(lastSegment)) {
				return lastSegment;
			}
		} catch {
			const match = src.match(/([^/\\?]+\.\w+)(?:\?|$)/);
			if (match && match[1]) {
				return match[1];
			}
		}

		return null;
	}

	/**
	 * Attempts to find the TFile in the vault matching the image src.
	 * Handles Obsidian's app:// URL format and encoded paths.
	 */
	private resolveImageFile(src: string): TFile | null {
		let decodedPath = '';

		try {
			decodedPath = decodeURIComponent(src);
		} catch {
			decodedPath = src;
		}

		// Handle Obsidian's internal app:// URL format
		const appUrlMatch = decodedPath.match(/app:\/\/[^/]+\/(.+?)(?:\?|$)/);
		if (appUrlMatch && appUrlMatch[1]) {
			decodedPath = appUrlMatch[1];
		}

		const queryIndex = decodedPath.indexOf('?');
		if (queryIndex !== -1) {
			decodedPath = decodedPath.substring(0, queryIndex);
		}

		const allFiles = this.app.vault.getFiles();

		// Try exact path match
		for (const file of allFiles) {
			if (decodedPath.endsWith(file.path) || file.path === decodedPath) {
				return file;
			}
		}

		// Try filename match
		const filename = this.extractFilenameFromSrc(src);
		if (filename) {
			for (const file of allFiles) {
				if (file.name === filename) {
					return file;
				}
			}
		}

		return null;
	}

	onunload() {
		this.lastClickedImage = null;
	}
}
