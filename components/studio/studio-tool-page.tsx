import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StudioShelf } from "@/components/studio/studio-shelf";
import { studioTool } from "@/components/studio/studio-tools";
import { LayoutGrid } from "lucide-react";

/** Shared page frame for one Practice Studio tool: header, the tool, then "more like this". */
export async function StudioToolPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to use the Practice Studio." />;
  }
  const tool = studioTool(slug);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl px-4 py-6 pb-10 sm:py-8">
        <PageHeader
          back={{ href: "/studio", label: "Practice Studio" }}
          icon={tool.icon}
          iconClassName={tool.color}
          title={tool.title}
          subtitle={tool.blurb}
        />
        <div className="space-y-6">{children}</div>

        <div className="mt-10" {...(tool.group === "games" ? { "data-gamified": "" } : {})}>
          <SectionHeader
            icon={LayoutGrid}
            title={tool.group === "games" ? "More games" : "More tools"}
            accent="text-averna-purple"
            action={{ label: "All tools", href: "/studio" }}
          />
          <StudioShelf group={tool.group} exclude={slug} limit={4} />
        </div>
      </div>
    </div>
  );
}
