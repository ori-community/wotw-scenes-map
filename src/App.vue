<template>
  <div ref="container" class="container">
    <div v-if="highlightedScene" class="overlay">
      <div>{{ highlightedScene.name }}</div>
      <div>{{ stageMousePosition.x }}</div>
      <div>{{ stageMousePosition.y }}</div>
    </div>
    <div class="legend">
      <div>
        <div class="rect" style="background-color: rgb(0, 255, 0)"></div>
        Boundary
      </div>
      <div>
        <div class="rect" style="background-color: rgb(255, 0, 0)"></div>
        Loading Zone
      </div>
      <div>
        <div class="rect" style="background-color: rgb(0, 0, 255)"></div>
        Padding
      </div>
      <div>
        Patch
        <select v-model="currentSceneSet">
          <option>3.1</option>
          <option>2</option>
        </select>
        Ctrl to toggle
      </div>
      <div>
        <label>
          <input type="checkbox" v-model="mapEnabled">
          Map
        </label>
      </div>
    </div>
    <k-stage ref="stage" :config="stageConfig" @wheel="onStageWheel" @mousemove="onStageMouseMove">
      <k-layer>
        <k-image v-if="mapEnabled" v-for="(tile, index) in mapTiles" :key="index" :config="tile" />
      </k-layer>
      <k-layer>
        <k-group>
          <template v-for="scene in scenesSortedBySize">
            <k-rect
              v-for="boundary in scene.boundaries"
              :config="{
                x: boundary.x,
                y: boundary.y,
                width: boundary.w,
                height: boundary.h,
                fill: `rgba(0, 200, 0, ${highlightedSceneName === scene.name ? 0.5 : 0.1})`,
                stroke: `rgba(0, 255, 0, ${highlightedSceneName === scene.name ? 1.0 : 0.0})`,
              }"
              @mouseenter="highlightedSceneName = scene.name"
            />

            <template v-if="highlightedSceneName === scene.name">
              <k-rect
                v-for="boundary in scene.loading_boundaries"
                :config="{
                  x: boundary.x,
                  y: boundary.y,
                  width: boundary.w,
                  height: boundary.h,
                  fill: 'rgb(255, 0, 0, 0.5)',
                  stroke: 'rgb(255, 0, 0)',
                  listening: false,
                }"
              />
              <k-rect
                v-for="boundary in scene.padding"
                :config="{
                  x: boundary.x,
                  y: boundary.y,
                  width: boundary.w,
                  height: boundary.h,
                  fill: 'rgb(0, 0, 255, 0.5)',
                  stroke: 'rgb(0, 0, 255)',
                  listening: false,
                }"
              />
            </template>
          </template>
        </k-group>
      </k-layer>
    </k-stage>
  </div>
</template>

