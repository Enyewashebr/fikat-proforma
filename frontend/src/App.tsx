import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Proformas from "./pages/Proformas";
import NewProforma from "./pages/NewProforma";
import Customers from "./pages/Customers";
import Materials from "./pages/Materials";

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-quarry-500">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/proformas" element={<Proformas />} />
        <Route path="/proformas/new" element={<NewProforma />} />
        <Route path="/proformas/:id" element={<NewProforma />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/materials" element={<Materials />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}
