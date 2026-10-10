import React from "react";
import { Link } from "react-router-dom";

const PublicIndustries = () => {
  return (
    <>
      <section className="page-head container">
        <p className="breadcrumb">
          <Link to="/">Home</Link> / Industries
        </p>
        <p className="eyebrow">Industries</p>
        <h1>Hospitality is our flagship. Our thinking travels further.</h1>
        <p className="lede">
          Hospitality remains our flagship capability while our consulting
          approach adapts across industries &mdash; because positioning,
          differentiation, and customer experience are universal problems, even
          where the details differ.
        </p>
      </section>

      {/* PRIMARY */}
      <section id="hospitality" className="section section--border-top">
        <div className="container">
          <p className="eyebrow">Primary</p>
          <div className="split">
            <div>
              <h2>Hospitality</h2>
              <p className="lede" style={{ maxWidth: "none" }}>
                Restaurants, cafés, hotels, and food &amp; beverage brands sit at
                the centre of everything we do. Hospitality is where guest
                experience and brand strategy are most visibly inseparable &mdash;
                every table, every service interaction, every return visit is a
                test of the positioning.
              </p>
            </div>
            <div className="grid grid--2">
              <div className="case-file reveal">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 3V10A2 2 0 0 0 9 12V21M7 3V8M9 3V8M7 8H9M17 3C15 4 15 8 17 10V21M17 3V21" />
                  </svg>
                </div>
                <h3>Restaurants</h3>
                <p>Positioning, menu-led storytelling, and service consistency across every seating.</p>
              </div>
              <div className="case-file reveal">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 8H16V15A5 5 0 0 1 11 20H10A5 5 0 0 1 5 15Z" />
                    <path d="M16 9H19A2 2 0 0 1 21 11V12A2 2 0 0 1 19 14H16" />
                  </svg>
                </div>
                <h3>Cafés</h3>
                <p>Neighbourhood identity, repeatable guest experience, and loyalty design.</p>
              </div>
              <div className="case-file reveal">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="9" />
                    <path d="M3 11V7A2 2 0 0 1 5 5H19A2 2 0 0 1 21 7V11" />
                    <path d="M7 11V8.5A1.5 1.5 0 0 1 8.5 7H10A1.5 1.5 0 0 1 11.5 8.5V11" />
                  </svg>
                </div>
                <h3>Hotels</h3>
                <p>Guest journey mapping and brand consistency across every touchpoint.</p>
              </div>
              <div className="case-file reveal">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3C7 5 7 6 8 8C9 10 9 11 8 13V21H12V13C11 11 11 10 12 8C13 6 13 5 12 3" />
                    <path d="M17 3V13A2.5 2.5 0 0 1 14.5 15.5V15.5" />
                    <path d="M17 3V9M20 3V9" />
                    <path d="M17 9V21" />
                  </svg>
                </div>
                <h3>Food &amp; Beverage</h3>
                <p>Category positioning and go-to-market for product-led F&amp;B brands.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECONDARY */}
      <section className="section section--raised section--border-top">
        <div className="container">
          <p className="eyebrow">Secondary</p>
          <h2 style={{ marginBottom: "2rem" }}>Where hospitality-grade thinking applies just as well.</h2>
          <div className="grid grid--4">
            <div className="case-file reveal">
              <h3>Fashion</h3>
              <p>Identity and positioning for brands built on taste and detail.</p>
            </div>
            <div className="case-file reveal">
              <h3>Consumer Brands</h3>
              <p>Category clarity in crowded, fast-moving shelves.</p>
            </div>
            <div className="case-file reveal">
              <h3>D2C</h3>
              <p>Growth strategy for brands built directly on customer relationships.</p>
            </div>
            <div className="case-file reveal">
              <h3>Retail</h3>
              <p>Experience design across physical and digital storefronts.</p>
            </div>
          </div>
          <div className="grid grid--4" style={{ marginTop: "1.6rem" }}>
            <div className="case-file reveal">
              <h3>Personal Brands</h3>
              <p>Founder positioning for individuals building a public reputation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* EXPANSION */}
      <section className="section section--border-top">
        <div className="container">
          <p className="eyebrow">Expansion</p>
          <h2 style={{ marginBottom: "2rem" }}>Cross-sector strategy engagements.</h2>
          <div className="grid grid--3">
            <div className="case-file reveal">
              <h3>Healthcare &amp; Wellness</h3>
              <p>Positioning high-trust clinical and wellness practices for discerning patients.</p>
            </div>
            <div className="case-file reveal">
              <h3>Manufacturing &amp; B2B</h3>
              <p>Elevating B2B suppliers from commoditised vendors into category partners.</p>
            </div>
            <div className="case-file reveal">
              <h3>Education &amp; Academies</h3>
              <p>Building institutional prestige and curriculum-led student acquisition engines.</p>
            </div>
            <div className="case-file reveal">
              <h3>Professional Services</h3>
              <p>Positioning law, architectural, and financial advisory practices for premium fees.</p>
            </div>
            <div className="case-file reveal">
              <h3>High-Growth SMEs</h3>
              <p>Re-architecting growth systems for owner-operated enterprises at inflection points.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section--border-top">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Ready to bring strategic clarity to your sector?</h2>
            <Link to="/contact" className="btn btn--solid">
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default PublicIndustries;
