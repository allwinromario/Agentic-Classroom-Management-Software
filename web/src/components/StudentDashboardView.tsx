import type { StudentDashboard } from "@/lib/types/domain";

export function StudentDashboardView({ d }: { d: StudentDashboard }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {d.student.name}{" "}
          <span className="text-base font-normal text-zinc-500">({d.student.studentId})</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Class {d.student.classId}</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-500">Attendance rate</h2>
          <p className="mt-2 text-3xl font-semibold">{(d.attendanceRate * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-500">Reports</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Export PDF/CSV from aggregated attendance + marks (add a server route when needed).
          </p>
        </div>
      </section>
      <section>
        <h2 className="text-sm font-medium text-zinc-500">Recent attendance</h2>
        {d.recentAttendance.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No attendance rows yet for this student.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {d.recentAttendance.map((r, i) => (
              <li
                key={`${r.date}-${r.status}-${i}`}
                className="flex justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <span>{r.date}</span>
                <span className="capitalize">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-sm font-medium text-zinc-500">Performance by subject</h2>
        {Object.keys(d.marksBySubject).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No assessments yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(d.marksBySubject).map(([subject, v]) => (
              <li
                key={subject}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="font-medium">{subject}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Avg {v.average}% · trend {v.trend}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
