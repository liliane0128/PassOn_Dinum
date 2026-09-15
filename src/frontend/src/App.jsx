import { Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ManagerPage } from "./pages/ManagerPage.jsx";
import { EmployeePage } from "./pages/EmployeePage.jsx";

function App() {
  const { restoring } = useAuth();

  // La session est rendue par un cookie serveur, connue seulement après un
  // aller-retour. Afficher les routes avant la réponse renverrait un
  // utilisateur déjà connecté vers l'écran de connexion à chaque
  // rafraîchissement de page.
  if (restoring) return null;

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/manager" element={<ManagerPage />} />
      <Route path="/moi" element={<EmployeePage />} />
    </Routes>
  );
}

export default App;
