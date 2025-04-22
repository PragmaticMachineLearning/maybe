import React, { useEffect, useRef, useState } from "react";

import ReactECharts from "echarts-for-react";
import { normal } from "../../hyperformula/src/interpreter/plugin/3rdparty/jstat/jstat";

interface DistributionPlotProps {
  mean: number;
  variance: number;
  samples?: number[];
  onClose: () => void;
  position: { top: number; left: number };
  isGaussian: boolean;
}

interface QueryState {
  percentile: number;
  confidenceLevel: number;
  showPercentile: boolean;
  showCI: boolean;
}

export const DistributionPlot: React.FC<DistributionPlotProps> = ({
  mean,
  variance,
  samples,
  onClose,
  position,
  isGaussian,
}) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [queryState, setQueryState] = useState<QueryState>({
    percentile: 95,
    confidenceLevel: 95,
    showPercentile: false,
    showCI: false,
  });

  // Generate points for the distribution curve
  const stdDev = Math.sqrt(variance);
  const points = 100;
  const range = stdDev * 4; // Plot ±4 standard deviations
  const step = (range * 2) / points;

  const data = Array.from({ length: points }, (_, i) => {
    const x = mean - range + i * step;
    let y;
    if (samples) {
      // For sampled distribution, use kernel density estimation
      const bandwidth = 1.06 * stdDev * Math.pow(samples.length, -0.2); // Silverman's rule of thumb
      y = samples.reduce((sum, sample) => {
        const u = (x - sample) / bandwidth;
        return sum + Math.exp(-0.5 * u * u) / (bandwidth * Math.sqrt(2 * Math.PI));
      }, 0) / samples.length;
    } else {
      // For Gaussian distribution, use normal PDF
      y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
    }
    return [x, y];
  });

  // Calculate percentile and confidence interval values
  const percentileValue = isGaussian ? normal.inv(queryState.percentile / 100, mean, stdDev) : null;
  const zScore = isGaussian ? normal.inv((1 + queryState.confidenceLevel / 100) / 2, 0, 1) : null;
  const ciLower = isGaussian ? mean - zScore! * stdDev : null;
  const ciUpper = isGaussian ? mean + zScore! * stdDev : null;

  const option = {
    title: {
      text: isGaussian 
        ? `Gaussian Plot (μ=${mean.toFixed(2)}, σ²=${variance.toFixed(2)})` 
        : `Sampled Distribution Plot (μ=${mean.toFixed(2)}, σ²=${variance.toFixed(2)})`,
      left: "center",
      textStyle: {
        fontSize: 14,
        fontWeight: 'normal',
        color: '#333'
      }
    },
    tooltip: {
      trigger: "axis",
      formatter: function (params: any) {
        const x = params[0].data[0];
        const y = params[0].data[1];
        return `Value: ${x.toFixed(2)}<br/>
                Density: ${y.toFixed(4)}`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      }
    },
    xAxis: {
      type: "value",
      name: "Value",
      nameLocation: "middle",
      nameGap: 30,
      axisLine: {
        lineStyle: {
          color: '#666'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    yAxis: {
      type: "value",
      name: "Probability Density",
      nameLocation: "middle",
      nameGap: 40,
      axisLine: {
        lineStyle: {
          color: '#666'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    series: [
      {
        name: isGaussian ? "Gaussian PDF" : "Sampled PDF",
        type: "line",
        smooth: true,
        data: data,
        areaStyle: {
          opacity: 0.2,
          color: '#1890ff'
        },
        lineStyle: {
          width: 2,
          color: '#1890ff'
        },
        markLine: queryState.showPercentile ? {
          silent: true,
          data: [
            {
              xAxis: percentileValue,
              lineStyle: {
                color: '#ff4d4f',
                type: 'dashed',
                width: 2
              },
              label: {
                formatter: `${queryState.percentile}th percentile`,
                position: 'end',
                color: '#ff4d4f'
              }
            }
          ]
        } : undefined,
        markArea: queryState.showCI ? {
          silent: true,
          data: [
            [
              {
                xAxis: ciLower,
                itemStyle: {
                  color: 'rgba(24, 144, 255, 0.1)'
                }
              },
              {
                xAxis: ciUpper,
                itemStyle: {
                  color: 'rgba(24, 144, 255, 0.1)'
                }
              }
            ]
          ],
          label: {
            formatter: `${queryState.confidenceLevel}% CI`,
            position: 'inside',
            color: '#1890ff'
          }
        } : undefined
      },
    ],
    grid: {
      left: "10%",
      right: "10%",
      bottom: "10%",
      containLabel: true,
    },
  };

  // Handle clicks outside the plot to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plotRef.current && !plotRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleQueryChange = (field: keyof QueryState, value: number | boolean) => {
    setQueryState(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div
      ref={plotRef}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        backgroundColor: "white",
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 1000,
        width: "400px",
        height: "300px",
      }}
    >
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '8px',
        zIndex: 1
      }}>
        {isGaussian && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#666',
              fontSize: '16px'
            }}
          >
            ⚙️
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#666',
            fontSize: '16px'
          }}
        >
          ×
        </button>
      </div>

      {showSettings && isGaussian && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: '10px',
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 2,
          width: '200px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', color: '#333' }}>
              Percentile:
              <input
                type="number"
                min="0"
                max="100"
                value={queryState.percentile}
                onChange={(e) => handleQueryChange('percentile', Number(e.target.value))}
                style={{
                  width: '60px',
                  marginLeft: '8px',
                  padding: '4px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </label>
            <button
              onClick={() => handleQueryChange('showPercentile', !queryState.showPercentile)}
              style={{
                background: queryState.showPercentile ? '#ff4d4f' : '#f0f0f0',
                color: queryState.showPercentile ? 'white' : '#333',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              {queryState.showPercentile ? 'Hide' : 'Show'} Percentile
            </button>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#333' }}>
              Confidence Level:
              <input
                type="number"
                min="0"
                max="100"
                value={queryState.confidenceLevel}
                onChange={(e) => handleQueryChange('confidenceLevel', Number(e.target.value))}
                style={{
                  width: '60px',
                  marginLeft: '8px',
                  padding: '4px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </label>
            <button
              onClick={() => handleQueryChange('showCI', !queryState.showCI)}
              style={{
                background: queryState.showCI ? '#1890ff' : '#f0f0f0',
                color: queryState.showCI ? 'white' : '#333',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              {queryState.showCI ? 'Hide' : 'Show'} CI
            </button>
          </div>
        </div>
      )}

      <ReactECharts
        option={option}
        style={{ height: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
};