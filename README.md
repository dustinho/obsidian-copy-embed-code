# Copy Embed Code

An Obsidian plugin that adds a "Copy Embed Code" option to the right-click context menu for images.

## Features

- **Works everywhere**: Live Preview, Reading Mode, and nested embeds (transclusions)
- **Local images**: Copies wikilink format `![[filename.png]]`
- **External images**: Copies markdown format `![](url)`

## The Problem

Obsidian's standard editor-menu API relies on cursor position, but clicking an image doesn't always move the cursor—especially when the image is inside an embed (transclusion), or nested multiple levels deep.

## How It Works

### Event Flow

1. **Right-click captured** - A global `contextmenu` listener (capture phase) detects the click
2. **Image detection** - Walks up the DOM tree from the click target to find any `<img>` element
3. **Menu injection** - Adds "Copy Embed Code" via Obsidian's Menu API or DOM injection
4. **Copy action** - Generates appropriate embed syntax and copies to clipboard

### Handling Nested Embeds

The plugin uses DOM-based detection rather than cursor position:

```
Document
  └── contextmenu listener (capture phase)
        └── Walks up DOM tree from evt.target
              └── Finds <img> regardless of nesting depth
```

This means an image 5 levels deep (blockquote → embed → callout → embed → image) works identically to a top-level image.

### Dual Injection Strategy

| Context | Method |
|---------|--------|
| Edit mode | Hooks into Obsidian's `editor-menu` event |
| Reading mode / nested embeds | Injects directly into `.menu` DOM element |

## Installation

### Manual Installation

1. Download `main.js` and `manifest.json` from the releases
2. Create folder: `<vault>/.obsidian/plugins/copy-embed-url/`
3. Copy files into the folder
4. Enable the plugin in Obsidian settings

### From Source

```bash
npm install
npm run build
```

## Usage

1. Right-click any image in Obsidian
2. Click "Copy Embed Code"
3. Paste the embed code wherever needed

## License

MIT
