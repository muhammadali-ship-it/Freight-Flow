import { CheckCircle2, Circle, MapPin } from "lucide-react";

export interface TimelineEvent {
  id: string;
  title: string;
  location: string;
  timestamp: string;
  completed: boolean;
  isCurrent?: boolean;
}

interface ContainerTimelineProps {
  events: TimelineEvent[];
}

export function ContainerTimeline({ events }: ContainerTimelineProps) {
  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4" data-testid={`timeline-event-${index}`}>
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                event.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : event.isCurrent
                  ? "border-primary bg-background animate-pulse"
                  : "border-border bg-background"
              }`}
            >
              {event.completed ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            {index < events.length - 1 && (
              <div
                className={`w-0.5 flex-1 min-h-8 ${
                  event.completed ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
          <div className="flex-1 pb-8">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{event.title}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </div>
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {event.timestamp}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
