<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const cursorRef = ref<HTMLDivElement | null>(null)

const size = 422
const center = size / 2
const radius = 181
const thickness = 55

// Hue — просто число от 0 до 360
const hue = defineModel()
const color = ref(`hsl(0, 100%, 50%)`)

const dragging = ref(false)

function hslToRgb(h: number, s: number, l: number) {
  h /= 360
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

function drawRing(ctx: CanvasRenderingContext2D) {
  const image = ctx.createImageData(size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center
      const dy = y - center
      const dist = Math.hypot(dx, dy) // чуть короче, то же что sqrt(dx²+dy²)

      if (dist < radius && dist > radius - thickness) {
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI
        if (angle < 0) angle += 360

        const i = (y * size + x) * 4
        const c = hslToRgb(angle, 1, 0.5)

        image.data[i] = c.r
        image.data[i + 1] = c.g
        image.data[i + 2] = c.b
        image.data[i + 3] = 255
      }
    }
  }

  ctx.putImageData(image, 0, 0)
}

function getPosFromEvent(e: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('touches' in e && e.touches.length > 0) {
    const t = e.touches[0]
    return { x: t.clientX, y: t.clientY }
  } else if ('changedTouches' in e && e.changedTouches.length > 0) {
    const t = e.changedTouches[0]
    return { x: t.clientX, y: t.clientY }
  } else if ('clientX' in e) {
    return { x: e.clientX, y: e.clientY }
  }
  return { x: 0, y: 0 }
}

function getHueFromCoords({ x, y }: { x: number; y: number }) {
  if (!canvasRef.value) return 0
  const rect = canvasRef.value.getBoundingClientRect()
  const dx = x - rect.left - center
  const dy = y - rect.top - center
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angle < 0) angle += 360
  return Math.round(angle)
}

async function updateColorFromCoords(pos: { x: number; y: number }) {
  hue.value = getHueFromCoords(pos)
  color.value = `hsl(${hue.value}, 100%, 50%)`
  await nextTick()  // ждем обновления реактивных данных
  updateCursor()
}

function updateCursor() {
  const angleRad = (hue.value * Math.PI) / 180
  const r = radius - thickness / 2
  const x = center + r * Math.cos(angleRad)
  const y = center + r * Math.sin(angleRad)

  if (cursorRef.value) {
    cursorRef.value.style.left = `${x}px`
    cursorRef.value.style.top = `${y}px`
    cursorRef.value.style.backgroundColor = color.value
  }
}

// Обработчики объединены и упрощены
function onPointerDown(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  dragging.value = true
  updateColorFromCoords(getPosFromEvent(e))
}

function onPointerMove(e: MouseEvent | TouchEvent) {
  if (!dragging.value) return
  updateColorFromCoords(getPosFromEvent(e))
}

function onPointerUp() {
  dragging.value = false
}

onMounted(() => {
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) drawRing(ctx)
  updateCursor()

  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)

  window.addEventListener('touchmove', onPointerMove, { passive: false })
  window.addEventListener('touchend', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)

  window.removeEventListener('touchmove', onPointerMove)
  window.removeEventListener('touchend', onPointerUp)
})
</script>

<template>
  <div style="position: relative; width: 422px; height: 422px;">
    <canvas
        ref="canvasRef"
        :width="size"
        :height="size"
        @mousedown="onPointerDown"
        @touchstart="onPointerDown"
        style="display: block; cursor: pointer; touch-action: none;"
    />
    <div ref="cursorRef" class="cursor" />
  </div>
</template>

<style scoped>
.cursor {
  position: absolute;
  width: 52px;
  height: 52px;
  border: 26px solid white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
</style>
