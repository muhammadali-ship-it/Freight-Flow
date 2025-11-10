import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Package, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CostAnalytics {
  totalCost: number;
  avgDemurrage: number;
  costByType: { type: string; value: number }[];
  monthlyTrend: { month: string; cost: number }[];
  topShipmentsByCost: Array<{
    shipmentId: string;
    containerNumber: string;
    totalCost: number;
    demurrage: number;
    detention: number;
  }>;
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function CostAnalytics() {
  const { data: analytics, isLoading } = useQuery<CostAnalytics>({
    queryKey: ["/api/cost-analytics"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading cost analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">No cost data available</div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-cost-analytics">Cost Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive operational cost tracking and analysis
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-total-cost">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operational Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cost">
              {formatCurrency(analytics.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time across all shipments
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-demurrage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Demurrage per Container</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-demurrage">
              {formatCurrency(analytics.avgDemurrage)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Containers with demurrage charges
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Cost by Type Pie Chart */}
        <Card data-testid="card-cost-breakdown">
          <CardHeader>
            <CardTitle>Cost Breakdown by Type</CardTitle>
            <CardDescription>Distribution of operational costs</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.costByType.filter(c => c.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.type}: ${formatCurrency(entry.value)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.costByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend Bar Chart */}
        <Card data-testid="card-monthly-trend">
          <CardHeader>
            <CardTitle>Monthly Cost Trend</CardTitle>
            <CardDescription>Last 6 months operational costs</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={formatMonth}
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  tickFormatter={(value) => `$${value}`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={formatMonth}
                />
                <Legend />
                <Bar dataKey="cost" fill="#3b82f6" name="Total Cost" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Shipments Table */}
      <Card data-testid="card-top-shipments">
        <CardHeader>
          <CardTitle>Top 10 Containers by Cost</CardTitle>
          <CardDescription>Highest operational costs per container</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.topShipmentsByCost.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No cost data available yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Costs will appear as containers accrue charges
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container Number</TableHead>
                  <TableHead className="text-right">Demurrage</TableHead>
                  <TableHead className="text-right">Detention</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topShipmentsByCost.map((shipment, index) => (
                  <TableRow key={shipment.containerNumber} data-testid={`row-cost-${index}`}>
                    <TableCell className="font-mono font-medium">
                      {shipment.containerNumber}
                    </TableCell>
                    <TableCell className="text-right">
                      {shipment.demurrage > 0 ? (
                        <Badge variant="destructive">{formatCurrency(shipment.demurrage)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {shipment.detention > 0 ? (
                        <Badge variant="outline">{formatCurrency(shipment.detention)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold" data-testid={`text-total-cost-${index}`}>
                      {formatCurrency(shipment.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
