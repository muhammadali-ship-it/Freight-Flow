import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function CustomCaption(props: CaptionProps) {
  const { goToMonth, currentMonth } = useNavigation();
  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const handleMonthChange = (value: string) => {
    const newMonth = parseInt(value);
    const newDate = new Date(currentYear, newMonth, 1);
    goToMonth(newDate);
  };

  const handleYearChange = (value: string) => {
    const newYear = parseInt(value);
    const newDate = new Date(newYear, currentMonthIndex, 1);
    goToMonth(newDate);
  };

  return (
    <div className="flex justify-center items-center gap-2 mb-2">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        onClick={() => goToMonth(new Date(currentYear, currentMonthIndex - 1, 1))}
        data-testid="button-prev-month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select value={currentMonthIndex.toString()} onValueChange={handleMonthChange}>
        <SelectTrigger className="h-8 w-[120px]" data-testid="select-month">
          <SelectValue>{months[currentMonthIndex]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {months.map((month, index) => (
            <SelectItem key={month} value={index.toString()}>
              {month}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          onClick={() => handleYearChange((currentYear - 1).toString())}
          data-testid="button-prev-year"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="w-[60px] text-center text-sm font-medium" data-testid="text-year">
          {currentYear}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          onClick={() => handleYearChange((currentYear + 1).toString())}
          data-testid="button-next-year"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        onClick={() => goToMonth(new Date(currentYear, currentMonthIndex + 1, 1))}
        data-testid="button-next-month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
