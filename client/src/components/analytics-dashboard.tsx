import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Package, Clock, DollarSign, AlertTriangle } from "lucide-react";

interface AnalyticsDashboardProps {
  onTimeDeliveryRate: number;
  averageTransitDays: number;
  exceptionRate: number;
  totalDemurrageCost: number;
}

const monthlyData = [
  { month: "Jul", shipments: 45, onTime: 38 },
  { month: "Aug", shipments: 52, onTime: 46 },
  { month: "Sep", shipments: 48, onTime: 42 },
  { month: "Oct", shipments: 61, onTime: 55 },
  { month: "Nov", shipments: 58, onTime: 52 },
  { month: "Dec", shipments: 67, onTime: 61 },
];

const carrierPerformance = [
  { name: "Maersk", value: 35, onTime: 92 },
  { name: "MSC", value: 28, onTime: 88 },
  { name: "COSCO", value: 22, onTime: 85 },
  { name: "Hapag", value: 15, onTime: 90 },
];

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export function AnalyticsDashboard({ 
  onTimeDeliveryRate, 
  averageTransitDays, 
  exceptionRate, 
  totalDemurrageCost 
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              On-Time Delivery
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{onTimeDeliveryRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-chart-2">+2.5%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Avg Transit Time
            </CardTitle>
            <Clock className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{averageTransitDays} days</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-chart-2">-1.2 days</span> improvement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Exception Rate
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-chart-5" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{exceptionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-chart-5">+0.8%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demurrage Costs
            </CardTitle>
            <DollarSign className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalDemurrageCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-chart-2">-15%</span> from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px"
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="shipments" stroke="hsl(var(--chart-1))" name="Total Shipments" strokeWidth={2} />
                <Line type="monotone" dataKey="onTime" stroke="hsl(var(--chart-2))" name="On-Time" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Carrier Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={carrierPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {carrierPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carrier Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={carrierPerformance}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }}
              />
              <Legend />
              <Bar dataKey="onTime" fill="hsl(var(--chart-2))" name="On-Time %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
