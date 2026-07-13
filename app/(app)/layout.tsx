import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  return (
    <div className="flex-1 flex flex-col md:flex-row">
      <Nav />
      <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
