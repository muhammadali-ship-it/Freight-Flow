import { ContainerCard } from "../container-card";

export default function ContainerCardExample() {
  return (
    <div className="p-4 max-w-sm">
      <ContainerCard
        containerNumber="MSCU1234567"
        status="in-transit"
        origin="Shanghai"
        destination="Los Angeles"
        carrier="MSC"
        eta="Dec 15, 2025"
        progress={65}
        reference="PO-2024-1156"
        onViewDetails={() => console.log("View details clicked")}
      />
    </div>
  );
}
