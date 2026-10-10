import React from "react";
import { Link } from "react-router-dom";

const PublicResearch = () => {
  return (
    <>
      <section className="page-head container">
        <p className="breadcrumb">
          <Link to="/">Home</Link> / Research &amp; Insights
        </p>
        <p className="eyebrow">Research &amp; Insights</p>
        <h1>Research is not a marketing activity. It is a business capability.</h1>
        <p className="lede">
          Publishing original thinking strengthens long-term credibility &mdash;
          for our clients, and for the firm. This is where that thinking lives.
        </p>
      </section>

      {/* CONTENT PILLARS */}
      <section className="section section--border-top">
        <div className="container">
          <p className="eyebrow">Content Pillars</p>
          <div className="grid grid--4">
            <div className="pillar-chip reveal">Strategy</div>
            <div className="pillar-chip reveal">Branding</div>
            <div className="pillar-chip reveal">Hospitality</div>
            <div className="pillar-chip reveal">Customer Experience</div>
          </div>
          <div className="grid grid--3" style={{ marginTop: "1.6rem" }}>
            <div className="pillar-chip reveal">Founder Growth</div>
            <div className="pillar-chip reveal">Research</div>
            <div className="pillar-chip reveal">Business Transformation</div>
          </div>
        </div>
      </section>

      {/* FORMATS */}
      <section className="section section--raised section--border-top">
        <div className="container split">
          <div>
            <p className="eyebrow">What We Publish</p>
            <h2>Formats built for decision-makers, not feeds.</h2>
          </div>
          <div>
            <ul className="pillar-list">
              <li>White papers</li>
              <li>Industry reports</li>
              <li>Consumer studies</li>
              <li>Hospitality insights</li>
              <li>Strategic frameworks</li>
              <li>Founder perspectives</li>
            </ul>
          </div>
        </div>
      </section>

      {/* EDITORIAL CALENDAR */}
      <section className="section section--border-top">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">On the Editorial Calendar</p>
            <h2>Original research currently in development.</h2>
          </div>

          <div className="article-card reveal">
            <span className="tag">Hospitality</span>
            <h3>What Guests Actually Remember: A Study of Repeat Visitation in Independent Cafés</h3>
            <span className="status">In Research</span>
          </div>
          <div className="article-card reveal">
            <span className="tag">Strategy</span>
            <h3>The Positioning Audit: A Practical Framework for Founders</h3>
            <span className="status">In Development</span>
          </div>
          <div className="article-card reveal">
            <span className="tag">Customer Experience</span>
            <h3>Where Brands Break: Mapping the Moments That Undo an Experience</h3>
            <span className="status">In Research</span>
          </div>
          <div className="article-card reveal">
            <span className="tag">Founder Growth</span>
            <h3>The Founder as First Asset: Building Authority Before You Need It</h3>
            <span className="status">In Development</span>
          </div>
          <div className="article-card reveal">
            <span className="tag">Business Transformation</span>
            <h3>Scaling Without Diluting: Operational Systems for Growing Brands</h3>
            <span className="status">Upcoming</span>
          </div>

          <p className="text-ash" style={{ marginTop: "2.2rem", maxWidth: "60ch" }}>
            Interested in a specific piece, or in collaborating on original
            research relevant to your industry? Let us know when you get in touch.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="section section--raised section--border-top">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Have a question our research should answer?</h2>
            <Link to="/contact" className="btn btn--solid">
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default PublicResearch;