<script lang="ts" setup>
  import scenes3_1 from './scenes3.1.json'
  import scenes2 from './scenes2.json'
  import {computed, onMounted, ref} from 'vue'
  import {Stage} from 'konva/lib/Stage'
  import {ImageConfig} from 'konva/lib/shapes/Image'

  const container = ref<HTMLElement | null>(null)
  const stage = ref<Stage | null>(null)

  const mapEnabled = ref(true)
  const mapTiles = ref<ImageConfig[]>([])
  const highlightedSceneName = ref<string | null>(null)
  const stageMousePosition = ref({
    x: 0,
    y: 0,
  })
  const stageConfig = ref({
    width: 1,
    height: 1,
    x: 0,
    y: 0,
    scale: {
      x: 1,
      y: -1,
    },
    draggable: true,
  })

  const backgroundTilesConfig = Object.freeze({
    tilesX: 36,
    tilesY: 9,
    tileSize: 512,
    // Calculated with S C I E N C E
    tileScale: 3023.460435 / 12359.664154,
    mapOffsetX: -2015.2614140037902,
    mapOffsetY: -3513.5714250429464,
  })

  type Rect = {
    x: number,
    y: number,
    w: number,
    h: number,
  }
  type SceneInfo = {
    name: string,
    boundaries: Rect[],
    loading_boundaries: Rect[],
    padding: Rect[],
  }
  type SceneSet = '3.1' | '2'
  const currentSceneSet = ref<SceneSet>('3.1')

  const scenes = computed<SceneInfo[]>(() => {
    switch (currentSceneSet.value) {
      case '3.1':
        return scenes3_1
      case '2':
        return scenes2
    }
  })

  const highlightedScene = computed(() => {
    if (!highlightedSceneName.value) {
      return null
    }

    return scenes.value.find(s => s.name === highlightedSceneName.value)
  })

  const scenesSortedBySize = computed(() => {
    return [...scenes.value].sort((a, b) => {
      const totalAreaA = a.boundaries.reduce((acc, b) => acc + b.w * b.h, 0.0)
      const totalAreaB = b.boundaries.reduce((acc, b) => acc + b.w * b.h, 0.0)
      return totalAreaB - totalAreaA
    })
  })

  async function loadImage(x: number, y: number) {
    try {
      const image = await getImage(x, y)
      mapTiles.value.push({
        image,
        x: 512 * backgroundTilesConfig.tileScale * x + backgroundTilesConfig.mapOffsetX,
        y: -512 * backgroundTilesConfig.tileScale * y + backgroundTilesConfig.mapOffsetY,
        opacity: 0.6,
        scale: {
          x: backgroundTilesConfig.tileScale,
          y: -backgroundTilesConfig.tileScale,
        },
      })
    } catch (e) {
      console.error(e)
    }
  }

  async function getImage(x: number, y: number): Promise<HTMLImageElement> {
    const image = new Image()
    image.src = new URL(`./assets/map/tile-${x}_${y}.png`, import.meta.url).toString()
    return await new Promise(resolve => {
      image.onload = () => {
        resolve(image)
      }
    })
  }

  function updateStageSize() {
    if (!container.value) {
      return
    }

    const s = stage.value?.getStage()

    if (!s) {
      return
    }

    stageConfig.value.width = container.value.clientWidth
    stageConfig.value.height = container.value.clientHeight
  }

  function zoomToFit() {
    let minX: number | null = null
    let minY: number | null = null
    let maxX: number | null = null
    let maxY: number | null = null

    const submitRect = (name: string, {x, y, w, h}: { x: number, y: number, w: number, h: number }) => {
      if (minX === null || x < minX) {
        minX = x
      }

      if (minY === null || y < minY) {
        minY = y
      }

      if (maxX === null || x + w > maxX) {
        maxX = x + w
        console.log(name)
      }

      if (maxY === null || y + h > maxY) {
        maxY = y + h
      }
    }

    for (const scene of scenes.value) {
      scene.boundaries.forEach(submitRect.bind(null, scene.name))
      scene.loading_boundaries.forEach(submitRect.bind(null, scene.name))
      scene.padding.forEach(submitRect.bind(null, scene.name))
    }

    if (minX !== null && minY !== null && maxX !== null && maxY !== null) {
      const s = stage.value?.getStage()

      if (!s) {
        return
      }

      const rectWidth = maxX - minX
      const rectHeight = maxY - minY
      const stageWidth = stageConfig.value.width
      const stageHeight = stageConfig.value.height
      const scale = Math.min(stageConfig.value.width / rectWidth, stageConfig.value.height / rectHeight)

      const xOffset = stageWidth > stageHeight ? (stageWidth - stageHeight) / 2 : 0
      const yOffset = stageHeight > stageWidth ? (stageHeight - stageWidth) / 2 : 0

      s.to({
        duration: 0,
        x: -minX * scale + xOffset,
        y: maxY * scale + yOffset,
        scaleX: scale,
        scaleY: -scale,
      })

      console.log({minX, minY, maxX, maxY, rectWidth, rectHeight, xOffset, yOffset})
    }
  }

  function onStageMouseMove() {
    const s = stage.value?.getStage()

    if (!s) {
      return
    }

    const position = s.getRelativePointerPosition()

    if (position) {
      stageMousePosition.value.x = position.x
      stageMousePosition.value.y = position.y
    }
  }

  function onStageWheel(e: any) {
    const s = stage.value?.getStage()

    if (!s) {
      return
    }

    const scaleBy = 0.96
    const oldScale = s.scaleX()
    const pointer = s.getPointerPosition()

    if (!pointer) {
      return
    }

    const mousePointTo = {
      x: (pointer.x - s.x()) / oldScale,
      y: (pointer.y - s.y()) / oldScale,
    }

    // how to scale? Zoom in? Or zoom out?
    let direction = e.evt.deltaY > 0 ? 1 : -1

    // when we zoom on trackpad, e.evt.ctrlKey is true
    // in that case lets revert direction
    if (e.evt.ctrlKey) {
      direction = -direction
    }

    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy

    s.scale({x: newScale, y: -newScale})

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }

    s.position(newPos)
  }

  onMounted(() => {
    if (container.value) {
      const observer = new ResizeObserver(() => updateStageSize())
      observer.observe(container.value)
    }

    updateStageSize()
    zoomToFit()

    for (let x = 0; x < backgroundTilesConfig.tilesX; x++) {
      for (let y = 0; y < backgroundTilesConfig.tilesY; y++) {
        loadImage(x, y)
      }
    }
  })

  window.addEventListener('keydown', ev => {
    if (ev.key === 'Control') {
      currentSceneSet.value = currentSceneSet.value === '3.1'
        ? '2'
        : '3.1'
    }
  })
</script>

<style scoped>
    .container {
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    .overlay {
        position: fixed;
        pointer-events: none;
        z-index: 100;
        background-color: rgba(0, 0, 0, 0.4);
        padding: 16px;
    }

    .legend {
        bottom: 0;
        position: fixed;
        z-index: 100;
        background-color: rgba(0, 0, 0, 0.4);
        padding: 16px;
    }

    .rect {
        display: inline-block;
        width: 1em;
        height: 1em;
    }
</style>
