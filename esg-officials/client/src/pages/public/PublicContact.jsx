import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/axios";

const PublicContact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    industry: "Hospitality",
    message: "",
  });

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setStatus("Please fill in your name, email, and message.");
      return;
    }

    setLoading(true);
    setStatus("Sending…");

    try {
      const response = await api.post("/contact", formData);
      setStatus(response.data?.message || "Thank you — we will be in touch soon.");
      setFormData({
        name: "",
        email: "",
        company: "",
        industry: "Hospitality",
        message: "",
      });
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong. Please check your connection and try again.";
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqItems = [
    {
      q: "What's the difference between ESG Officials and a marketing agency?",
      a: "Agencies typically begin with execution — ads, content, campaigns. We begin with research and strategy, and treat marketing as the layer that amplifies a strategy already in place, not a substitute for one.",
    },
    {
      q: "Do you handle execution, like social media or ad campaigns?",
      a: "No. We design the strategy — positioning, experience, growth systems — and your team or a vetted execution partner carries it out. We're glad to help you brief that partner clearly.",
    },
    {
      q: "Do you only work with hospitality businesses?",
      a: "Hospitality is our flagship capability, but our consulting approach adapts across fashion, consumer brands, D2C, retail, personal brands, and a growing set of other industries.",
    },
    {
      q: "What does an engagement typically involve?",
      a: "Most engagements begin with ESG Discovery™, our research phase, before moving into the relevant frameworks in our Consulting Operating System — from Brand DNA™ through to Performance Loop™.",
    },
    {
      q: "Do you work with early-stage founders, or only established businesses?",
      a: "We work best with founders and leadership teams who are growth-oriented, open to strategic change, and willing to invest in transformation — regardless of company size.",
    },
    {
      q: "How do we get started?",
      a: "Send us a note using the form above. We'll set up a short call to understand your business and recommend a starting point.",
    },
  ];

  return (
    <>
      <section className="page-head container">
        <p className="breadcrumb">
          <Link to="/">Home</Link> / Contact
        </p>
        <p className="eyebrow">Get In Touch</p>
        <h1>Let's start with understanding your business.</h1>
        <p className="lede">
          Tell us where things stand today. We'll follow up to discuss whether
          &mdash; and how &mdash; we're the right partner.
        </p>
      </section>

      <section className="section section--border-top">
        <div className="container contact-grid">
          <div>
            <form id="consultation-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="company">Business name</label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label htmlFor="industry">Industry</label>
                  <select
                    id="industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                  >
                    <option>Hospitality</option>
                    <option>Fashion / Consumer Brands</option>
                    <option>D2C / Retail</option>
                    <option>Personal Brand</option>
                    <option>Healthcare / Education / Professional Services</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="message">What are you looking to solve?</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="A little context on the business and the problem you're facing."
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn--solid"
                disabled={loading}
              >
                {loading ? "Sending…" : "Send Enquiry"}
              </button>
              {status && (
                <p className="form-status" role="status">
                  {status}
                </p>
              )}
            </form>
          </div>

          <div>
            <div className="contact-info-item icon-row">
              <div className="icon icon--sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="1.5" />
                  <path d="M3 6.5L12 13L21 6.5" />
                </svg>
              </div>
              <div>
                <h4>Email</h4>
                <p className="mb-0">
                  <a href="mailto:hello@esgofficials.com" style={{ borderBottom: "1px solid var(--brass)" }}>
                    hello@esgofficials.com
                  </a>
                </p>
              </div>
            </div>
            <div className="contact-info-item icon-row">
              <div className="icon icon--sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21S5 14.5 5 10A7 7 0 0 1 19 10C19 14.5 12 21 12 21Z" />
                  <circle cx="12" cy="10" r="2.4" />
                </svg>
              </div>
              <div>
                <h4>Where We Work</h4>
                <p className="mb-0">Remote-first, with engagements across India and internationally. Consultations are by appointment.</p>
              </div>
            </div>
            <div className="contact-info-item icon-row">
              <div className="icon icon--sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12H20M14 6L20 12L14 18" />
                </svg>
              </div>
              <div>
                <h4>What Happens Next</h4>
                <p className="mb-0">A short call to understand your business, followed by a proposed starting point &mdash; usually ESG Discovery&trade;.</p>
              </div>
            </div>
            <div className="contact-info-item icon-row" style={{ borderBottom: "none" }}>
              <div className="icon icon--sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7V12L15.5 14" />
                </svg>
              </div>
              <div>
                <h4>Response Time</h4>
                <p className="mb-0">We reply to every enquiry personally, typically within two business days.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section--raised section--border-top">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Questions Answered</p>
            <h2>Before you reach out.</h2>
          </div>
          <div className="faq-list" style={{ maxWidth: "70ch" }}>
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className={`faq-item ${isOpen ? "is-open" : ""}`}>
                  <button
                    className="faq-q"
                    onClick={() => toggleFaq(idx)}
                    type="button"
                  >
                    <span>{item.q}</span>
                    <span className="plus">+</span>
                  </button>
                  <div
                    className="faq-a"
                    style={{
                      maxHeight: isOpen ? "400px" : "0px",
                      overflow: "hidden",
                      transition: "max-height 0.35s ease",
                    }}
                  >
                    <p>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};

export default PublicContact;
