import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface GaussianPlotProps {
  mean: number
  variance: number
  onClose: () => void
}

export const GaussianPlot: React.FC<GaussianPlotProps> = ({ mean, variance, onClose }) => {
  // Generate points for the Gaussian curve
  const stdDev = Math.sqrt(variance)
  const points = 100
  const range = stdDev * 4 // Plot ±4 standard deviations
  const step = (range * 2) / points

  const xValues = Array.from({ length: points }, (_, i) => mean - range + i * step)
  const yValues = xValues.map(x => 
    (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
    Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
  )

  const data = {
    labels: xValues,
    datasets: [
      {
        label: `N(${mean}, ${variance})`,
        data: yValues,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Gaussian Distribution',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Value',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Probability Density',
        },
      },
    },
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        width: '80%',
        maxWidth: '800px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Gaussian Distribution Plot</h3>
          <button 
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '5px',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Line options={options} data={data} />
        </div>
      </div>
    </div>
  )
} 