import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Dense desktop calendar for the period-picker pilot.
 * Does NOT import react-day-picker/style.css — default rdp chrome looks like grey pills.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={zhCN}
      weekStartsOn={1}
      className={cn("gp-period-calendar", className)}
      classNames={{
        root: "rdp-root",
        months: "rdp-months",
        month: "rdp-month",
        month_caption: "rdp-month_caption",
        caption_label: "rdp-caption_label",
        nav: "rdp-nav",
        button_previous: "rdp-button_previous",
        button_next: "rdp-button_next",
        month_grid: "rdp-month_grid",
        weekdays: "rdp-weekdays",
        weekday: "rdp-weekday",
        weeks: "rdp-weeks",
        week: "rdp-week",
        day: "rdp-day",
        day_button: "rdp-day_button",
        selected: "rdp-selected",
        today: "rdp-today",
        outside: "rdp-outside",
        disabled: "rdp-disabled",
        hidden: "rdp-hidden",
        focused: "rdp-focused",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
