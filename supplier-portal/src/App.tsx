import { BrowserRouter, Route, Routes } from "react-router-dom";
import Confirmation from "./pages/Confirmation";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import InvalidLink from "./pages/InvalidLink";
import ResponseForm from "./pages/ResponseForm";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/confirmation" element={<Confirmation />} />
        <Route path="/invalid" element={<InvalidLink />} />
        <Route path="/:portalToken/respond/:inviteToken" element={<ResponseForm />} />
        <Route path="/:portalToken" element={<Dashboard />} />
        <Route path="*" element={<InvalidLink />} />
      </Routes>
    </BrowserRouter>
  );
}
