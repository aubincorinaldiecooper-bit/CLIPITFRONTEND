"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/**
 * Orbit gallery — rings of image tiles rotating around a shared vertical axis.
 *
 * The prop signature mirrors Atelier's Orbit Gallery so this can be swapped for
 * the registry component (`npx shadcn@latest add @atelier/orbit-gallery`) by
 * changing the import alone. See README for why the registry version is not
 * installed here.
 */
export interface OrbitGalleryItem {
  src: string
  alt?: string
}

export interface OrbitGalleryProps {
  items: OrbitGalleryItem[]
  /** Distance from the vertical axis to each ring, in world units. */
  radius?: number
  /** Number of stacked rings. */
  rings?: number
  /** Vertical distance between ring centres. */
  ringGap?: number
  /** Height of a tile in world units; width follows the image aspect ratio. */
  tileHeight?: number
  /** Corner rounding as a fraction of the tile's shortest edge. */
  cornerRadius?: number
  /** Base rotation speed. 0 stops the rings. */
  spinSpeed?: number
  /** Per-ring speed offset, so rings do not move as one solid block. */
  spinStagger?: number
  /** Whether the wheel/trackpad drives the rotation. */
  wheel?: boolean
  /** Wheel sensitivity; ignored when `wheel` is false. */
  wheelMultiplier?: number
  /** Seconds for the entrance animation to finish. */
  revealDuration?: number
  /** Seconds for a tile to settle when selected. */
  focusDuration?: number
  /** Fired once every texture has decoded and the first frame is on screen. */
  onReady?: () => void
  className?: string
}

interface Tile {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  /** Entrance delay, in seconds. */
  delay: number
  focus: number
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Corners are rounded in the fragment shader with a box SDF rather than in
 * geometry: it stays exact at any tile size and needs no extra triangles.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uRadius;
  uniform float uAspect;
  uniform float uOpacity;
  uniform float uDim;
  varying vec2 vUv;

