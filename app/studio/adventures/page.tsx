export const dynamic = "force-dynamic";
import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { AdventureHub } from "@/components/adventures/adventure-hub";
import "@/components/adventures/adventures.css";
export const metadata = { title: "Adventures · Practice Studio" };
export default function AdventuresPage() { return <StudioToolPage slug="adventures"><AdventureHub /></StudioToolPage>; }
