
    },
    tooltip: {
      trigger: "axis",
      formatter: function (params: any) {

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

            }}
          >
            ⚙️
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
