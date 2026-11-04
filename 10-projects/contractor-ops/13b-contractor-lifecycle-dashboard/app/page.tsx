import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import { loadAll } from "@/lib/parsers";
import { readSteps, type StepState } from "@/lib/steps";
import { defaultRegionFor } from "@/lib/regions";
import HubApp from "@/components/v2/HubApp";
import "./hub.css";

// Contractor Hub (the redesign). Home page since 2026-11-04; the old dashboard
// lives at /classic (app/classic/page.tsx).

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  let data = null;
  let error: string | null = null;
  let steps: StepState = {};
  let stepsError: string | null = null;
  try {
    [data, steps] = await Promise.all([
      loadAll(),
      readSteps().catch((err) => {
        stepsError = err instanceof Error ? err.message : String(err);
        return {} as StepState;
      }),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return (
    <div className={`hub ${geist.variable} ${geistMono.variable}`}>
      {data ? (
        <HubApp
          data={data}
          initialSteps={steps}
          stepsError={stepsError}
          defaultRegion={defaultRegionFor(session?.user?.email)}
          viewerEmail={session?.user?.email || ""}
        />
      ) : (
        <main className="main">
          <h1>Couldn&apos;t load contractor data</h1>
          <p className="sub">{error}</p>
        </main>
      )}
    </div>
  );
}
