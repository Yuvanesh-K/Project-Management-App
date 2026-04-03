import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import TaskBoard from './components/TaskBoard';
import MyTasks from './components/MyTasks';
import Reports from './components/Reports';
import Collaborations from './components/Collaborations';
import UserManagement from './components/UserManagement';
import OrganizationSettings from './components/OrganizationSettings';
import AcceptInvite from './components/AcceptInvite';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:projectId/*" element={<ProjectDetail />} />
            <Route path="/tasks" element={<TaskBoard />} />
            <Route path="/my-tasks" element={<MyTasks />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/collaborations" element={<Collaborations />} />
            <Route path="/team" element={<UserManagement />} />
            <Route path="/settings" element={<OrganizationSettings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
