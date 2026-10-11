import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

const PublicHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, isAdmin, isManager, isClient } = useContext(AuthContext);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="site-header">
      <nav className="nav">
        <Link to="/" className="brand" aria-label="ESG Officials Home">
          <svg
            className="logomark"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="3.5" y="3.5" width="17" height="17" rx="1" fill="none" strokeWidth="1.2" />
            <path d="M12 4 L12 20 M4 12 L20 12" strokeWidth="0.9" />
            <circle cx="12" cy="12" r="3.2" fill="none" strokeWidth="1.2" />
          </svg>
          ESG <span>OFFICIALS</span>
        </Link>

        <ul className={`nav-links ${menuOpen ? "is-open" : ""}`}>
          <li>
            <Link
              to="/"
              aria-current={isActive("/") ? "page" : undefined}
              className={isActive("/") ? "active" : ""}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              aria-current={isActive("/about") ? "page" : undefined}
              className={isActive("/about") ? "active" : ""}
            >
              About
            </Link>
          </li>
          <li>
            <Link
              to="/services"
              aria-current={isActive("/services") ? "page" : undefined}
              className={isActive("/services") ? "active" : ""}
            >
              Services
            </Link>
          </li>
          <li>
            <Link
              to="/industries"
              aria-current={isActive("/industries") ? "page" : undefined}
              className={isActive("/industries") ? "active" : ""}
            >
              Industries
            </Link>
          </li>
          <li>
            <Link
              to="/case-studies"
              aria-current={isActive("/case-studies") ? "page" : undefined}
              className={isActive("/case-studies") ? "active" : ""}
            >
              Case Studies
            </Link>
          </li>
          <li>
            <Link
              to="/research"
              aria-current={isActive("/research") ? "page" : undefined}
              className={isActive("/research") ? "active" : ""}
            >
              Research
            </Link>
          </li>
          <li>
            <Link
              to="/contact"
              aria-current={isActive("/contact") ? "page" : undefined}
              className={isActive("/contact") ? "active" : ""}
            >
              Contact
            </Link>
          </li>
        </ul>

        <div className="nav-cta">
          {user ? (
            <Link
              to={isAdmin ? "/admin/dashboard" : isManager ? "/manager/dashboard" : "/client/dashboard"}
              className="nav-login"
              style={isAdmin ? { color: "#8B6E3F", fontWeight: 700 } : {}}
              title={isAdmin ? "Open ESG Admin Dashboard" : isManager ? "Open Manager Dashboard" : "Open Client Portal"}
            >
              {isAdmin ? "Admin Portal" : isManager ? "Manager Portal" : "Client Portal"}
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/client/login" className="nav-login" title="Client Portal Sign In">
                Client Login
              </Link>
              <Link
                to="/manager/login"
                className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold border border-purple-300 text-purple-700 hover:bg-purple-50 transition"
                title="Manager Portal Login"
              >
                Manager
              </Link>
              <Link
                to="/admin/login"
                className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-bold border border-[#C5A880]/60 text-[#8B6E3F] hover:bg-[#C5A880]/15 hover:border-[#8B6E3F] transition shadow-xs"
                title="ESG Admin Portal Login"
              >
                Admin
              </Link>
            </div>
          )}
          <button
            className={`nav-toggle ${menuOpen ? "is-active" : ""}`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            type="button"
          >
            <span />
          </button>
          <Link to="/contact" className="btn btn--solid">
            <span className="btn-label-long">Book a </span>Consultation
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default PublicHeader;
