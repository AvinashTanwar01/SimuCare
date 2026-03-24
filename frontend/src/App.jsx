import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/AuthContext";
import History from "./pages/History";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import PredictForm from "./pages/PredictForm";
import Profile from "./pages/Profile";
import Results from "./pages/Results";
import Signup from "./pages/Signup";

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="center-state">Checking authentication...</div>;
  return currentUser ? children : <Navigate to="/login" />;
}

export default function App() {
  const { currentUser } = useAuth();

  return (
    <div>
      <Navbar user={currentUser} />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/predict"
            element={
              <PrivateRoute>
                <PredictForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/results"
            element={
              <PrivateRoute>
                <Results />
              </PrivateRoute>
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <History />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
