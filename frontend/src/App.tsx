import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Conversations from './pages/Conversations';
import Calendar from './pages/Calendar';
import Workflows from './pages/Workflows';
import Reports from './pages/Reports';
import Layout from './components/Layout';

function App() {
  const { token } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
        <Route
          path="/"
          element={token ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
