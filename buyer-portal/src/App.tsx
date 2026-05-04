import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { isLoggedIn } from "./lib/auth";
import Analysis from "./pages/Analysis";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Memo from "./pages/Memo";
import NewRFQ from "./pages/NewRFQ";
import Register from "./pages/Register";
import RFQDetail from "./pages/RFQDetail";
import Suppliers from "./pages/Suppliers";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/rfq/new"
          element={
            <PrivateRoute>
              <NewRFQ />
            </PrivateRoute>
          }
        />
        <Route
          path="/rfq/:id"
          element={
            <PrivateRoute>
              <RFQDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/rfq/:id/analysis"
          element={
            <PrivateRoute>
              <Analysis />
            </PrivateRoute>
          }
        />
        <Route
          path="/rfq/:id/memo"
          element={
            <PrivateRoute>
              <Memo />
            </PrivateRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <PrivateRoute>
              <Suppliers />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
