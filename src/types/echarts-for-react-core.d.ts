declare module 'echarts-for-react/lib/core' {
  import type { ComponentType } from 'react'
  import type * as echarts from 'echarts/core'

  export interface ReactEChartsCoreProps {
    echarts: typeof echarts
    option: Record<string, unknown>
    notMerge?: boolean
    lazyUpdate?: boolean
    style?: React.CSSProperties
    className?: string
    theme?: string | Record<string, unknown>
    onChartReady?: (instance: echarts.ECharts) => void
    onEvents?: Record<string, (params: unknown, instance: echarts.ECharts) => void>
    opts?: {
      renderer?: 'canvas' | 'svg'
      devicePixelRatio?: number
      width?: number | string
      height?: number | string
    }
    showLoading?: boolean
    loadingOption?: Record<string, unknown>
    autoResize?: boolean
  }

  export type ReactEChartsCoreComponent = ComponentType<ReactEChartsCoreProps & { key?: string | number }>

  const ReactEChartsCore:
    | ReactEChartsCoreComponent
    | { default: ReactEChartsCoreComponent }
  export default ReactEChartsCore
}
