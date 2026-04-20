import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import ReactEChartsCoreModule, {
  type ReactEChartsCoreComponent,
} from 'echarts-for-react/lib/core'

echarts.use([
  LineChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
  SVGRenderer,
])

export { echarts }

const ReactEChartsCore = (
  typeof ReactEChartsCoreModule === 'function'
    ? ReactEChartsCoreModule
    : ReactEChartsCoreModule.default
) as ReactEChartsCoreComponent

export default ReactEChartsCore
