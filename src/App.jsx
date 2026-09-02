// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import AccessDashboard from "./pages/AccessDashboard";

/** ✅ Maintenance Gate */
import MaintenanceGate from "./components/MaintenanceGate";

/** ✅ Admin Panel */
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminReports from "./pages/admin/AdminReports";
import AdminOps from "./pages/admin/AdminOps";
import AdminBilling from "./pages/admin/AdminBilling";

/** ✅ General Settings */
import Settings from "./pages/Settings";

/** ✅ Program 1 (Animal Health Protection) */
import Program1Layout from "./pages/program1/Program1Layout";
import P1Overview from "./pages/program1/P1Overview";
import P1Farmers from "./pages/program1/P1Farmers";                 // ✅ NEW: Farmer Registration component
import P1Registration from "./pages/program1/P1Registration";
import P1Services from "./pages/program1/P1Services";
import P1Inventory from "./pages/program1/P1Inventory";
import P1ColdChain from "./pages/program1/P1ColdChain";
import P1GIS from "./pages/program1/P1GIS";
import P1Reports from "./pages/program1/P1Reports";

/** ✅ Program 2 (Animal Breeding) */
import Program2Layout from "./pages/program2/Program2Layout";
import P2Overview from "./pages/program2/P2Overview";
import P2Estrus from "./pages/program2/P2Estrus";
import P2Insemination from "./pages/program2/P2Insemination";
import P2Pregnancy from "./pages/program2/P2Pregnancy";
import P2Performance from "./pages/program2/P2Performance";
import P2Reports from "./pages/program2/P2Reports";

/** ✅ Program 3 (Animal Health Care) */
import Program3Layout from "./pages/program3/Program3Layout";
import P3Overview from "./pages/program3/P3Overview";
import P3CaseReporting from "./pages/program3/P3CaseReporting";
import P3CaseMonitoring from "./pages/program3/P3CaseMonitoring";
import P3StatusTracking from "./pages/program3/P3StatusTracking";
import P3GISHotspots from "./pages/program3/P3GISHotspots";
import P3Reports from "./pages/program3/P3Reports";

export default function App() {
  return (
    <BrowserRouter>
      <MaintenanceGate>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />

          {/* Optional: /admin shortcut */}
          <Route path="/admin" element={<Navigate to="/admin/panel" replace />} />

          {/* Settings */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute
                allowRoles={["field_officer", "inventory_officer", "admin"]}
                requiredModule="dashboard"
              >
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Admin Panel */}
          <Route
            path="/admin/panel"
            element={
              <ProtectedRoute allowRoles={["admin"]} requiredModule="admin_panel">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="roles" element={<AdminRoles />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="ops" element={<AdminOps />} />
          </Route>

          {/* Shared dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                allowRoles={["field_officer", "inventory_officer", "admin"]}
                requiredModule="dashboard"
              >
                <AccessDashboard />
              </ProtectedRoute>
            }
          />

          {/* ✅ Program 1 */}
          <Route
            path="/program/animal-health-protection"
            element={
              <ProtectedRoute
                allowRoles={["field_officer", "inventory_officer", "admin"]}
                requiredModule="program1"
              >
                <Program1Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<P1Overview />} />
            <Route path="farmers" element={<P1Farmers />} />          {/* ✅ NEW: Farmer Registration route */}
            <Route path="registration" element={<P1Registration />} />
            <Route path="services" element={<P1Services />} />
            <Route path="inventory" element={<P1Inventory />} />
            <Route path="cold-chain" element={<P1ColdChain />} />
            <Route path="gis" element={<P1GIS />} />
            <Route path="reports" element={<P1Reports />} />
          </Route>

          {/* Program 2 */}
          <Route
            path="/program/animal-breeding"
            element={
              <ProtectedRoute
                allowRoles={["field_officer", "admin"]}
                requiredModule="program2"
              >
                <Program2Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<P2Overview />} />
            <Route path="estrus" element={<P2Estrus />} />
            <Route path="insemination" element={<P2Insemination />} />
            <Route path="pregnancy" element={<P2Pregnancy />} />
            <Route path="performance" element={<P2Performance />} />
            <Route path="reports" element={<P2Reports />} />
          </Route>

          {/* Program 3 */}
          <Route
            path="/program/animal-health-care"
            element={
              <ProtectedRoute
                allowRoles={["field_officer", "admin"]}
                requiredModule="program3"
              >
                <Program3Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<P3Overview />} />
            <Route path="case-reporting" element={<P3CaseReporting />} />
            <Route path="case-monitoring" element={<P3CaseMonitoring />} />
            <Route path="status-tracking" element={<P3StatusTracking />} />
            <Route path="gis-hotspots" element={<P3GISHotspots />} />
            <Route path="reports" element={<P3Reports />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MaintenanceGate>
    </BrowserRouter>
  );
}