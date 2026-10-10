import React from "react";
import { Link } from "react-router-dom";

const PublicFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h4>ESG Officials</h4>
            <p>
              A strategy and research-led consulting firm helping ambitious
              founders build category-leading brands. Research precedes
              recommendation. Strategy precedes execution.
            </p>
          </div>
          <div>
            <h4>Firm</h4>
            <ul className="footer-links">
              <li><Link to="/about">About</Link></li>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/industries">Industries</Link></li>
              <li><Link to="/research">Research &amp; Insights</Link></li>
              <li><Link to="/admin">Admin Portal</Link></li>
              <li><Link to="/login">Client Portal Login</Link></li>
            </ul>
          </div>
          <div>
            <h4>Work</h4>
            <ul className="footer-links">
              <li><Link to="/case-studies">Case Studies</Link></li>
              <li><Link to="/case-studies#cafe-mysa">Café Mysa</Link></li>
              <li><Link to="/case-studies#dishai">Dishai</Link></li>
              <li><Link to="/case-studies#biaana">Biaana</Link></li>
            </ul>
          </div>
          <div>
            <h4>Connect</h4>
            <ul className="footer-links">
              <li><Link to="/contact">Book a Consultation</Link></li>
              <li><a href="mailto:hello@esgofficials.com">hello@esgofficials.com</a></li>
              <li><span>esgofficials.com</span></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {currentYear} ESG Officials. All rights reserved.</span>
          <span>Brand Strategy &amp; Growth Consulting</span>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
