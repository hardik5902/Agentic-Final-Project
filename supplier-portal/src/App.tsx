import { BrowserRouter, Route, Routes } from "react-router-dom";
import Confirmation from "./pages/Confirmation";
import InvalidLink from "./pages/InvalidLink";
import ResponseForm from "./pages/ResponseForm";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:token" element={<ResponseForm />} />
        <Route path="/confirmation" element={<Confirmation />} />
        <Route path="/invalid" element={<InvalidLink />} />
        <Route path="*" element={<InvalidLink />} />
      </Routes>
    </BrowserRouter>
  );
}
