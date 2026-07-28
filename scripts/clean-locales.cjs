/**
 * electron-builder afterPack hook — strips unused Chromium locale files.
 * Only keeps zh-CN and en-US, saves ~40MB from the packaged app.
 */
exports.default = async function (context) {
  const fs = require('fs')
  const path = require('path')
  const localesDir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(localesDir)) return
  const keep = new Set(['zh-CN.pak', 'en-US.pak'])
  for (const file of fs.readdirSync(localesDir)) {
    if (!keep.has(file)) {
      fs.unlinkSync(path.join(localesDir, file))
    }
  }
}
