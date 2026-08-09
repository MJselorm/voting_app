import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
        UniVote
      </div>
      <ul className="footer-nav">
        <li><Link to="/about">About</Link></li>
        <li><Link to="/how-it-works">How It Works</Link></li>
        <li><Link to="/elections">Elections</Link></li>
        <li><Link to="/help">Help</Link></li>
        <li><Link to="/privacy">Privacy</Link></li>
        <li><Link to="/terms">Terms</Link></li>
      </ul>
      <p className="footer-copyright">
        © 2024 UniVote. Institutional Trust & Democracy.
      </p>
    </footer>
  );
}
