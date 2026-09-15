import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ManagerPage } from "./pages/ManagerPage.jsx";
import { EmployeePage } from "./pages/EmployeePage.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/manager" element={<ManagerPage />} />
      <Route path="/moi" element={<EmployeePage />} />
    </Routes>
  );
}

export default App;
