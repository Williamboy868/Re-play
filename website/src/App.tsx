import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { FaGithub } from "react-icons/fa";
import { HiDownload } from "react-icons/hi";
import Home from "./pages/Home";
import SupportedSites from "./pages/SupportedSites";
import "./App.css";

const REPO = "Williamboy868/Re-play";
const RELEASES_URL = `https://github.com/${REPO}/releases`;

function App() {
  return (
    <BrowserRouter>
      {/* ── Navbar ────────────────────────────── */}
      <nav className="navbar" id="navbar">
        <Link to="/" className="navbar-brand">
          <img
            src="/replay.png"
            alt="Re-play logo"
            className="navbar-logo"
          />
          <span className="navbar-title">Re-play</span>
        </Link>
        <div className="navbar-links">
          <Link to="/supported-sites" className="navbar-link" id="nav-sites">
            <span>Supported Sites</span>
          </Link>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-link"
            id="nav-releases"
          >
            <HiDownload />
            <span>Releases</span>
          </a>
          <a
            href={`https://github.com/${REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-link"
            id="nav-github"
          >
            <FaGithub />
            <span>GitHub</span>
          </a>
        </div>
      </nav>

      {/* ── Page Content ─────────────────────── */}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/supported-sites" element={<SupportedSites />} />
        </Routes>
      </main>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="footer" id="footer">
        <div className="footer-content">
          <div className="footer-left">
            <img src="/replay.png" alt="" className="footer-logo" />
            <span>
              © {new Date().getFullYear()} Re-play. Open source under MIT.
            </span>
          </div>
          <div className="footer-links">
            <Link to="/supported-sites" id="footer-sites">
              Supported Sites
            </Link>
            <a
              href={`https://github.com/${REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              id="footer-github"
            >
              <FaGithub /> GitHub
            </a>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              id="footer-releases"
            >
              <HiDownload /> Releases
            </a>
          </div>
        </div>
      </footer>
    </BrowserRouter>
  );
}

export default App;
