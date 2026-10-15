import React, { useState, useEffect, useRef, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import {
  FaChevronDown,
  FaUserTie,
  FaBuilding,
  FaShieldAlt,
  FaTachometerAlt,
  FaSignOutAlt,
} from "react-icons/fa";

const PublicHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isManager, isClient } = useContext(AuthContext);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setLoginOpen(false);
  }, [location.pathname]);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setLoginOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setLoginOpen(false);
      }
    };

    if (loginOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [loginOpen]);

  const isActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const getDashboardPath = () => {
    if (isAdmin) return "/admin/dashboard";
    if (isManager) return "/manager/dashboard";
    if (isClient) return "/client/dashboard";
    return "/client/login";
  };

  const handleLogout = () => {
    setLoginOpen(false);
    logout();
    navigate("/");
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

          {/* Mobile-only Portal Login Group */}
          <li className="mobile-nav-portal-group">
            <div className="mobile-nav-portal-label">PORTAL LOGIN</div>
            <div className="mobile-nav-portal-links">
              <Link
                to="/manager/login"
                className="mobile-nav-portal-item mobile-nav-portal-item--manager"
                onClick={() => setMenuOpen(false)}
              >
                <div className="mobile-nav-portal-icon">
                  <FaUserTie />
                </div>
                <span>Manager Login</span>
              </Link>
              <Link
                to="/client/login"
                className="mobile-nav-portal-item mobile-nav-portal-item--client"
                onClick={() => setMenuOpen(false)}
              >
                <div className="mobile-nav-portal-icon">
                  <FaBuilding />
                </div>
                <span>Client Login</span>
              </Link>
              <Link
                to="/admin/login"
                className="mobile-nav-portal-item mobile-nav-portal-item--admin"
                onClick={() => setMenuOpen(false)}
              >
                <div className="mobile-nav-portal-icon">
                  <FaShieldAlt />
                </div>
                <span>Admin Login</span>
              </Link>
            </div>
          </li>
        </ul>

        <div className="nav-cta">
          {/* Single Unified LOGIN Button & Dropdown */}
          <div className="nav-login-wrapper" ref={dropdownRef}>
            <button
              type="button"
              id="navbar-login-btn"
              className={`nav-login-btn ${loginOpen ? "is-open" : ""}`}
              onClick={() => setLoginOpen((prev) => !prev)}
              aria-expanded={loginOpen}
              aria-haspopup="true"
              aria-label="Toggle login portals menu"
            >
              <span>
                {user
                  ? isAdmin
                    ? "Admin Portal"
                    : isManager
                    ? "Manager Portal"
                    : "Client Portal"
                  : "Login"}
              </span>
              <FaChevronDown
                className={`nav-login-arrow ${loginOpen ? "is-open" : ""}`}
                aria-hidden="true"
              />
            </button>

            {loginOpen && (
              <div
                className="nav-login-dropdown"
                role="menu"
                aria-labelledby="navbar-login-btn"
              >
                <div className="nav-login-dropdown-header">
                  <span className="nav-login-dropdown-label">Select Portal</span>
                  <span className="nav-login-dropdown-tag">Secure Access</span>
                </div>

                <div className="nav-login-dropdown-options">
                  {user && (
                    <>
                      <Link
                        to={getDashboardPath()}
                        className="nav-login-option nav-login-option--active-dashboard"
                        onClick={() => setLoginOpen(false)}
                        role="menuitem"
                      >
                        <div className="nav-login-option-icon">
                          <FaTachometerAlt />
                        </div>
                        <div className="nav-login-option-content">
                          <div className="nav-login-option-title">
                            <span>Open Dashboard</span>
                            <span className="nav-login-option-arrow">→</span>
                          </div>
                          <span className="nav-login-option-desc">
                            Logged in as {user.name || user.role}
                          </span>
                        </div>
                      </Link>
                      <div className="nav-login-dropdown-divider" />
                    </>
                  )}

                  {/* 1. Manager Login */}
                  <Link
                    to="/manager/login"
                    className="nav-login-option nav-login-option--manager"
                    onClick={() => setLoginOpen(false)}
                    role="menuitem"
                  >
                    <div className="nav-login-option-icon">
                      <FaUserTie />
                    </div>
                    <div className="nav-login-option-content">
                      <div className="nav-login-option-title">
                        <span>Manager Login</span>
                        <span className="nav-login-option-arrow">→</span>
                      </div>
                      <span className="nav-login-option-desc">
                        Account &amp; growth management
                      </span>
                    </div>
                  </Link>

                  {/* 2. Client Login */}
                  <Link
                    to="/client/login"
                    className="nav-login-option nav-login-option--client"
                    onClick={() => setLoginOpen(false)}
                    role="menuitem"
                  >
                    <div className="nav-login-option-icon">
                      <FaBuilding />
                    </div>
                    <div className="nav-login-option-content">
                      <div className="nav-login-option-title">
                        <span>Client Login</span>
                        <span className="nav-login-option-arrow">→</span>
                      </div>
                      <span className="nav-login-option-desc">
                        Brand performance &amp; analytics
                      </span>
                    </div>
                  </Link>

                  {/* 3. Admin Login */}
                  <Link
                    to="/admin/login"
                    className="nav-login-option nav-login-option--admin"
                    onClick={() => setLoginOpen(false)}
                    role="menuitem"
                  >
                    <div className="nav-login-option-icon">
                      <FaShieldAlt />
                    </div>
                    <div className="nav-login-option-content">
                      <div className="nav-login-option-title">
                        <span>Admin Login</span>
                        <span className="nav-login-option-arrow">→</span>
                      </div>
                      <span className="nav-login-option-desc">
                        Executive controls &amp; governance
                      </span>
                    </div>
                  </Link>

                  {user && (
                    <>
                      <div className="nav-login-dropdown-divider" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="nav-login-option nav-login-option--logout"
                        role="menuitem"
                      >
                        <div className="nav-login-option-icon">
                          <FaSignOutAlt />
                        </div>
                        <div className="nav-login-option-content">
                          <div className="nav-login-option-title">
                            <span>Sign Out</span>
                          </div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

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
