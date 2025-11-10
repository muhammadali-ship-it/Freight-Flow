import { StatsCard } from "../stats-card";
import { Package } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <StatsCard
        title="Total Containers"
        value={156}
        icon={Package}
        trend={{ value: 12, isPositive: true }}
      />
      <StatsCard
        title="In Transit"
        value={89}
        icon={Package}
        trend={{ value: -5, isPositive: false }}
      />
    </div>
  );
}
