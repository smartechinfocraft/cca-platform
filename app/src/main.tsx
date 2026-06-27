import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { RegistrationProvider } from "./context/RegistrationContext";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./admin/context/AuthContext";
import { CoachAuthProvider } from "./coach/context/AuthContext";
import "./index.css";

// All three auth contexts (parent / admin / coach) coexist side by side.
// Each uses its own localStorage key (cca_parent_token / cca_token /
// cca_coach_token) so logging in as one role never clears another —
// this is what makes "one app, three portals" actually work.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Toaster
      position="top-right"
      toastOptions={{
        style: { background: "#1F2E1E", color: "#F5F1E6", border: "1px solid #C9A227" },
        success: { iconTheme: { primary: "#3F7D4F", secondary: "#fff" } },
        error: { iconTheme: { primary: "#B3402A", secondary: "#fff" } },
      }}
    />
    <AuthProvider>
      <AdminAuthProvider>
        <CoachAuthProvider>
          <RegistrationProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </RegistrationProvider>
        </CoachAuthProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </BrowserRouter>
);