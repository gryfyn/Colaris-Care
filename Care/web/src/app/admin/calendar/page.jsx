"use client";

import { PageHeader } from "@/components/ui/data";
import { apiData } from "@/lib/client-api";
import CalendarMonth from "@/components/calendar/CalendarMonth";

export default function AdminCalendarPage() {
  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Schedule"
        title="Facility calendar"
        lede="Appointments, announcements, and evacuation drills on a monthly calendar. Click any day to view its events or add a new one."
      />
      <CalendarMonth apiData={apiData} />
    </div>
  );
}
