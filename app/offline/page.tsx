import type { Metadata } from "next";
import { OfflineHub } from "@/components/offline/offline-hub";
import "../article/articles.css";

/**
 * The offline library (idea 7). Static on purpose: the HTML is the same for everyone and holds
 * no personal data, so the service worker may keep it (with its static files) once a student
 * saves a pack. Everything personal comes from this device's IndexedDB / Cache Storage.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Saved on this device",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflineHub />;
}
