import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage.jsx";
import { UserPage } from "./pages/UserPage.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/utilisateur/:slug" element={<UserPage />} />
    </Routes>
  );
}

export default App;
