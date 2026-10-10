import React from "react";
import { Link } from "react-router-dom";

const PublicServices = () => {
  return (
    <>
      <section className="page-head container">
        <p className="breadcrumb">
          <Link to="/">Home</Link> / Services
        </p>
        <p className="eyebrow">Service Architecture</p>
        <h1>Four disciplines. One strategic system.</h1>
        <p className="lede">
          Marketing is an execution layer that amplifies strategy &mdash; not a
          substitute for it. Every engagement draws from four disciplines,
          sequenced through a single operating system.
        </p>
      </section>

      {/* BRAND STRATEGY */}
      <section id="brand-strategy" className="section section--border-top">
        <div className="container split">
          <div>
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="4.3" />
                <circle cx="12" cy="12" r="0.8" fill="currentColor" />
              </svg>
            </div>
            <p className="eyebrow">01 &mdash; Brand Strategy</p>
            <h2>The foundation everything else is built on.</h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: "none" }}>
              Positioning determines whether a business is remembered for the right
              reasons or overlooked entirely. We build that foundation through
              evidence, not opinion.
            </p>
            <ul className="pillar-list">
              <li>Positioning</li>
              <li>Messaging</li>
              <li>Identity direction</li>
              <li>Market &amp; consumer research</li>
              <li>Competitive analysis</li>
            </ul>
          </div>
        </div>
      </section>

      {/* GROWTH CONSULTING */}
      <section id="growth-consulting" className="section section--raised section--border-top">
        <div className="container split">
          <div>
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17 L10 11 L14 15 L20 6" />
                <path d="M14 6 L20 6 L20 12" />
              </svg>
            </div>
            <p className="eyebrow">02 &mdash; Growth Consulting</p>
            <h2>Strategy for the business, not just the brand.</h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: "none" }}>
              Growth is a strategic decision before it is a marketing campaign.
              We work on the business questions that determine whether growth is
              sustainable.
            </p>
            <ul className="pillar-list">
              <li>Business strategy</li>
              <li>Launch planning</li>
              <li>Expansion strategy</li>
              <li>Pricing</li>
              <li>Go-to-market</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CUSTOMER EXPERIENCE */}
      <section id="customer-experience" className="section section--border-top">
        <div className="container split">
          <div>
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 18 C8 18 8 6 12 6 S16 18 20 18" />
                <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
                <circle cx="12" cy="6" r="1.3" fill="currentColor" stroke="none" />
                <circle cx="20" cy="18" r="1.3" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <p className="eyebrow">03 &mdash; Customer Experience</p>
            <h2>Where positioning becomes something people feel.</h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: "none" }}>
              A brand is judged by its most inconsistent touchpoint. We design
              the systems that keep experience consistent as a business grows.
            </p>
            <ul className="pillar-list">
              <li>Journey mapping</li>
              <li>SOP design</li>
              <li>Hospitality experience</li>
              <li>Service consistency</li>
              <li>Loyalty design</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FOUNDER STRATEGY */}
      <section id="founder-strategy" className="section section--raised section--border-top">
        <div className="container split">
          <div>
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 3 L21 6 L9 18 L4 20 L6 15 Z" />
                <path d="M14 6 L18 10" />
              </svg>
            </div>
            <p className="eyebrow">04 &mdash; Founder Strategy</p>
            <h2>The founder's voice, deliberately structured.</h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: "none" }}>
              In modern markets, founders are often the primary credibility
              engine for their businesses. We turn that intuition into an
              authentic, scalable personal positioning.
            </p>
            <ul className="pillar-list">
              <li>Founder branding</li>
              <li>Authority building</li>
              <li>Executive communication</li>
              <li>Thought leadership</li>
              <li>Strategic clarity</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CONSULTING OPERATING SYSTEM (dark) */}
      <section className="section section--dark texture-dots">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">The Consulting Operating System</p>
            <h2>Eight sequential frameworks that move from research to return.</h2>
            <p className="lede" style={{ color: "var(--ash-light)" }}>
              Engagements are not bespoke improvisations &mdash; they are structured
              around a repeatable methodology that ensures nothing is missed.
            </p>
          </div>
          <ul className="framework-list">
            <li className="framework-row">
              <span className="num">01</span>
              <h3>ESG Discovery&trade;</h3>
              <p>
                In-depth qualitative and quantitative research into the current
                business, market dynamics, competitive set, and customer perceptions.
              </p>
            </li>
            <li className="framework-row">
              <span className="num">02</span>
              <h3>ESG Brand DNA&trade;</h3>
              <p>
                Defining positioning, value proposition, narrative architecture,
                and tonal standards drawn directly from the discovery findings.
              </p>
            </li>
            <li className="framework-row">
              <span className="num">03</span>
              <h3>ESG Experience Blueprint&trade;</h3>
              <p>
                Mapping the complete customer journey and designing service
                standards, touchpoint choreography, and standard operating procedures.
              </p>
            </li>
            <li className="framework-row">
              <span className="num">04</span>
              <h3>ESG Growth Engine&trade;</h3>
              <p>
                Developing go-to-market systems, pricing architectures, channel
                selection, and strategic initiatives to drive sustainable revenue.
              </p>
            </li>
            <li className="framework-row">
              <span className="num">05</span>
              <h3>ESG Launch Blueprint&trade;</h3>
              <p>
                Comprehensive launch sequencing for new locations, product lines,
                rebrands, or venture inaugurations.
              </p>
            </li>
            <li className="framework-row">
              <span className="num">06</span>
              <h3>ESG Scale Framework&trade;</h3>
              <p>
                Designing documentation, hiring rubrics, and operational systems
                that allow the brand to expand without dilution.
              </p>
            </li>
            <li className="framework-row">
              <span className="num">07</span>
              <h3>ESG Founder Influence&trade;</h3>
              <p>
                Structuring the founder’s narrative, keynotes, published viewpoints,
                and public profile to build enterprise authority.
              </p>
            </li>
            <li className="framework-row">
              <span className="num">08</span>
              <h3>ESG Performance Loop&trade;</h3>
              <p>
                Ongoing quarterly reviews, KPI calibration, and iterative refinement
                to protect and compound strategic advantages over time.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="section section--border-top">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Ready to discuss which framework fits your business?</h2>
            <Link to="/contact" className="btn btn--solid">
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default PublicServices;
