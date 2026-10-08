import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, LineBasicMaterial, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { VIRTUAL_CHURCH_FOYER_FLOOR as floor } from './virtualChurchFoyerFloor.ts'

// The supplied foyer photographs show two temporary lines of international
// flags. This decoration belongs to the V3 room layer, not the church GLB.
// This remains an illustrative event layer, not an exact claim about the
// photographed flag order. Permute the second half of the near row so the
// denser photo-like string does not show an obvious repeated 24-flag loop.
const FLAGS = ['cn', 'fi', 'fr', 'de', 'it', 'nl', 'in', 'br', 'ch', 'sg', 'gb', 'us',
  'jp', 'pl', 'ua', 'at', 'ie', 'be', 'dk', 'se', 'no', 'ro', 'id', 'cz'] as const
const COLUMNS = 4, TILE_W = 128, TILE_H = 84
const ROWS = FLAGS.length / COLUMNS
export const VIRTUAL_CHURCH_FOYER_FLAG_COUNTS = [48, 48] as const
const NEAR_FLAG_LINE_Z = [1.8, 10.5] as const
const FAR_FLAG_LINE_Z = 11.8
const flagLine = (row: number, t: number) => ({
  x: floor.minX + 1 + (floor.maxX - floor.minX - 2) * t,
  // Photo 09: the near cord reads almost level in the entrance view, rather
  // than climbing sharply toward the right edge as equal-height endpoints do
  // under this oblique camera. Keep its lowest flag above an adult's head.
  y: (row === 0 ? 2.85 - .55 * t : 2.85) - .12 * (1 - Math.pow(t * 2 - 1, 2)),
  // The photos show two separated strings across the open hall, not a single
  // dense banner across the far glazed doors. Both stay above head height.
  // The near string crosses diagonally from the photographed main-hall wall
  // toward the deeper right side; a constant depth hides its left end behind
  // the low soffit, while moving both ends forward magnifies the right end.
  z: row === 0
    ? NEAR_FLAG_LINE_Z[0] + (NEAR_FLAG_LINE_Z[1] - NEAR_FLAG_LINE_Z[0]) * t
    : FAR_FLAG_LINE_Z,
})

