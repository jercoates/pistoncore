import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import PistonListPage from './pages/PistonListPage'
import PistonEditorPage from './pages/PistonEditorPage'
import GlobalsPage from './pages/GlobalsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/pistons" replace />} />
        <Route path="pistons" element={<PistonListPage />} />
        <Route path="pistons/new" element={<PistonEditorPage />} />
        <Route path="pistons/:id" element={<PistonEditorPage />} />
        <Route path="globals" element={<GlobalsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
