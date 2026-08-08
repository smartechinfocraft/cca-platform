import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import MaintenancePage from "./pages/MaintenancePage";

type SiteStatus = { maintenanceEnabled: boolean; maintenanceTitle: string; maintenanceMessage: string; maintenanceContactEmail?: string };

function App() {
  const location = useLocation();
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001/api";
    fetch(`${apiBase}/public/site-status`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Site status unavailable")))
      .then(payload => setSiteStatus(payload.data))
      .catch(() => setSiteStatus({ maintenanceEnabled: false, maintenanceTitle: "", maintenanceMessage: "" }));
  }, [location.pathname]);

  const bypassMaintenance = location.pathname === "/login" || location.pathname.startsWith("/admin");
  const isPortalRoute = ["/dashboard", "/admin", "/coach"].some(
    route => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  const showChatbotWidget = !isPortalRoute;
  if (!siteStatus) return <div className="flex min-h-screen items-center justify-center bg-[#0b1d12] text-[#f5d97a]">Loading...</div>;
  if (siteStatus.maintenanceEnabled && !bypassMaintenance) return <MaintenancePage title={siteStatus.maintenanceTitle} message={siteStatus.maintenanceMessage} contactEmail={siteStatus.maintenanceContactEmail} />;

  return (
    <>
      <AppRoutes />
      {showChatbotWidget && (
        <>
          <div className="chatbot-widget fixed bottom-4 left-1 z-50">
            <span className="brand-img fixed bottom-24 left-1 w-42 flex text-xs gap-2 items-center">
              Powered by
              <a href="https://elevenlabs.io/agents" target="_blank" rel="noreferrer">
                <img src="https://11labs-nonprd-15f22c1d.s3.eu-west-3.amazonaws.com/0b9cd3e1-9fad-4a5b-b3a0-c96b0a1f1d2b/elevenlabs-logo-black.svg" alt="ElevenLabs" style={{ width: "auto", height: "10px", cursor: "pointer" }} />
              </a>
            </span>
          </div>
          <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
          {/* @ts-ignore */}
          <elevenlabs-convai agent-id="agent_8601kfmaszkkepbv9nfwqm99814v"></elevenlabs-convai>
        </>
      )}
    </>
  );
}

export default App;
