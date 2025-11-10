import { ContainerTimeline } from "../container-timeline";

export default function ContainerTimelineExample() {
  const events = [
    { id: "1", title: "Container Picked Up", location: "Shanghai, China", timestamp: "Dec 1, 09:30", completed: true },
    { id: "2", title: "Loaded on Vessel", location: "Port of Shanghai", timestamp: "Dec 2, 14:00", completed: true },
    { id: "3", title: "In Transit", location: "Pacific Ocean", timestamp: "Current", completed: false, isCurrent: true },
    { id: "4", title: "Arrival at Port", location: "Los Angeles, USA", timestamp: "Dec 15 (Est.)", completed: false },
    { id: "5", title: "Delivery", location: "Los Angeles, USA", timestamp: "Pending", completed: false },
  ];

  return (
    <div className="p-4 max-w-md">
      <ContainerTimeline events={events} />
    </div>
  );
}
