import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BiasChart = ({ data }: any) => {

  if (!data || data.length === 0) return null;

  const labels = data.map((a: any) => a.source);
  const scores = data.map((a: any) => a.bias_score ?? 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Bias Score",
        data: scores,
        backgroundColor: "rgba(37, 99, 235, 0.6)"
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const }
    }
  };

  return (
    <div style={{ height: "300px", marginTop: "20px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default BiasChart;