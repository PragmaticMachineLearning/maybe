import React, { useEffect, useRef, useState } from "react";

import ReactECharts from "echarts-for-react";
import { normal } from "../../hyperformula/src/interpreter/plugin/3rdparty/jstat/jstat";

interface GaussianPlotProps {
  mean: number;
  variance: number;
  onClose: () => void;
}

export const GaussianPlot: React.FC<GaussianPlotProps> = ({
  mean,
  variance,
  onClose,
}) => {
  const [percentile, setPercentile] = useState<number>(95);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(95);
  const [queryValue, setQueryValue] = useState<number>(mean);
  const [isStatsExpanded, setIsStatsExpanded] = useState<boolean>(true);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isStatsExpanded]);

  // Generate points for the Gaussian curve
  const stdDev = Math.sqrt(variance);
  const points = 100;
  const range = stdDev * 4; // Plot ±4 standard deviations
  const step = (range * 2) / points;

  const data = Array.from({ length: points }, (_, i) => {
    const x = mean - range + i * step;
    const y =
      (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
    return [x, y];
  });

  // Calculate statistical values
  const percentileValue = normal.inv(percentile / 100, mean, stdDev);
  const confidenceInterval = [
    mean - (stdDev * 1.96), // 95% CI by default
    mean + (stdDev * 1.96),
  ];
  const queryPercentile = normal.cdf(queryValue, mean, stdDev) * 100;

  const option = {
    title: {
      text: "Gaussian Distribution",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      formatter: function (params: any) {
        const x = params[0].data[0];
        const y = params[0].data[1];
        const percentile = normal.cdf(x, mean, stdDev) * 100;
        return `Value: ${x.toFixed(2)}<br/>
                Density: ${y.toFixed(4)}<br/>
                Percentile: ${percentile.toFixed(2)}%`;
      },
    },
    xAxis: {
      type: "value",
      name: "Value",
      nameLocation: "middle",
      nameGap: 30,
    },
    yAxis: {
      type: "value",
      name: "Probability Density",
      nameLocation: "middle",
      nameGap: 40,
    },
    series: [
      {
        name: `N(${mean}, ${variance})`,
        type: "line",
        smooth: true,
        data: data,
        areaStyle: {
          opacity: 0.2,
        },
        lineStyle: {
          width: 2,
        },
        markLine: {
          silent: true,
          data: [
            {
              xAxis: percentileValue,
              lineStyle: {
                color: '#ff7f50',
                type: 'dashed',
                width: 2
              },
              label: {
                formatter: `${percentile}th percentile`,
                position: 'end',
                color: '#ff7f50'
              }
            },
            {
              xAxis: confidenceInterval[0],
              lineStyle: {
                color: '#91cc75',
                type: 'dashed',
                width: 2
              },
              label: {
                formatter: '95% CI',
                position: 'end',
                color: '#91cc75'
              }
            },
            {
              xAxis: confidenceInterval[1],
              lineStyle: {
                color: '#91cc75',
                type: 'dashed',
                width: 2
              }
            }
          ]
        }
      },
    ],
    grid: {
      left: "10%",
      right: "10%",
      bottom: "10%",
      containLabel: true,
    },
    legend: {
      data: [`N(${mean}, ${variance})`],
      top: 30,
    },
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "80%",
          maxWidth: "800px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          color: "#333",
        }}
      >
        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, color: "#333" }}>Gaussian Distribution Plot</h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "20px",
              cursor: "pointer",
              padding: "5px",
              color: "#666",
              transition: "color 0.2s",
            }}
            onMouseOver={(e) => e.currentTarget.style.color = "#333"}
            onMouseOut={(e) => e.currentTarget.style.color = "#666"}
          >
            ×
          </button>
        </div>
        
        {/* Statistical Analysis Panel */}
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setIsStatsExpanded(!isStatsExpanded)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#333",
              fontSize: "16px",
              fontWeight: "500",
            }}
          >
            <span>Statistical Analysis</span>
            <span style={{ 
              transform: isStatsExpanded ? "rotate(180deg)" : "none", 
              transition: "transform 0.3s ease-in-out" 
            }}>
              ▼
            </span>
          </button>
          
          <div 
            ref={contentRef}
            style={{ 
              maxHeight: isStatsExpanded ? contentHeight : 0,
              overflow: "hidden",
              transition: "max-height 0.3s ease-in-out",
              backgroundColor: "#f5f5f5",
              border: "1px solid #ddd",
              borderTop: "none",
              borderRadius: "0 0 4px 4px"
            }}
          >
            <div style={{ 
              padding: "15px",
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "15px" 
            }}>
              <div>
                <label style={{ display: "block", marginBottom: "5px", color: "#333" }}>
                  Percentile Query:
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={percentile}
                    onChange={(e) => setPercentile(Number(e.target.value))}
                    style={{ 
                      marginLeft: "10px", 
                      width: "60px",
                      padding: "4px",
                      border: "1px solid #ddd",
                      borderRadius: "4px"
                    }}
                  />
                  %
                </label>
                <div style={{ color: "#333" }}>Value at {percentile}th percentile: {percentileValue.toFixed(2)}</div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", color: "#333" }}>
                  Value Query:
                  <input
                    type="number"
                    value={queryValue}
                    onChange={(e) => setQueryValue(Number(e.target.value))}
                    style={{ 
                      marginLeft: "10px", 
                      width: "80px",
                      padding: "4px",
                      border: "1px solid #ddd",
                      borderRadius: "4px"
                    }}
                  />
                </label>
                <div style={{ color: "#333" }}>Percentile at {queryValue}: {queryPercentile.toFixed(2)}%</div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", color: "#333" }}>
                  Confidence Level:
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={confidenceLevel}
                    onChange={(e) => setConfidenceLevel(Number(e.target.value))}
                    style={{ 
                      marginLeft: "10px", 
                      width: "60px",
                      padding: "4px",
                      border: "1px solid #ddd",
                      borderRadius: "4px"
                    }}
                  />
                  %
                </label>
                <div style={{ color: "#333" }}>95% Confidence Interval: [{confidenceInterval[0].toFixed(2)}, {confidenceInterval[1].toFixed(2)}]</div>
              </div>
              <div>
                <div style={{ marginBottom: "5px", color: "#333", fontWeight: "500" }}>Distribution Parameters:</div>
                <div style={{ color: "#333" }}>Mean: {mean.toFixed(2)}</div>
                <div style={{ color: "#333" }}>Standard Deviation: {stdDev.toFixed(2)}</div>
                <div style={{ color: "#333" }}>Variance: {variance.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactECharts
            option={option}
            style={{ height: "400px" }}
            opts={{ renderer: "svg" }}
          />
        </div>
      </div>
    </div>
  );
};