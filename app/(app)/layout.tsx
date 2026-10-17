import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { VehicleProvider } from "@/components/VehicleProvider";
import { ActivityProvider, ActivityBadge } from "@/components/ActivityIndicator";
import { ViewModeProvider } from "@/components/ViewMode";
import { DriveProvider, DriveStrip } from "@/components/Drive";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  return (
    <VehicleProvider>
      <ViewModeProvider>
        <ActivityProvider>
          <DriveProvider>
            <div className="flex-1 flex flex-col md:flex-row">
              <Nav />
              {/* bottom padding keeps the last card clear of the phone tab bar and the live strip */}
              <main className="flex-1 px-4 pt-4 pb-[calc(var(--nav-h)+96px)] md:p-8 md:pb-24 max-w-5xl w-full mx-auto">{children}</main>
            </div>
            <DriveStrip />
            <ActivityBadge />
          </DriveProvider>
        </ActivityProvider>
      </ViewModeProvider>
    </VehicleProvider>
  );
}
