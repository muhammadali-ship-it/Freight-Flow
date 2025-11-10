import { useState } from "react";
import { FilterBar, FilterState } from "../filter-bar";

export default function FilterBarExample() {
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    carrier: "all",
    origin: "all",
  });

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ status: "all", carrier: "all", origin: "all" });
  };

  return (
    <div className="p-4">
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
    </div>
  );
}
