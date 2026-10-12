import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { VehicleProvider } from "@/components/VehicleProvider";
import { ActivityProvider, ActivityBadge } from "@/components/ActivityIndicator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  return (
    <VehicleProvider>
      <ActivityProvider>
        <div className="flex-1 flex flex-col md:flex-row">
          <Nav />
          {/* bottom padding keeps the last card clear of the phone tab bar */}
          <main className="flex-1 px-4 pt-4 pb-[calc(var(--nav-h)+24px)] md:p-8 md:pb-10 max-w-5xl w-full mx-auto">{children}</main>
        </div>
        <ActivityBadge />
      </ActivityProvider>
    </VehicleProvider>
  );
}
