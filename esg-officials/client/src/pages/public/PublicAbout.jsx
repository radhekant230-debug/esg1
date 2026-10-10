import React from "react";
import { Link } from "react-router-dom";

const PublicAbout = () => {
  return (
    <>
      <section className="page-head container">
        <p className="breadcrumb">
          <Link to="/">Home</Link> / About
        </p>
        <p className="eyebrow">About ESG Officials</p>
        <h1>We begin with understanding, not marketing.</h1>
        <p className="lede">
          To help founders build businesses that people trust, remember, and
          choose &mdash; by replacing guesswork with strategic clarity.
        </p>
      </section>

      {/* PURPOSE / VISION / MISSION */}
      <section className="section">
        <div className="container grid grid--3">
          <div className="reveal">
            <p className="eyebrow">Purpose</p>
            <p>
              To help founders build businesses that people trust, remember, and
              choose &mdash; by replacing guesswork with strategic clarity.
            </p>
          </div>
          <div className="reveal">
            <p className="eyebrow">Vision</p>
            <p>
              To become one of the world's most respected independent strategy and
              brand consulting firms &mdash; recognised for practical thinking,
              original research, and measurable business transformation.
            </p>
          </div>
          <div className="reveal">
            <p className="eyebrow">Mission</p>
            <p>
              Partner with ambitious businesses to design strategies that
              strengthen brands, improve customer experiences, and create
              sustainable growth.
            </p>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section className="section section--raised section--border-top">
        <div className="container split">
          <div>
            <p className="eyebrow">Brand Philosophy</p>
            <h2 className="pull-quote">
              Great brands are not manufactured through campaigns. They are built
              through thousands of intentional decisions.
            </h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: "none" }}>
              Every recommendation should make a business clearer, stronger, and
              more resilient. That standard applies whether we're refining a
              single sentence of positioning or redesigning an entire customer
              journey.
            </p>
            <p className="eyebrow" style={{ marginTop: "2rem" }}>Brand Promise</p>
            <ul className="pillar-list">
              <li>Greater clarity</li>
              <li>Stronger positioning</li>
              <li>Better decisions</li>
              <li>Improved customer experiences</li>
              <li>Scalable systems</li>
              <li>Measurable business outcomes</li>
            </ul>
          </div>
        </div>
      </section>

      {/* DIFFERENTIATOR */}
      <section className="section section--border-top">
        <div className="container">
          <div className="section-head center" style={{ marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>Strategic Differentiator</p>
            <h2>Most agencies begin with marketing. We begin with understanding.</h2>
          </div>
          <div className="grid grid--3">
            <div className="case-file reveal">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="10" cy="10" r="6" />
                  <path d="M20.5 20.5 L15 15" />
                </svg>
              </div>
              <div className="case-file-meta"><span className="num">01</span></div>
              <h3>Research precedes recommendations</h3>
              <p>We study the market, the customer, and the business before we propose anything.</p>
            </div>
            <div className="case-file reveal">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12H20M14 6L20 12L14 18" />
                </svg>
              </div>
              <div className="case-file-meta"><span className="num">02</span></div>
              <h3>Strategy precedes execution</h3>
              <p>Positioning and systems are locked before marketing begins.</p>
            </div>
            <div className="case-file reveal">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <div className="case-file-meta"><span className="num">03</span></div>
              <h3>Measurement follows implementation</h3>
              <p>We build feedback loops so you know whether the strategy is working.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DECISION FILTER */}
      <section className="section section--raised section--border-top">
        <div className="container split">
          <div>
            <p className="eyebrow">Decision Filter</p>
            <h2>The standard behind every recommendation we make.</h2>
            <p className="lede">Before any proposal leaves our desk, it has to answer six questions.</p>
          </div>
          <div>
            <ol className="filter-list">
              <li>Does this make the business clearer?</li>
              <li>Does this strengthen the brand's positioning?</li>
              <li>Does this lead to better business decisions?</li>
              <li>Does this improve the customer experience?</li>
              <li>Does this create scalable operational systems?</li>
              <li>Does this generate measurable business outcomes?</li>
            </ol>
          </div>
        </div>
      </section>

      {/* STAND FOR / STAND AGAINST */}
      <section className="section section--border-top">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Principles</p>
            <h2>Clear lines make better partnerships.</h2>
          </div>
          <div className="compare reveal">
            <div className="yes">
              <h4>What We Stand For</h4>
              <ul>
                <li>Deep research before action</li>
                <li>Long-term strategic thinking</li>
                <li>Founder-level collaboration</li>
                <li>Operational discipline</li>
                <li>Restrained, deliberate branding</li>
                <li>Accountability to business metrics</li>
              </ul>
            </div>
            <div className="no">
              <h4>What We Stand Against</h4>
              <ul>
                <li>Trend-chasing and tactical shortcuts</li>
                <li>Vanity metrics divorced from revenue</li>
                <li>Superficial design without strategy</li>
                <li>Marketing used as a bandage for product flaws</li>
                <li>Cookie-cutter agency playbooks</li>
                <li>Work that cannot be sustained by the client</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section--border-top">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Ready to work with a partner who begins with understanding?</h2>
            <Link to="/contact" className="btn btn--solid">
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default PublicAbout;
