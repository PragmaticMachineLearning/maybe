import React from "react";
import ReactECharts from "echarts-for-react";

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

  const option = {
    title: {
      text: "Gaussian Distribution",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      formatter: function (params: any) {
        return `Value: ${params[0].data[0].toFixed(2)}<br/>
                Density: ${params[0].data[1].toFixed(4)}`;
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
          <h3 style={{ margin: 0 }}>Gaussian Distribution Plot</h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "20px",
              cursor: "pointer",
              padding: "5px",
            }}
          >
            ×
          </button>
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
