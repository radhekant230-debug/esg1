import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const PublicHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

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
          <Link to="/login" className="nav-login">
            Client Login
          </Link>
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
