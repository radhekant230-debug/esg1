import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaFilter,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle,
  FaVideo,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaTimes,
  FaBuilding,
  FaUserTie,
  FaHistory,
} from "react-icons/fa";

export default function CalendarPage() {
  const { user, isAdmin, isManager } = useContext(AuthContext);

  // View state: 'month' | 'week' | 'day'
  const [viewMode, setViewMode] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Events & Data State
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);

  // Filters
  const [selectedEventType, setSelectedEventType] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Modals
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    eventType: "Follow-up Reminder",
    eventDate: "",
    endDate: "",
    clientId: "",
    meetingLink: "",
    location: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Fetch initial data
  useEffect(() => {
    fetchEvents();
    fetchClientsAndManagers();
  }, [currentDate, selectedEventType, selectedClient, selectedStatus]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedEventType) params.eventType = selectedEventType;
      if (selectedClient) params.client = selectedClient;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get("/risks/calendar/events", { params });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching calendar events:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientsAndManagers = async () => {
    try {
      const [cRes, mRes] = await Promise.allSettled([
        api.get("/portal/clients-selector"),
        api.get("/admin/managers"),
      ]);
      if (cRes.status === "fulfilled" && cRes.value.data?.clients) {
        setClients(cRes.value.data.clients);
      }
      if (mRes.status === "fulfilled" && Array.isArray(mRes.value.data?.managers)) {
        setManagers(mRes.value.data.managers);
      }
    } catch (e) {
      console.error("Error loading filters:", e);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    try {
      await api.post("/risks/calendar/events", createForm);
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        description: "",
        eventType: "Follow-up Reminder",
        eventDate: "",
        endDate: "",
        clientId: "",
        meetingLink: "",
        location: "",
      });
      fetchEvents();
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to schedule event.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Navigation helpers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() - 1);
    else if (viewMode === "week") next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month Grid Calculation
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill complete grid of 35 or 42
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Event Color Badges
  const getEventBadgeClass = (eventType, isPostponed, status) => {
    if (isPostponed) {
      return "bg-amber-100 text-amber-900 border-amber-300";
    }
    if (status === "Completed") {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    switch (eventType) {
      case "Risk Review":
        return "bg-blue-100 text-blue-900 border-blue-200";
      case "Approval Deadline":
        return "bg-purple-100 text-purple-900 border-purple-300 font-semibold";
      case "Scheduled Meeting":
        return "bg-teal-100 text-teal-900 border-teal-200";
      case "Follow-up Reminder":
        return "bg-stone-100 text-stone-800 border-stone-300";
      case "Postponed Review":
        return "bg-amber-100 text-amber-900 border-amber-300";
      default:
        return "bg-stone-100 text-stone-800 border-stone-200";
    }
  };

  // Helper to match events for a given day
  const getEventsForDay = (dateObj) => {
    const targetYMD = dateObj.toISOString().split("T")[0];
    return events.filter((ev) => {
      const evDate = new Date(ev.eventDate).toISOString().split("T")[0];
      return evDate === targetYMD;
    });
  };

  // Format month title
  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const yearName = currentDate.getFullYear();

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================
          1. HEADER & CONTROLS
      ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#9C7A42]"></span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#8C6D37] font-bold">
              PORTFOLIO SCHEDULE &amp; TIMELINES
            </span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1816] tracking-tight">
            Calendar &amp; Scheduling
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Interactive risk review dates, client 24h approval deadlines, postponement tracking, and stakeholder meetings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#FBF9F5] p-1 border border-[#E7DFD5] rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === "month"
                  ? "bg-[#FFFFFF] text-[#1A1816] shadow-2xs font-bold"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === "week"
                  ? "bg-[#FFFFFF] text-[#1A1816] shadow-2xs font-bold"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === "day"
                  ? "bg-[#FFFFFF] text-[#1A1816] shadow-2xs font-bold"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Day
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-[#9C7A42] hover:bg-[#856734] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
          >
            <FaPlus className="text-xs" /> Schedule Event
          </button>
        </div>
      </div>

      {/* =========================================================
          2. CALENDAR CONTROLS & FILTERS BAR
      ========================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#FAF8F5] border border-[#E7DFD5] rounded-xl overflow-hidden">
            <button
              onClick={handlePrev}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-[#F2EDE4] transition"
              title="Previous"
            >
              <FaChevronLeft className="text-xs" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-mono font-semibold text-stone-700 hover:bg-[#F2EDE4] transition border-x border-[#E7DFD5]"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-[#F2EDE4] transition"
              title="Next"
            >
              <FaChevronRight className="text-xs" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-serif font-bold text-[#1A1816]">
            {monthName} {yearName}
          </h2>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
          >
            <option value="">All Event Types</option>
            <option value="Risk Review">Risk Review Dates</option>
            <option value="Approval Deadline">Approval Deadlines (24h)</option>
            <option value="Scheduled Meeting">Scheduled Meetings</option>
            <option value="Follow-up Reminder">Follow-up Reminders</option>
            <option value="Postponed Review">Postponed Items</option>
          </select>

          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
          >
            <option value="">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Postponed">Postponed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* =========================================================
          3. MAIN CALENDAR DISPLAY
      ========================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl shadow-2xs overflow-hidden">
        {/* Month View */}
        {viewMode === "month" && (
          <div>
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-[#FAF8F5] border-b border-[#E7DFD5] text-center py-2.5 text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-[#EFE9DF] border-b border-[#E7DFD5]">
              {monthData.map((d, index) => {
                const dayEvents = getEventsForDay(d.date);
                const isToday =
                  d.date.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={index}
                    className={`min-h-[110px] p-2 flex flex-col transition ${
                      d.isCurrentMonth
                        ? "bg-[#FFFFFF]"
                        : "bg-[#FBF9F5]/60 text-stone-300"
                    } hover:bg-[#FAF8F5]/80`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded-md ${
                          isToday
                            ? "bg-[#9C7A42] text-white font-bold"
                            : d.isCurrentMonth
                            ? "text-stone-700"
                            : "text-stone-400"
                        }`}
                      >
                        {d.date.getDate()}
                      </span>

                      {dayEvents.length > 0 && (
                        <span className="text-[9px] font-mono text-stone-400">
                          {dayEvents.length} {dayEvents.length === 1 ? "item" : "items"}
                        </span>
                      )}
                    </div>

                    {/* Events Chips */}
                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px] custom-scrollbar">
                      {dayEvents.map((ev) => (
                        <div
                          key={ev._id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`p-1.5 rounded-lg border text-[10px] leading-tight truncate cursor-pointer transition hover:opacity-90 shadow-2xs ${getEventBadgeClass(
                            ev.eventType,
                            ev.isPostponed,
                            ev.status
                          )}`}
                          title={`${ev.title} (${ev.eventType}) - ${ev.clientName || ""}`}
                        >
                          <div className="flex items-center gap-1 font-semibold truncate">
                            {ev.isPostponed && (
                              <span className="text-[9px] text-amber-800">⏱</span>
                            )}
                            {ev.eventType === "Approval Deadline" && (
                              <span className="text-[9px] text-purple-800 font-bold">24h</span>
                            )}
                            <span className="truncate">{ev.title}</span>
                          </div>
                          {ev.clientName && (
                            <p className="text-[9px] opacity-75 truncate">{ev.clientName}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === "week" && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-stone-500 font-mono">
              7-Day Agenda Horizon from {currentDate.toLocaleDateString()}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, i) => {
                const dayDate = new Date(currentDate);
                dayDate.setDate(currentDate.getDate() + i);
                const dayEvents = getEventsForDay(dayDate);
                const isToday =
                  dayDate.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={i}
                    className="p-3 bg-[#FAF8F5] border border-[#E7DFD5] rounded-xl flex flex-col min-h-[220px]"
                  >
                    <div className="pb-2 mb-2 border-b border-[#E7DFD5] flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase font-bold text-stone-600">
                        {dayDate.toLocaleDateString("default", { weekday: "short" })}
                      </span>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
                          isToday
                            ? "bg-[#9C7A42] text-white"
                            : "bg-[#EFE9DF] text-stone-800"
                        }`}
                      >
                        {dayDate.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
                      {dayEvents.length === 0 ? (
                        <p className="text-[10px] text-stone-400 italic text-center pt-6">
                          No events
                        </p>
                      ) : (
                        dayEvents.map((ev) => (
                          <div
                            key={ev._id}
                            onClick={() => setSelectedEvent(ev)}
                            className={`p-2 rounded-lg border text-xs cursor-pointer ${getEventBadgeClass(
                              ev.eventType,
                              ev.isPostponed,
                              ev.status
                            )}`}
                          >
                            <p className="font-bold text-[11px] leading-tight truncate">
                              {ev.title}
                            </p>
                            <p className="text-[10px] opacity-80 mt-0.5">
                              {new Date(ev.eventDate).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            {ev.clientName && (
                              <p className="text-[9.5px] font-mono text-stone-500 truncate mt-1">
                                {ev.clientName}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === "day" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <h3 className="font-serif font-bold text-lg text-[#1A1816]">
                Daily Schedule: {currentDate.toLocaleDateString("default", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
              <span className="text-xs font-mono text-stone-500">
                {getEventsForDay(currentDate).length} scheduled items
              </span>
            </div>

            <div className="divide-y divide-[#EFE9DF]">
              {getEventsForDay(currentDate).length === 0 ? (
                <div className="py-12 text-center text-stone-400 italic">
                  No risk deadlines, review dates, or meetings scheduled for this date.
                </div>
              ) : (
                getEventsForDay(currentDate).map((ev) => (
                  <div
                    key={ev._id}
                    onClick={() => setSelectedEvent(ev)}
                    className="py-3.5 flex items-start justify-between gap-4 hover:bg-[#FAF8F5] p-2 rounded-xl transition cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] border ${getEventBadgeClass(
                            ev.eventType,
                            ev.isPostponed,
                            ev.status
                          )}`}
                        >
                          {ev.eventType}
                        </span>
                        {ev.isPostponed && (
                          <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Rescheduled
                          </span>
                        )}
                        <span className="font-mono text-xs text-stone-500">
                          {new Date(ev.eventDate).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <h4 className="font-bold text-stone-900 text-sm">{ev.title}</h4>
                      <p className="text-xs text-stone-600 max-w-xl">{ev.description}</p>
                    </div>

                    <div className="text-right whitespace-nowrap text-xs text-stone-500">
                      <p className="font-semibold text-stone-800">{ev.clientName || "All Clients"}</p>
                      <button className="mt-2 text-xs font-semibold text-[#8C6D37] hover:underline">
                        View Details →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          4. EVENT DETAILS MODAL
      ========================================================= */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${getEventBadgeClass(
                      selectedEvent.eventType,
                      selectedEvent.isPostponed,
                      selectedEvent.status
                    )}`}
                  >
                    {selectedEvent.eventType}
                  </span>
                  <span className="text-xs font-mono text-stone-400">
                    Status: {selectedEvent.status}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-stone-700">
              {/* Postponed Warning if event was postponed */}
              {selectedEvent.isPostponed && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                    <FaHistory className="text-amber-700" /> Postponement History Notice
                  </div>
                  <p className="text-amber-900">
                    Reason: <strong>{selectedEvent.postponementReason || "Rescheduled"}</strong>
                  </p>
                  {selectedEvent.previousDate && (
                    <p className="font-mono text-stone-600 text-[10px]">
                      Original Date: {new Date(selectedEvent.previousDate).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <div>
                <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-semibold">
                  Scheduled Time &amp; Date
                </span>
                <p className="font-mono text-sm text-[#1A1816] font-bold mt-0.5">
                  {new Date(selectedEvent.eventDate).toLocaleString("default", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              {selectedEvent.description && (
                <div>
                  <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-semibold">
                    Description &amp; Agenda
                  </span>
                  <p className="text-stone-800 bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DFD5] mt-0.5 leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-semibold">
                    Client Account
                  </span>
                  <p className="font-semibold text-stone-900 mt-0.5">
                    {selectedEvent.clientName || "General / Agency-wide"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-semibold">
                    Meeting Link / Venue
                  </span>
                  <p className="text-stone-900 mt-0.5 truncate">
                    {selectedEvent.meetingLink ? (
                      <a
                        href={selectedEvent.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 hover:underline flex items-center gap-1"
                      >
                        <FaVideo className="text-xs" /> Join Virtual Meeting
                      </a>
                    ) : selectedEvent.location ? (
                      <span className="flex items-center gap-1">
                        <FaMapMarkerAlt className="text-xs text-stone-500" /> {selectedEvent.location}
                      </span>
                    ) : (
                      "Executive Suite"
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-[#9C7A42] text-white rounded-xl font-bold text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          5. SCHEDULE EVENT MODAL
      ========================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">Schedule Calendar Event</h3>
                <p className="text-xs text-stone-500">
                  Add risk review, follow-up milestone, or client consultation meeting.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <form
              onSubmit={handleCreateEvent}
              className="p-6 space-y-4 text-xs overflow-y-auto max-h-[80vh] custom-scrollbar"
            >
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Brand Positioning Review with Leadership"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Event Type *</label>
                  <select
                    value={createForm.eventType}
                    onChange={(e) => setCreateForm({ ...createForm, eventType: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  >
                    <option value="Risk Review">Risk Review</option>
                    <option value="Scheduled Meeting">Scheduled Meeting</option>
                    <option value="Follow-up Reminder">Follow-up Reminder</option>
                    <option value="Approval Deadline">Approval Deadline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Client (Optional)</label>
                  <select
                    value={createForm.clientId}
                    onChange={(e) => setCreateForm({ ...createForm, clientId: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  >
                    <option value="">General Agency Calendar</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Event Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={createForm.eventDate}
                    onChange={(e) => setCreateForm({ ...createForm, eventDate: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">End Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Agenda items, participants, discussion objectives..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Virtual Meeting Link</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={createForm.meetingLink}
                  onChange={(e) => setCreateForm({ ...createForm, meetingLink: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end gap-3 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-[#9C7A42] hover:bg-[#856734] text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {createLoading ? "Scheduling..." : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
