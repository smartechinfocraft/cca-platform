import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAdminAuth } from "../admin/context/AuthContext";
import { useCoachAuth } from "../coach/context/AuthContext";

// ── Public site pages ──────────────────────────────────────
import Home from "../pages/Home";
import Programs from "../pages/Programs";
import ProgramDetails from "../pages/ProgramDetails";
import AboutPage from "../pages/AboutPage";
import DonatePage from "../pages/DonatePage";
import MediaPage from "../pages/MediaPage";
import FAQPage from "../pages/FAQPage";
import ProgramSelection from "../pages/registration/ProgramSelection";
import StudentDetails from "../pages/registration/StudentDetails";
import ReviewOrder from "../pages/registration/ReviewOrder";
import PaymentPage from "../pages/registration/PaymentPage";
import SuccessPage from "../pages/registration/SuccessPage";
import LoginPage from "../pages/LoginPage";
import CartPage from "../pages/cart/CartPage";

// ── Parent dashboard ────────────────────────────────────────
import ParentLayout from "../layouts/ParentLayout";
import DashboardHome from "../pages/dashboard/DashboardHome";
import PurchaseHistory from "../pages/dashboard/PurchaseHistory";
import MyStudents from "../pages/dashboard/MyStudents";
import StudentDetail from "../pages/dashboard/StudentDetail";
import MessagesPage from "../pages/dashboard/MessagesPage";
import ProfilePage from "../pages/dashboard/ProfilePage";

// ── Admin portal ────────────────────────────────────────────
import AdminLayout from "../admin/components/layout/AdminLayout";
import AdminDashboard from "../admin/pages/Dashboard";
import AdminPrograms from "../admin/pages/Programs";
import AdminProgramForm from "../admin/pages/ProgramForm";   // ← NEW
import AdminCategories from "../admin/pages/Categories";
import AdminLocations from "../admin/pages/Locations";
import AdminCoaches from "../admin/pages/Coaches";
import AdminReports from "../admin/pages/Reports";
import AdminContent from "../admin/pages/Content";
import AdminCoupons from "../admin/pages/Coupons";
import AdminUsersPage from "../admin/pages/AdminUsers";
import AdminAgeGroups from "../admin/pages/AgeGroups";
import AdminLevels from "../admin/pages/Levels";
import AdminRegistrations from "../admin/pages/Registrations";
import AdminMessages from "../admin/pages/Messages";
import PaymentStudents from "../admin/pages/PaymentStudents";

// ── Coach portal ─────────────────────────────────────────────
import CoachLayout from "../coach/components/CoachLayout";
import CoachDashboard from "../coach/pages/Dashboard";
import CoachBatches from "../coach/pages/Batches";
import CoachBatchDetail from "../coach/pages/BatchDetail";
import CoachStudents from "../coach/pages/Students";
import CoachStudentDetail from "../coach/pages/StudentDetail";
import CoachScan from "../coach/pages/Scan";
import CoachMessages from "../coach/pages/Messages";
import CoachProfile from "../coach/pages/Profile";

// ── Parent: requires a logged-in parent, else -> /login ─────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1b0e]">
        <div className="text-[#F5D97A] text-lg">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  }
  return <>{children}</>;
}

// ── Admin: requires a logged-in admin/super-admin, else -> /login ──
function AdminProtectedRoute({ children, superOnly = false }: { children: React.ReactNode; superOnly?: boolean }) {
  const { user, loading, isSuperAdmin } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1b0e]">
        <div className="text-[#F5D97A] text-lg">Loading...</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  }
  if (superOnly && !isSuperAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}

// ── Coach: requires a logged-in coach, else -> /login ────────
function CoachProtectedRoute({ children }: { children: React.ReactNode }) {
  const { coach, loading } = useCoachAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1b0e", color: "#D4AF37" }}>
        Loading...
      </div>
    );
  }
  if (!coach) {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ───────────── Public site ───────────── */}
      <Route path="/" element={<Home />} />
      <Route path="/programs" element={<Programs />} />
      <Route path="/programs/:id" element={<ProgramDetails />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/donate" element={<DonatePage />} />
      <Route path="/media" element={<MediaPage />} />
      <Route path="/faq" element={<FAQPage />} />

      {/* One shared login for parent / coach / admin */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cart" element={<CartPage />} />

      {/* ───────────── Registration flow — guest or parent account ───────────── */}
      <Route path="/register-program/:id" element={<ProgramSelection />} />
      <Route path="/student-details" element={<StudentDetails />} />
      <Route path="/review-order" element={<ReviewOrder />} />
      <Route path="/payment" element={<PaymentPage />} />
      <Route path="/success" element={<SuccessPage />} />

      {/* ───────────── Parent dashboard ───────────── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ParentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="purchases" element={<PurchaseHistory />} />
        <Route path="students" element={<MyStudents />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* ───────────── Admin portal ───────────── */}
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />

        {/* Super-admin only */}
        <Route path="programs" element={<AdminProtectedRoute superOnly><AdminPrograms /></AdminProtectedRoute>} />
        {/* Program create / edit — full-page form (replaces old modal + Batches page) */}
        <Route path="programs/new" element={<AdminProtectedRoute superOnly><AdminProgramForm /></AdminProtectedRoute>} />
        <Route path="programs/:id/edit" element={<AdminProtectedRoute superOnly><AdminProgramForm /></AdminProtectedRoute>} />

        <Route path="categories" element={<AdminProtectedRoute superOnly><AdminCategories /></AdminProtectedRoute>} />
        <Route path="locations" element={<AdminProtectedRoute superOnly><AdminLocations /></AdminProtectedRoute>} />
        <Route path="age-groups" element={<AdminProtectedRoute superOnly><AdminAgeGroups /></AdminProtectedRoute>} />
        <Route path="levels" element={<AdminProtectedRoute superOnly><AdminLevels /></AdminProtectedRoute>} />
        <Route path="admin-users" element={<AdminProtectedRoute superOnly><AdminUsersPage /></AdminProtectedRoute>} />

        {/* Both admin roles */}
        <Route path="registrations" element={<AdminRegistrations />} />
        <Route path="payment-students" element={<PaymentStudents />} />
        <Route path="coaches" element={<AdminCoaches />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="messages" element={<AdminMessages />} />
      </Route>

      {/* ───────────── Coach portal ───────────── */}
      <Route
        path="/coach"
        element={
          <CoachProtectedRoute>
            <CoachLayout />
          </CoachProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/coach/dashboard" replace />} />
        <Route path="dashboard" element={<CoachDashboard />} />
        <Route path="batches" element={<CoachBatches />} />
        <Route path="batches/:batchId" element={<CoachBatchDetail />} />
        <Route path="students" element={<CoachStudents />} />
        <Route path="students/:studentId" element={<CoachStudentDetail />} />
        <Route path="scan" element={<CoachScan />} />
        <Route path="messages" element={<CoachMessages />} />
        <Route path="profile" element={<CoachProfile />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
