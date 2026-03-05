import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const sampleData = [
  { day: "2026-03-01", initiated: 1, completed: 0 },
  { day: "2026-03-02", initiated: 2, completed: 1 },
];

type TuReferralChartPoint = {
  day: string;
  initiated: number;
  completed: number;
};

type TuReferralMetricsChartTestProps = {
  data?: TuReferralChartPoint[] | null;
};

function TuReferralMetricsChartTest({ data }: TuReferralMetricsChartTestProps) {
  const chartData = Array.isArray(data) && data.length > 0 ? data : sampleData;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="initiated" name="Initiated" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="completed" name="Completed" stroke="#16a34a" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TuReferralMetricsChartTest;
