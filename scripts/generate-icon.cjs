/**
 * Generate app icons from SVG.
 * Usage: node scripts/generate-icon.cjs
 * Requires: npm install sharp
 *
 * Generates:
 *   - icon.png       (512×512) macOS Dock, Linux, electron-builder source
 *   - icon@2x.png    (256×256) HiDPI fallback
 *   - icon64.png      (64×64)  Window icon
 *   - icon.ico       Multi-resolution Windows icon (16/32/48/64/128/256)
 */
const fs = require('fs')
const path = require('path')

const svgPath = path.resolve('src/renderer/src/assets/icon.svg')
const outDir = path.resolve('build')

// ICO format: prepend PNG data with a header + directory entries
// Windows 10/11 uses the largest available size for the taskbar
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

function buildIco(pngBuffers) {
  const headerSize = 6
  const entrySize = 16
  const count = pngBuffers.length

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)      // reserved
  header.writeUInt16LE(1, 2)      // ICO type (1 = .ico)
  header.writeUInt16LE(count, 4)  // number of images

  let offset = headerSize + count * entrySize
  const entries = []

  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i]
    const size = ICO_SIZES[i]
    const entry = Buffer.alloc(entrySize)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)   // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)   // height
    entry.writeUInt8(0, 2)                          // color palette
    entry.writeUInt8(0, 3)                          // reserved
    entry.writeUInt16LE(1, 4)                       // color planes
    entry.writeUInt16LE(32, 6)                      // bits per pixel
    entry.writeUInt32LE(png.length, 8)              // image data size
    entry.writeUInt32LE(offset, 12)                 // offset in file
    offset += png.length
    entries.push(entry)
  }

  return Buffer.concat([header, ...entries, ...pngBuffers])
}

// Try sharp if available
try {
  require.resolve('sharp')
  const sharp = require('sharp')
  const svg = fs.readFileSync(svgPath)

  async function generate() {
    // Solid background — Windows renders transparent areas as white
    const bg = { r: 249, g: 115, b: 22 } // #f97316

    async function renderPng(size) {
      return sharp({
        create: { width: size, height: size, channels: 3, background: bg }
      })
        .composite([{ input: await sharp(svg).resize(size, size).png().toBuffer() }])
        .png()
        .toBuffer()
    }

    // 512×512 for macOS Dock, Linux, and electron-builder source
    const png512 = await sharp({
      create: { width: 512, height: 512, channels: 3, background: bg }
    })
      .composite([{ input: await sharp(svg).resize(512, 512).png().toBuffer() }])
      .png()
      .toBuffer()
    fs.writeFileSync(path.join(outDir, 'icon.png'), png512)

    // 256×256 HiDPI
    const png256 = await renderPng(256)
    fs.writeFileSync(path.join(outDir, 'icon@2x.png'), png256)

    // 64×64 window icon fallback
    const png64 = await renderPng(64)
    fs.writeFileSync(path.join(outDir, 'icon64.png'), png64)

    // Multi-resolution .ico for Windows (16/32/48/64/128/256)
    const icoPngs = await Promise.all(ICO_SIZES.map(s => renderPng(s)))
    const ico = buildIco(icoPngs)
    fs.writeFileSync(path.join(outDir, 'icon.ico'), ico)

    console.log('Icons generated: icon.png, icon@2x.png, icon64.png, icon.ico (16/32/48/64/128/256)')
  }
  generate()
} catch {
  // Fallback: copy SVG
  fs.mkdirSync(outDir, { recursive: true })
  fs.copyFileSync(svgPath, path.join(outDir, 'icon.svg'))
  console.log('sharp not available — copied SVG to build/')
}
