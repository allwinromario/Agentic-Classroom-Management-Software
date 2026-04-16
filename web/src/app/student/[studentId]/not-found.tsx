import Link from "next/link";

export default function StudentNotFound() {
  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Student not found</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        That <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">student_id</code> is not in MongoDB.
        Run Python <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">initialize_scms</code> or check your
        connection string.
      </p>
      <Link href="/" className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
        Back home
      </Link>
    </main>
  );
}
