import { redirect } from "next/navigation";

// /v2 became the home page on 2026-11-04; keep old bookmarks working.
export default function V2Redirect() {
  redirect("/");
}
