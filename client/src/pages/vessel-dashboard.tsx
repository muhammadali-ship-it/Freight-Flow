import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, Package, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Vessel {
    id: string;
    name: string;
    tripNumber: string | null;
    destination: string | null;
    eta: string | null;
    atd: string | null;
    containerCount: number;
    lastUpdated: string;
    createdAt: string;
}

export default function VesselDashboard() {
    const { data: vesselsData, isLoading } = useQuery<{
        data: Vessel[];
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>({
        queryKey: ["/api/vessels"],
    });

    const vessels = vesselsData?.data || [];
    const totalVessels = vessels.length;
    const totalContainers = vessels.reduce((sum, v) => sum + v.containerCount, 0);

    // Prepare chart data
    const chartData = vessels
        .sort((a, b) => b.containerCount - a.containerCount)
        .slice(0, 10)
        .map(v => ({
            name: v.name.length > 20 ? v.name.substring(0, 20) + '...' : v.name,
            containers: v.containerCount,
        }));

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Vessel Dashboard</h1>
                    <p className="text-muted-foreground">Track vessels and their container analytics</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Vessels</CardTitle>
                        <Ship className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalVessels}</div>
                        <p className="text-xs text-muted-foreground">Active vessels tracked</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalContainers}</div>
                        <p className="text-xs text-muted-foreground">Across all vessels</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Containers/Vessel</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totalVessels > 0 ? (totalContainers / totalVessels).toFixed(1) : 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Average load</p>
                    </CardContent>
                </Card>
            </div>

            {/* Container Analytics Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Containers per Vessel (Top 10)</CardTitle>
                    <CardDescription>Number of containers arriving on each vessel</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="h-[400px] flex items-center justify-center">
                            <p className="text-muted-foreground">Loading chart...</p>
                        </div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="containers" fill="#3b82f6" name="Containers" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[400px] flex items-center justify-center">
                            <p className="text-muted-foreground">No vessel data available</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Vessels Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Vessels</CardTitle>
                    <CardDescription>Complete list of tracked vessels</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">Loading vessels...</p>
                        </div>
                    ) : vessels.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2 font-medium">Vessel Name</th>
                                        <th className="text-left p-2 font-medium">Trip Number</th>
                                        <th className="text-left p-2 font-medium">Destination</th>
                                        <th className="text-left p-2 font-medium">ETA</th>
                                        <th className="text-right p-2 font-medium">Containers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vessels.map((vessel) => (
                                        <tr key={vessel.id} className="border-b hover:bg-muted/50">
                                            <td className="p-2 font-medium">{vessel.name}</td>
                                            <td className="p-2">{vessel.tripNumber || '-'}</td>
                                            <td className="p-2">{vessel.destination || '-'}</td>
                                            <td className="p-2">
                                                {vessel.eta ? new Date(vessel.eta).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-2 text-right">{vessel.containerCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No vessels found</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
