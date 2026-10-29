import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {BookOpen,LayoutDashboard} from "lucide-react";
import {readFileSync} from "node:fs";
import {StudentSidebarSections} from "@/components/layout/student-sidebar-sections";
import {Card,CardHeader,CardTitle} from "@/components/ui/card";
import {StudentOfTheWeekCard} from "@/components/student-of-the-week-card";
import {StudioShelf} from "@/components/studio/studio-shelf";
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
afterEach(cleanup);
const sections=[{label:"Overview",items:[{name:"Dashboard",href:"/dashboard",icon:LayoutDashboard}]},{label:"IELTS skills",items:[{name:"Reading",href:"/learning/reading",icon:BookOpen}]},{label:"Library",items:[{name:"Articles",href:"/article",icon:BookOpen}]}];
describe("organized student directory",()=>{
 it("defaults to the overview and skills with optional sections collapsed",()=>{render(<StudentSidebarSections sections={sections} current="/dashboard"/>);expect(screen.getByRole("button",{name:"Library"}).getAttribute("aria-expanded")).toBe("false");expect(screen.queryByRole("link",{name:"Articles"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Library"}));expect(screen.getByRole("link",{name:"Articles"})).toBeTruthy();});
 it("searches hidden destinations and category names without navigation",()=>{render(<StudentSidebarSections sections={sections} current="/dashboard"/>);fireEvent.change(screen.getByRole("searchbox",{name:"Find a page"}),{target:{value:"library"}});expect(screen.getByRole("link",{name:"Articles"})).toBeTruthy();expect(screen.queryByRole("link",{name:"Reading"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Clear navigation search"}));expect(screen.getByRole("link",{name:"Reading"})).toBeTruthy();});
 it("opens the active category and has exactly one selected destination",()=>{const {container,rerender}=render(<StudentSidebarSections sections={sections} current="/dashboard"/>);rerender(<StudentSidebarSections sections={sections} current="/article"/>);expect(screen.getByRole("link",{name:"Articles"}).getAttribute("aria-current")).toBe("page");expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);});
 it("provides an empty state and a way back",()=>{render(<StudentSidebarSections sections={sections} current="/dashboard"/>);fireEvent.change(screen.getByRole("searchbox"),{target:{value:"nonexistent"}});expect(screen.getByRole("status").textContent).toContain("No pages found");fireEvent.click(screen.getByRole("button",{name:"Clear navigation search"}));expect(screen.getAllByRole("link")).toHaveLength(2);});
});
describe("consistent matched cards",()=>{
 it("provides content-sized shared cards without a global fixed height",()=>{const {container}=render(<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader></Card>);expect(container.querySelector('[data-ui="card"]')?.className).toContain("rounded-2xl");expect(container.firstElementChild?.className).not.toContain("h-full");});
 it("keeps full tile descriptions and a uniform grid",()=>{const {container}=render(<StudioShelf group="games"/>);expect(container.firstElementChild?.className).toContain("auto-rows-fr");expect(container.querySelectorAll('a')).toHaveLength(4);expect(container.innerHTML).not.toContain("line-clamp");});
 it("uses the same header and body layout for the weekly feature card",()=>{render(<StudentOfTheWeekCard name="Student with a long name" level={4} title="Explorer" points={808}/>);expect(screen.getByRole("heading",{name:"Student of the Week"})).toBeTruthy();expect(screen.getByText(/808/)).toBeTruthy();});
 it("opts multiple dashboard and progress grids into stretch, never exam panes",()=>{for(const file of ["components/dashboard/tab-panels.tsx","app/progress/page.tsx","app/progress/streaks/page.tsx","app/studio/focus/page.tsx","app/learning/page.tsx"])expect(readFileSync(file,"utf8")).toContain("av-card-grid");const css=readFileSync("app/globals.css","utf8");expect(css).toContain(".av-card-grid > * > .av-card:only-child");});
});