  float roundedBoxSDF(vec2 point, vec2 halfSize, float radius) {
    vec2 q = abs(point) - halfSize + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  void main() {
    // Work in a space where one unit is the tile's height, so the corner
    // radius is not stretched by the aspect ratio.
    vec2 centered = (vUv - 0.5) * vec2(uAspect, 1.0);
    float distance = roundedBoxSDF(centered, vec2(uAspect, 1.0) * 0.5, uRadius);

    // One pixel of feathering keeps the edge clean without MSAA.
    float edge = fwidth(distance) * 1.5;
    float alpha = 1.0 - smoothstep(-edge, edge, distance);
    if (alpha < 0.01) discard;

    vec4 texel = texture2D(uMap, vUv);
    gl_FragColor = vec4(texel.rgb * uDim, texel.a * alpha * uOpacity);
  }
`

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function OrbitGallery({
  items,
  radius = 2.8,
  rings = 3,
  ringGap = 1.6,
  tileHeight = 0.7,
  cornerRadius = 0.08,
  spinSpeed = 1,
  spinStagger = 0.2,
  wheel = true,
  wheelMultiplier = 3,
  revealDuration = 2,
  focusDuration = 1,
  onReady,
  className,
}: OrbitGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Held in a ref so changing the callback identity never restarts the scene.
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    // Far enough back that the tiles nearest the camera stay inside the frame:
    // at the front of the ring they sit `radius` closer than the axis.
    camera.position.set(0, 0, radius * 3.4 + 1.5)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      // No WebGL: leave the container empty and let the page render without it.
      onReadyRef.current?.()
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const ringGroups: THREE.Group[] = []
    const tiles: Tile[] = []
    const disposables: Array<{ dispose: () => void }> = []

    for (let index = 0; index < rings; index += 1) {
      const group = new THREE.Group()
      // Centre the stack on the origin regardless of ring count.
      group.position.y = (index - (rings - 1) / 2) * ringGap
      scene.add(group)
      ringGroups.push(group)
    }

    // Round-robin so each ring holds a mix of the source images rather than
    // one contiguous slice of them.
    const perRing: OrbitGalleryItem[][] = Array.from({ length: rings }, () => [])
    items.forEach((item, index) => {
      perRing[index % rings]!.push(item)
    })

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin("anonymous")

    let pending = items.length
    let ready = false

    const markReady = () => {
      if (ready) return
      ready = true
      onReadyRef.current?.()
    }

    if (pending === 0) markReady()

    const buildTile = (item: OrbitGalleryItem, group: THREE.Group, angle: number, delay: number) => {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: null },
          uRadius: { value: cornerRadius },
          uAspect: { value: 1 },
          uOpacity: { value: 0 },
          uDim: { value: 1 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        side: THREE.DoubleSide,
      })

      const geometry = new THREE.PlaneGeometry(1, 1)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false

      mesh.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius)
      // Face outward from the axis, so a tile at the front squarely faces the camera.
      mesh.rotation.y = angle

      group.add(mesh)
      disposables.push(geometry, material)

      const tile: Tile = { mesh, material, delay, focus: 0 }
      tiles.push(tile)

      loader.load(
        item.src,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
          texture.generateMipmaps = true
          texture.minFilter = THREE.LinearMipmapLinearFilter

          const aspect = texture.image.width / texture.image.height || 1
          material.uniforms.uMap!.value = texture
          material.uniforms.uAspect!.value = aspect
          mesh.scale.set(tileHeight * aspect, tileHeight, 1)
          mesh.visible = true
          disposables.push(texture)

          pending -= 1
          if (pending <= 0) markReady()
        },
        undefined,
        () => {
          // A missing image should not hold back the reveal.
          pending -= 1
          if (pending <= 0) markReady()
        },
      )
    }

    perRing.forEach((ringItems, ringIndex) => {
      const group = ringGroups[ringIndex]!
      ringItems.forEach((item, tileIndex) => {
        const angle = (tileIndex / ringItems.length) * Math.PI * 2
        // Stagger the entrance around the ring and down the stack.
        const delay = ringIndex * 0.12 + (tileIndex / Math.max(ringItems.length, 1)) * 0.5
        buildTile(item, group, angle, delay)
      })
    })

    const resize = () => {
      const { clientWidth, clientHeight } = container
      if (clientWidth === 0 || clientHeight === 0) return
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      const base = radius * 3.4 + 1.5
      // Pull back further on narrow viewports, where the horizontal field of
      // view is what crops the ring.
      camera.position.z = camera.aspect < 1 ? base + (1 - camera.aspect) * base * 0.7 : base
      camera.updateProjectionMatrix()
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    // Wheel-driven rotation. When `wheel` is false no listener is attached at
    // all, so the rings spin on their own and the viewer cannot drive them.
    let wheelVelocity = 0
    const handleWheel = (event: WheelEvent) => {
      wheelVelocity += (event.deltaY / 1000) * wheelMultiplier
    }
    if (wheel) {
      container.addEventListener("wheel", handleWheel, { passive: true })
    }

    // Selecting a tile settles it: it lifts slightly and the rest dim back.
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let focused: Tile | null = null

    const handlePointerDown = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(
        tiles.filter((tile) => tile.mesh.visible).map((tile) => tile.mesh),
        false,
      )[0]

      const next = hit ? (tiles.find((tile) => tile.mesh === hit.object) ?? null) : null
      focused = next === focused ? null : next
    }
    container.addEventListener("pointerdown", handlePointerDown)

    const clock = new THREE.Clock()
    let elapsed = 0
    let frame = 0

    const render = () => {
      frame = requestAnimationFrame(render)
      const delta = Math.min(clock.getDelta(), 0.1)
      elapsed += delta

      const still = reducedMotion.matches
      // A settled selection slows the rings rather than freezing them.
      const damping = focused ? 0.25 : 1

      ringGroups.forEach((group, index) => {
        const direction = index % 2 === 0 ? 1 : -1
        const speed = spinSpeed * (1 + index * spinStagger) * direction * 0.18
        if (!still) group.rotation.y += speed * damping * delta
        group.rotation.y += wheelVelocity * delta * direction
      })

      wheelVelocity *= Math.pow(0.02, delta)

      tiles.forEach((tile) => {
        const progress = revealDuration <= 0 ? 1 : (elapsed - tile.delay) / revealDuration
        const revealed = easeOutCubic(Math.min(Math.max(progress, 0), 1))

        const isFocused = focused === tile
        const target = isFocused ? 1 : 0
        // focusDuration is the time to travel the whole 0..1 range.
        const step = focusDuration <= 0 ? 1 : delta / focusDuration
        tile.focus += Math.min(Math.max(target - tile.focus, -step), step)

        tile.material.uniforms.uOpacity!.value = revealed
        tile.material.uniforms.uDim!.value = focused && !isFocused ? 0.45 : 1

        const aspect = tile.material.uniforms.uAspect!.value as number
        // Grow from slightly small, and again a little when selected.
        const scale = (0.82 + 0.18 * revealed) * (1 + 0.22 * tile.focus)
        tile.mesh.scale.set(tileHeight * aspect * scale, tileHeight * scale, 1)
      })

      renderer.render(scene, camera)
    }

    render()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      if (wheel) container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("pointerdown", handlePointerDown)
      disposables.forEach((item) => item.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [
    items,
    radius,
    rings,
    ringGap,
    tileHeight,
    cornerRadius,
    spinSpeed,
    spinStagger,
    wheel,
    wheelMultiplier,
    revealDuration,
    focusDuration,
  ])

  return <div ref={containerRef} className={className} aria-hidden="true" />
}

export default OrbitGallery
