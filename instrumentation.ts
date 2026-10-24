// Runs once when the server starts. The only job: the phone-notification
// check every five minutes (lib/notify.ts). Hosts that freeze idle servers
// can call POST /api/push {"action":"run"} from a cron instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NOTIFY_DISABLED === "1") return;
  const { startNotifyScheduler } = await import("./lib/notify");
  startNotifyScheduler();
}