export function createVirtualChurchFoyerFlagCordGeometry() {
  const positions: number[] = []
  for (let row = 0; row < 2; row++) for (let index = 0; index < VIRTUAL_CHURCH_FOYER_FLAG_COUNTS[row]; index++) {
    const count = VIRTUAL_CHURCH_FOYER_FLAG_COUNTS[row]
    const a = flagLine(row, index / count), b = flagLine(row, (index + 1) / count)
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

export function createVirtualChurchFoyerFlagCordMaterial() {
  return new LineBasicMaterial({ color: '#a6a8a1', transparent: true, opacity: .75 })
}

export function createVirtualChurchFoyerFlagGeometry() {
  const positions: number[] = [], uvs: number[] = []
  for (let row = 0; row < 2; row++) for (let index = 0; index < VIRTUAL_CHURCH_FOYER_FLAG_COUNTS[row]; index++) {
    const count = VIRTUAL_CHURCH_FOYER_FLAG_COUNTS[row]
    // The photographed near string is a run of small cloth flags, not a row
    // of rigid display panels. Leave visible cord between neighbouring flags.
    const flagWidth = row === 0 ? .26 : .16
    const flagHeight = row === 0 ? .34 - .02 * index / count : .21
    const flagIndex = row === 0
      ? index < FLAGS.length ? index : (index * 7 + 5) % FLAGS.length
      : (index * 7 + 11) % FLAGS.length
    const tileX = flagIndex % COLUMNS, tileY = Math.floor(flagIndex / COLUMNS)
    const { x: centre, y: top, z } = flagLine(row, (index + .5) / count)
    const vertex = (column: number, section: number): [number, number, number, number, number] => {
      const hang = section / 3
      const x = centre + (column / 2 - .5) * flagWidth
        + (row === 0 ? Math.sin((index + 1) * 2.4) * .012 * hang * hang : 0)
      const y = top - hang * flagHeight
        - (row === 0 ? Math.sin(column / 2 * Math.PI) * .012 * hang : 0)
      const wave = Math.sin(column / 2 * Math.PI) * Math.sin(hang * Math.PI) * .045
      const u = (tileX + (2 + (TILE_W - 4) * column / 2) / TILE_W) / COLUMNS
      const v = (tileY + (2 + (TILE_H - 4) * section / 3) / TILE_H) / ROWS
      return [x, y, z + wave, u, 1 - v]
    }
    for (let section = 0; section < 3; section++) for (let column = 0; column < 2; column++) {
      const a = vertex(column, section), b = vertex(column + 1, section)
      const c = vertex(column + 1, section + 1), d = vertex(column, section + 1)
      for (const point of [a, b, c, a, c, d]) {
        positions.push(point[0], point[1], point[2])
        uvs.push(point[3], point[4])
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

/** A single generated texture and draw call; no downloaded flag image set. */
export function createVirtualChurchFoyerFlagMaterial() {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_W * COLUMNS; canvas.height = TILE_H * ROWS
  const ctx = canvas.getContext('2d')!
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x * TILE_W, y * TILE_H, w * TILE_W, h * TILE_H)
  }
  const disk = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath(); ctx.arc(x * TILE_W, y * TILE_H, r * TILE_H, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
  }
  const star = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath()
    for (let n = 0; n < 10; n++) {
      const angle = -Math.PI / 2 + n * Math.PI / 5, radius = r * (n % 2 ? .42 : 1)
      const px = x * TILE_W + Math.cos(angle) * radius * TILE_H, py = y * TILE_H + Math.sin(angle) * radius * TILE_H
      if (n === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill()
  }
  const polygon = (points: number[], color: string) => {
    ctx.beginPath()
    for (let i = 0; i < points.length; i += 2) {
      if (i === 0) ctx.moveTo(points[i] * TILE_W, points[i + 1] * TILE_H)
      else ctx.lineTo(points[i] * TILE_W, points[i + 1] * TILE_H)
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill()
  }
  const line = (points: number[], color: string, width: number) => {
    ctx.beginPath()
    for (let i = 0; i < points.length; i += 2) {
      if (i === 0) ctx.moveTo(points[i] * TILE_W, points[i + 1] * TILE_H)
      else ctx.lineTo(points[i] * TILE_W, points[i + 1] * TILE_H)
    }
    ctx.strokeStyle = color; ctx.lineWidth = width * TILE_H; ctx.stroke()
  }
  FLAGS.forEach((flag, index) => {
    ctx.save(); ctx.translate(index % COLUMNS * TILE_W, Math.floor(index / COLUMNS) * TILE_H)
    rect(0, 0, 1, 1, '#fff')
    if (flag === 'cn') {
      rect(0, 0, 1, 1, '#de2910'); star(.21, .3, .16, '#ffde00')
      for (const [x, y] of [[.39,.13],[.47,.27],[.47,.43],[.38,.54]]) star(x, y, .045, '#ffde00')
    } else if (flag === 'fi') {
      rect(.29, 0, .16, 1, '#003580'); rect(0, .42, 1, .18, '#003580')
    } else if (flag === 'fr' || flag === 'it' || flag === 'nl') {
      const colors = flag === 'fr' ? ['#0055a4','#fff','#ef4135'] : flag === 'it' ? ['#009246','#fff','#ce2b37'] : ['#ae1c28','#fff','#21468b']
      colors.forEach((color, part) => flag === 'nl' ? rect(0, part / 3, 1, 1 / 3, color) : rect(part / 3, 0, 1 / 3, 1, color))
    } else if (flag === 'de') {
      ['#111','#dd0000','#ffce00'].forEach((color, part) => rect(0, part / 3, 1, 1 / 3, color))
    } else if (flag === 'in') {
      rect(0, 0, 1, 1 / 3, '#ff9933'); rect(0, 2 / 3, 1, 1 / 3, '#138808')
      ctx.beginPath(); ctx.arc(TILE_W / 2, TILE_H / 2, TILE_H * .125, 0, Math.PI * 2); ctx.strokeStyle = '#000080'; ctx.lineWidth = 2; ctx.stroke()
      for (let n = 0; n < 24; n++) { const a = n * Math.PI / 12; line([.5,.5,.5 + Math.cos(a) * .075,.5 + Math.sin(a) * .12], '#000080', .008) }
    } else if (flag === 'br') {
      rect(0, 0, 1, 1, '#009b3a'); polygon([.5,.1,.91,.5,.5,.9,.09,.5], '#ffdf00'); disk(.5,.5,.24,'#002776')
      line([.28,.53,.39,.47,.53,.45,.7,.51], '#fff', .035)
    } else if (flag === 'ch') {
      rect(0, 0, 1, 1, '#da291c'); rect(.43,.24,.14,.52,'#fff'); rect(.32,.42,.36,.16,'#fff')
    } else if (flag === 'sg') {
      rect(0, 0, 1, .5, '#ef3340'); disk(.24,.25,.18,'#fff'); disk(.29,.21,.18,'#ef3340')
      for (const [x,y] of [[.48,.13],[.55,.22],[.51,.35],[.39,.35],[.36,.22]]) star(x,y,.035,'#fff')
    } else if (flag === 'gb') {
      rect(0, 0, 1, 1, '#012169')
      for (const diagonal of [[0,0,1,1],[1,0,0,1]]) { line(diagonal,'#fff',.19); line(diagonal,'#c8102e',.08) }
      rect(.41,0,.18,1,'#fff'); rect(0,.39,1,.22,'#fff'); rect(.45,0,.1,1,'#c8102e'); rect(0,.44,1,.12,'#c8102e')
    } else if (flag === 'us') {
      for (let stripe = 0; stripe < 13; stripe++) if (stripe % 2 === 0) rect(0,stripe / 13,1,1 / 13,'#b22234')
      rect(0,0,.42,7 / 13,'#3c3b6e')
      for (let row = 0; row < 5; row++) for (let column = 0; column < 6; column++) star(.04 + column * .068,.055 + row * .108,.018,'#fff')
    } else if (flag === 'jp') {
      disk(.5,.5,.27,'#bc002d')
    } else if (flag === 'pl') {
      rect(0,.5,1,.5,'#dc143c')
    } else if (flag === 'ua') {
      rect(0,0,1,.5,'#0057b7'); rect(0,.5,1,.5,'#ffd700')
    } else if (flag === 'at') {
      rect(0,0,1,1,'#ed2939'); rect(0,1 / 3,1,1 / 3,'#fff')
    } else if (flag === 'ie') {
      rect(0,0,1 / 3,1,'#169b62'); rect(2 / 3,0,1 / 3,1,'#ff883e')
    } else if (flag === 'be') {
      rect(0,0,1 / 3,1,'#111'); rect(1 / 3,0,1 / 3,1,'#fae042'); rect(2 / 3,0,1 / 3,1,'#ed2939')
    } else if (flag === 'dk') {
      rect(0,0,1,1,'#c60c30'); rect(.32,0,.12,1,'#fff'); rect(0,.43,1,.15,'#fff')
    } else if (flag === 'se') {
      rect(0,0,1,1,'#006aa7'); rect(.34,0,.12,1,'#fecc00'); rect(0,.42,1,.16,'#fecc00')
    } else if (flag === 'no') {
      rect(0,0,1,1,'#ba0c2f'); rect(.30,0,.16,1,'#fff'); rect(0,.40,1,.20,'#fff')
      rect(.34,0,.08,1,'#00205b'); rect(0,.44,1,.12,'#00205b')
    } else if (flag === 'ro') {
      rect(0,0,1 / 3,1,'#002b7f'); rect(1 / 3,0,1 / 3,1,'#fcd116'); rect(2 / 3,0,1 / 3,1,'#ce1126')
    } else if (flag === 'id') {
      rect(0,0,1,.5,'#ce1126')
    } else if (flag === 'cz') {
      rect(0,.5,1,.5,'#d7141a'); polygon([0,0,0,1,.46,.5],'#11457e')
    }
    ctx.restore()
  })
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return new MeshStandardMaterial({ map: texture, color: '#f0ede5', side: DoubleSide, roughness: 1, metalness: 0 })
}
