import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { DownloadCloud, History, Settings } from "lucide-react";
import { Home } from "./pages/Home";
import { History as HistoryPage } from "./pages/History";
import { Settings as SettingsPage } from "./pages/Settings";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="logo-wrapper">
              <img src="/replay.png" alt="Re-play logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4 }} />
              <h2>Re-play</h2>
            </div>
          </div>
          
          <nav className="sidebar-nav">
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <DownloadCloud size={20} />
              <span>Downloads</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <History size={20} />
              <span>History</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Settings size={20} />
              <span>Settings</span>
            </NavLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
