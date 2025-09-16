import React, { useEffect, useRef, useState } from "react";

import ReactECharts from "echarts-for-react";

interface DistributionPlotProps {
  samples: number[];
  onClose: () => void;
  position: { top: number; left: number };
  inline?: boolean;
}

interface QueryState {
  percentile: number;
  confidenceLevel: number;
  showPercentile: boolean;
  showCI: boolean;
}

export const DistributionPlot: React.FC<DistributionPlotProps> = ({
  samples,
  onClose,
  position,
  inline = false,
}) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [queryState, setQueryState] = useState<QueryState>({
    percentile: 95,
    confidenceLevel: 95,
    showPercentile: false,
    showCI: false,
  });

  // Calculate mean and variance from samples
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const variance = samples.reduce((sum, sample) => sum + Math.pow(sample - mean, 2), 0) / samples.length;
  const stdDev = Math.sqrt(variance);

  // Generate points for the distribution curve using kernel density estimation
  const points = 100;
  const range = stdDev * 4; // Plot ±4 standard deviations
  const step = (range * 2) / points;
  const bandwidth = 1.06 * stdDev * Math.pow(samples.length, -0.2); // Silverman's rule of thumb

  const data = Array.from({ length: points }, (_, i) => {
    const x = mean - range + i * step;
    // Use kernel density estimation for all distributions
    const y = samples.reduce((sum, sample) => {
      const u = (x - sample) / bandwidth;
      return sum + Math.exp(-0.5 * u * u) / (bandwidth * Math.sqrt(2 * Math.PI));
    }, 0) / samples.length;
    return [x, y];
  });

  // Calculate percentile and confidence interval values from samples
  const sortedSamples = [...samples].sort((a, b) => a - b);
  const percentileIndex = Math.floor((queryState.percentile / 100) * sortedSamples.length);
  const percentileValue = sortedSamples[Math.min(percentileIndex, sortedSamples.length - 1)];
  
  const ciLowerIndex = Math.floor(((100 - queryState.confidenceLevel) / 200) * sortedSamples.length);
  const ciUpperIndex = Math.floor(((100 + queryState.confidenceLevel) / 200) * sortedSamples.length);
  const ciLower = sortedSamples[Math.min(ciLowerIndex, sortedSamples.length - 1)];
  const ciUpper = sortedSamples[Math.min(ciUpperIndex, sortedSamples.length - 1)];

  const option = {
    title: {
      text: "Distribution Plot",
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
        name: "Distribution PDF",
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
        ...(inline ? 
        {position: "static",
        backgroundColor: "transparent",
        padding: 0,
        borderRadius: 0,
        boxShadow: "none",
        zIndex: "auto",
        width: "100%",
        height: "100%"} : {
        position: "absolute",
        top: position.top,
        left: position.left,
        backgroundColor: "white",
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 1000,
        width: "400px",
        height: "300px",})
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

      {showSettings && (
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