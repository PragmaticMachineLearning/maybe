import { describe, expect, it } from 'vitest'

import {
  createDistributionChartData,
  createDistributionChartModel,
  createDistributionChartModelFromData,
  type ChartConfidenceInterval,
  type ChartThemeColors,
  type DistributionChartData,
  type DistributionChartDataInput,
  type DistributionChartModel,
  type DistributionChartModelFromDataInput,
  type DistributionChartModelInput,
  type DistributionQueryState,
} from '../../../../src/components/charts/distributionChartOptions'

const themeColors: ChartThemeColors = {
  textPrimary: '#1f2d2d',
  textSecondary: '#6a7a78',
  bgSurface: '#ffffff',
  borderColor: '#cedad6',
  splitLine: 'rgba(206, 218, 214, 0.4)',
  splitLineLight: 'rgba(206, 218, 214, 0.3)',
  accent: '#4e8376',
  accentArea: 'rgba(78, 131, 118, 0.18)',
  highlight: '#b67c68',
}

const queryState: DistributionQueryState = {
  percentile: 95,
  confidenceLevel: 95,
  showPercentile: true,
  showCI: true,
}

const confidenceInterval: ChartConfidenceInterval = {
  lower: 8,
  upper: 12,
  confidenceLevel: 95,
}

describe('distributionChartOptions', () => {
  it('builds a normal chart model from typed input', () => {
    const input: DistributionChartModelInput = {
      samples: [8, 9, 10, 11, 12],
      distributionKind: 'normal',
      queryState,
      confidenceInterval,
      themeColors,
    }

    const model = createDistributionChartModel(input)

    expect(model.distributionParams?.type).toBe('normal')
    expect(model.distributionParams).toEqual(
      expect.objectContaining({
        mean: expect.any(Number),
        std: expect.any(Number),
      }),
    )
    expect(Number.isFinite(model.percentileValue)).toBe(true)
    expect(Number.isFinite(model.ciBounds.lower)).toBe(true)
    expect(Number.isFinite(model.ciBounds.upper)).toBe(true)
    expect(model.densitySeriesData.length).toBeGreaterThan(0)
    expect(model.distributionParams).toEqual(
      expect.objectContaining({
        type: 'normal',
      }),
    )
    expect(model.pdfData).toEqual(model.densitySeriesData)
    expect(model.option).toEqual(
      expect.objectContaining({
        series: expect.any(Array),
      }),
    )
    expect((model.option.series as Array<Record<string, unknown>>)).toHaveLength(1)
  })

  it('builds chart data and a chart model from that data', () => {
    const dataInput: DistributionChartDataInput = {
      samples: [3, 5, 8, 13, 21],
      distributionKind: 'sampled',
      confidenceInterval,
    }

    const chartData: DistributionChartData = createDistributionChartData(dataInput)
    const modelInput: DistributionChartModelFromDataInput = {
      chartData,
      queryState,
      themeColors,
    }

    const model: DistributionChartModel =
      createDistributionChartModelFromData(modelInput)

    expect(chartData.sortedSamples).toEqual([3, 5, 8, 13, 21])
    expect(chartData.densitySeriesData.length).toBeGreaterThan(0)
    expect(model.distributionParams).toEqual(chartData.distributionParams)
    expect(model.pdfData).toEqual(chartData.pdfData)
    expect(model.option).toEqual(
      expect.objectContaining({
        title: expect.objectContaining({
          text: 'Empirical Distribution',
        }),
        series: expect.any(Array),
      }),
    )
  })

  it('uses engine-derived chart parameters when provided', () => {
    const chartData = createDistributionChartData({
      samples: [18, 19, 20, 21, 22],
      distributionKind: 'normal',
      distributionParams: {
        type: 'normal',
        mean: 20,
        std: 1.103807174302308,
      },
      confidenceInterval: {
        lower: 18,
        upper: 22,
        confidenceLevel: 93,
      },
    })

    expect(chartData.distributionParams).toEqual(
      expect.objectContaining({
        type: 'normal',
        mean: 20,
        std: 1.103807174302308,
      }),
    )
  })
})
