import { useState } from "react";
import { SearchBar } from "../search-bar";

export default function SearchBarExample() {
  const [value, setValue] = useState("");

  return (
    <div className="p-4">
      <SearchBar value={value} onChange={setValue} />
    </div>
  );
}
