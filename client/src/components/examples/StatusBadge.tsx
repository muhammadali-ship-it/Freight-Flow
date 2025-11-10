import { StatusBadge } from "../status-badge";

export default function StatusBadgeExample() {
  return (
    <div className="p-4 flex flex-wrap gap-2">
      <StatusBadge status="delivered" />
      <StatusBadge status="in-transit" />
      <StatusBadge status="delayed" />
      <StatusBadge status="at-port" />
      <StatusBadge status="processing" />
    </div>
  );
}
