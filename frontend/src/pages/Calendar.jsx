import { useCallback, useEffect, useState } from "react";
import { planApi, getErrorMessage } from "../services/api.js";
import Loading from "../components/Loading.jsx";
import { monthLabel, shiftMonth, todayISO } from "../utils/helpers.js";

function buildCalendarGrid(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await planApi.calendar(month));
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the calendar."));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayISO();
  const cells = buildCalendarGrid(month);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>Calendar</h1>
          <p style={{ color: "var(--text-soft)" }}>Study sessions and exam dates at a glance.</p>
        </div>
      </div>

      <div className="card">
        <div className="cal-head">
          <button className="button ghost" onClick={() => setMonth(shiftMonth(month, -1))}>←</button>
          <h2>{monthLabel(month)}</h2>
          <button className="button ghost" onClick={() => setMonth(shiftMonth(month, 1))}>→</button>
        </div>

        {error && <div className="form-banner error">{error}</div>}
        {loading && <Loading label="Loading calendar..." />}

        {data && !loading && (
          <>
            <div className="cal-grid">
              {weekdays.map((day) => (
                <div key={day} className="cal-weekday">{day}</div>
              ))}
              {cells.map((day, index) => {
                if (day === null) return <div key={index} className="cal-cell out" />;
                const dateStr = `${month}-${String(day).padStart(2, "0")}`;
                const sessions = data.sessions_by_date[dateStr] || [];
                const exams = data.exams.filter((exam) => exam.date === dateStr);
                const studyCount = sessions.filter((s) => !s.is_break).length;

                return (
                  <div key={dateStr} className={`cal-cell ${dateStr === today ? "today" : ""}`}>
                    <div className="cal-daynum">{day}</div>
                    {studyCount > 0 && (
                      <div className="cal-chip" title={sessions.map((s) => s.topic_name || s.subject_name).filter(Boolean).join(", ")}>
                        📖 {studyCount} session{studyCount > 1 ? "s" : ""}
                      </div>
                    )}
                    {sessions.some((s) => s.status === "completed" && !s.is_break) && (
                      <div className="cal-chip done">✅ done</div>
                    )}
                    {exams.map((exam) => (
                      <div key={exam.subject_id} className="cal-chip exam" title={`${exam.name} exam`}>
                        📝 {exam.name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="cal-legend">
              <span>📖 Study sessions</span>
              <span>✅ Completed sessions</span>
              <span>📝 Exam date</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
