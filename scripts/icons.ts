/**
 * Renders the app icons from the logo (AppLogo.vue) in the default teal accent.
 * Run: bun scripts/icons.ts  →  apps/web/public/icons/*
 */
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const TEAL = '#0F766E'
const out = new URL('../apps/web/public/icons/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

/** The logo on a rounded square ("any") or full bleed with an 80% safe zone ("maskable"). */
function svg(maskable: boolean) {
  const mark = `<circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="18.5" cy="9.5" r="2.5" fill="#fff"/>`
  return maskable
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" fill="${TEAL}"/><g transform="translate(14 14) scale(0.7) translate(-14 -14)">${mark}</g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="8" fill="${TEAL}"/>${mark}</svg>`
}

function png(maskable: boolean, size: number, name: string) {
  const r = new Resvg(svg(maskable), { fitTo: { mode: 'width', value: size } })
  writeFileSync(out + name, r.render().asPng())
}

png(false, 192, 'icon-192.png')
png(false, 512, 'icon-512.png')
png(true, 512, 'maskable-512.png')
png(true, 180, 'apple-touch-icon.png')
png(false, 32, 'favicon-32.png')
writeFileSync(out + 'icon.svg', svg(false))
console.log('icons written to', out)

// Browser extension toolbar and store icons (WXT picks up public/icon/<size>.png).
const ext = new URL('../apps/extension/public/icon/', import.meta.url).pathname
mkdirSync(ext, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const r = new Resvg(svg(false), { fitTo: { mode: 'width', value: size } })
  writeFileSync(`${ext}${size}.png`, r.render().asPng())
}
