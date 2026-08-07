import * as echarts from 'echarts'
import type { EChartsCoreOption } from 'echarts'

type RenderChartPngOptions = {
  width: number
  height: number
  pixelRatio?: number
  backgroundColor?: string
}

/**
 * Renders an ECharts option off-screen and returns a PNG data URL.
 */
export async function renderChartPng(
  option: EChartsCoreOption,
  { width, height, pixelRatio = 2, backgroundColor = '#ffffff' }: RenderChartPngOptions,
): Promise<string> {
  const container = document.createElement('div')
  container.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    `width:${width}px`,
    `height:${height}px`,
    'pointer-events:none',
    'opacity:0',
  ].join(';')
  document.body.appendChild(container)

  const chart = echarts.init(container, undefined, {
    renderer: 'canvas',
    width,
    height,
  })

  try {
    chart.setOption({
      ...option,
      animation: false,
    })
    // Two frames so canvas layout finishes before snapshot.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })
    return chart.getDataURL({
      type: 'png',
      pixelRatio,
      backgroundColor,
    })
  } finally {
    chart.dispose()
    container.remove()
  }
}
