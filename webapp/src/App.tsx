import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from './components/Layout/MainLayout'
import { AgentPage } from './pages/AgentPage'
import { ManagementPage } from './pages/ManagementPage'
import { DataExplorerPage } from './pages/DataExplorerPage'
import { SettingsPage } from './pages/SettingsPage'
import { TradingPage } from './pages/TradingPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/agent" replace />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="trading" element={<TradingPage />} />
        <Route path="data" element={<DataExplorerPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Route>
    </Routes>
  )
}

export default App
