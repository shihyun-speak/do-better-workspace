import Dashboard from "@/components/Dashboard";
import { loadAll } from "@/lib/parsers";
import { auth } from "@/auth";

export const revalidate = 60;

export default async function Page() {
  const session = await auth();
  let initialData = null;
  let error: string | null = null;
  try {
    initialData = await loadAll();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <Dashboard
        initialData={initialData}
        initialError={error}
        viewer={
          session?.user
            ? {
                email: session.user.email || "",
                name: session.user.name || null,
              }
            : null
        }
      />
    </main>
  );
}
