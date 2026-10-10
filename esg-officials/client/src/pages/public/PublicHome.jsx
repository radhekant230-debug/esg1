import React from "react";
import { Link } from "react-router-dom";

const PublicHome = () => {
  return (
    <>
      {/* HERO */}
      <section className="container hero">
        <div className="hero-motif" aria-hidden="true">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="88" fill="none" style={{ stroke: "var(--line)" }} strokeWidth="1" />
            <circle cx="100" cy="100" r="62" fill="none" style={{ stroke: "var(--line)" }} strokeWidth="1" />
            <circle cx="100" cy="100" r="36" fill="none" style={{ stroke: "var(--brass)" }} strokeWidth="1.3" />
            <circle cx="100" cy="100" r="3" style={{ fill: "var(--brass)" }} />
            <path
              d="M100 6 L100 22 M194 100 L178 100 M100 194 L100 178 M6 100 L22 100"
              style={{ stroke: "var(--brass)" }}
              strokeWidth="1.3"
            />
          </svg>
        </div>
        <div>
          <p className="eyebrow">Brand Strategy &amp; Growth Consulting</p>
          <h1>Strategy first.<br />Marketing second.</h1>
          <p className="lede">
            Most businesses don't suffer from a marketing problem. They suffer
            from unclear positioning, fragmented execution, and insufficient
            customer understanding. We help ambitious founders replace guesswork
            with strategic clarity.
          </p>
          <div className="hero-actions">
            <Link to="/contact" className="btn btn--solid">
              Book a Consultation
            </Link>
            <Link to="/about" className="btn">
              Our Approach
            </Link>
          </div>
        </div>
        <div className="panel">
          <p className="eyebrow" style={{ marginBottom: "1.3rem" }}>
            The Consulting Operating System
          </p>
          <div className="panel-row">
            <span className="num">01</span>
            <div>
              <strong>ESG Discovery&trade;</strong>
              <span>Understanding the business as it stands today</span>
            </div>
          </div>
          <div className="panel-row">
            <span className="num">02</span>
            <div>
              <strong>ESG Brand DNA&trade;</strong>
              <span>Positioning and narrative foundations</span>
            </div>
          </div>
          <div className="panel-row">
            <span className="num">03</span>
            <div>
              <strong>ESG Experience Blueprint&trade;</strong>
              <span>Journey mapping and service design</span>
            </div>
          </div>
          <div className="panel-row">
            <span className="num">04</span>
            <div>
              <strong>ESG Growth Engine&trade;</strong>
              <span>Business strategy and go-to-market</span>
            </div>
          </div>
          <div className="panel-row">
            <span className="num">&middot;&middot;&middot;</span>
            <div>
              <strong>+ 4 more frameworks</strong>
              <span>
                <Link
                  to="/services"
                  style={{
                    color: "var(--brass-deep)",
                    borderBottom: "1px solid var(--brass)",
                  }}
                >
                  See the full system &rarr;
                </Link>
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="section--tight">
        <div className="divider">
          <span className="mark" />
        </div>
      </div>

      {/* BELIEF */}
      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Our Belief</p>
            <h2>A weak strategy, marketed well, scales weaknesses.</h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: "none" }}>
              Most businesses do not suffer from a marketing problem. Marketing
              only accelerates what already exists &mdash; for better or worse.
            </p>
            <ul className="pillar-list">
              <li>Unclear positioning</li>
              <li>Weak differentiation</li>
              <li>Inconsistent customer experiences</li>
              <li>Fragmented execution</li>
              <li>Poor strategic decision-making</li>
              <li>Lack of operational systems</li>
              <li>Insufficient customer understanding</li>
            </ul>
          </div>
        </div>
      </section>

      {/* WHAT WE ARE / ARE NOT */}
      <section className="section section--raised section--border-top">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Positioning</p>
            <h2>
              Clients hire us to solve business problems &mdash; not to purchase
              creative deliverables.
            </h2>
          </div>
          <div className="compare reveal">
            <div className="yes">
              <h4>What We Are</h4>
              <ul>
                <li>Strategy Consultants</li>
                <li>Brand Strategists</li>
                <li>Business Growth Advisors</li>
                <li>Customer Experience Designers</li>
                <li>Research Partners</li>
                <li>Business Transformation Consultants</li>
              </ul>
            </div>
            <div className="no">
              <h4>What We Are Not</h4>
              <ul>
                <li>A social media agency</li>
                <li>An advertising agency</li>
                <li>A performance marketing agency</li>
                <li>A graphic design studio</li>
                <li>A website agency</li>
                <li>A vendor selling isolated marketing services</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICE ARCHITECTURE */}
      <section className="section section--border-top">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Service Architecture</p>
            <h2>Four disciplines. One strategic system.</h2>
          </div>
          <div className="grid grid--4">
            <div className="case-file reveal">
              <div className="case-file-top">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="8" />
                    <circle cx="12" cy="12" r="4.3" />
                    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
                  </svg>
                </div>
                <span className="num" style={{ color: "var(--brass)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  01
                </span>
              </div>
              <h3>Brand Strategy</h3>
              <p>Positioning, messaging, identity, research, and competitive analysis.</p>
              <Link to="/services#brand-strategy" className="more">
                Learn more
              </Link>
            </div>
            <div className="case-file reveal">
              <div className="case-file-top">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 17 L10 11 L14 15 L20 6" />
                    <path d="M14 6 L20 6 L20 12" />
                  </svg>
                </div>
                <span className="num" style={{ color: "var(--brass)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  02
                </span>
              </div>
              <h3>Growth Consulting</h3>
              <p>Business strategy, launch planning, expansion, pricing, and go-to-market.</p>
              <Link to="/services#growth-consulting" className="more">
                Learn more
              </Link>
            </div>
            <div className="case-file reveal">
              <div className="case-file-top">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M4 18 C8 18 8 6 12 6 S16 18 20 18" />
                    <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="6" r="1.3" fill="currentColor" stroke="none" />
                    <circle cx="20" cy="18" r="1.3" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <span className="num" style={{ color: "var(--brass)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  03
                </span>
              </div>
              <h3>Customer Experience</h3>
              <p>Journey mapping, SOP design, hospitality experience, and loyalty systems.</p>
              <Link to="/services#customer-experience" className="more">
                Learn more
              </Link>
            </div>
            <div className="case-file reveal">
              <div className="case-file-top">
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 3 L21 6 L9 18 L4 20 L6 15 Z" />
                    <path d="M14 6 L18 10" />
                  </svg>
                </div>
                <span className="num" style={{ color: "var(--brass)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  04
                </span>
              </div>
              <h3>Founder Strategy</h3>
              <p>Founder branding, authority building, communication strategy, thought leadership.</p>
              <Link to="/services#founder-strategy" className="more">
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* OPERATING SYSTEM (dark) */}
      <section className="section section--dark texture-dots">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">How We Work</p>
            <h2>Every engagement moves through a structured journey.</h2>
            <p className="lede" style={{ color: "var(--ash-light)" }}>
              Research precedes recommendations. Strategy precedes execution.
              Measurement follows implementation.
            </p>
          </div>
          <ul className="framework-list">
            <li className="framework-row">
              <span className="num">01</span>
              <h3>ESG Discovery&trade;</h3>
              <p>Understanding the business, market, and customer as they stand today.</p>
            </li>
            <li className="framework-row">
              <span className="num">02</span>
              <h3>ESG Brand DNA&trade;</h3>
              <p>Positioning, narrative, and identity foundations drawn from that research.</p>
            </li>
            <li className="framework-row">
              <span className="num">03</span>
              <h3>ESG Experience Blueprint&trade;</h3>
              <p>Journey mapping and service design across every customer touchpoint.</p>
            </li>
            <li className="framework-row">
              <span className="num">04</span>
              <h3>ESG Growth Engine&trade;</h3>
              <p>The business strategy and systems that turn positioning into growth.</p>
            </li>
            <li className="framework-row">
              <span className="num">05</span>
              <h3>ESG Launch Blueprint&trade;</h3>
              <p>Go-to-market planning for new offerings, locations, or ventures.</p>
            </li>
            <li className="framework-row">
              <span className="num">06</span>
              <h3>ESG Scale Framework&trade;</h3>
              <p>Operational systems that let the brand grow without losing its clarity.</p>
            </li>
            <li className="framework-row">
              <span className="num">07</span>
              <h3>ESG Founder Influence&trade;</h3>
              <p>Authority-building and communication strategy for the founder.</p>
            </li>
            <li className="framework-row">
              <span className="num">08</span>
              <h3>ESG Performance Loop&trade;</h3>
              <p>Measurement and iteration once the strategy is implemented.</p>
            </li>
          </ul>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="section section--border-top">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Industries</p>
            <h2>Hospitality is our flagship. Our thinking travels further.</h2>
          </div>
          <div className="split">
            <div className="case-file reveal" style={{ padding: "2.6rem" }}>
              <div className="case-file-meta">
                <span className="num">Primary</span>
              </div>
              <h3>Hospitality</h3>
              <p>
                Restaurants, cafés, hotels, and food &amp; beverage brands &mdash;
                where guest experience and brand strategy are inseparable.
              </p>
              <Link to="/industries#hospitality" className="more">
                Explore hospitality work
              </Link>
            </div>
            <div>
              <p className="eyebrow">Secondary</p>
              <div style={{ marginBottom: "1.8rem" }}>
                <span className="tag">Fashion</span>
                <span className="tag">Consumer Brands</span>
                <span className="tag">D2C</span>
                <span className="tag">Retail</span>
                <span className="tag">Personal Brands</span>
              </div>
              <p className="eyebrow">Expansion</p>
              <div>
                <span className="tag">Healthcare</span>
                <span className="tag">Manufacturing</span>
                <span className="tag">Education</span>
                <span className="tag">Professional Services</span>
                <span className="tag">SMEs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CASE STUDIES */}
      <section className="section section--raised section--border-top">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Selected Work</p>
            <h2>Strategy, applied.</h2>
          </div>
          <div className="grid grid--3">
            <div className="case-file reveal">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8H16V15A5 5 0 0 1 11 20H10A5 5 0 0 1 5 15Z" />
                  <path d="M16 9H19A2 2 0 0 1 21 11V12A2 2 0 0 1 19 14H16" />
                  <path d="M8 4C8 5 9 5 9 6" />
                  <path d="M12 4C12 5 13 5 13 6" />
                </svg>
              </div>
              <div className="case-file-meta">
                <span className="num">Case 01</span>
              </div>
              <h3>Café Mysa</h3>
              <p>Rebuilding a neighbourhood café around a clearer identity and a guest experience that repeats.</p>
              <Link to="/case-studies#cafe-mysa" className="more">
                Read the case study
              </Link>
            </div>
            <div className="case-file reveal">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3H14L18 7V21H7Z" />
                  <path d="M14 3V7H18" />
                  <path d="M9.5 12H15.5M9.5 15.5H15.5" />
                </svg>
              </div>
              <div className="case-file-meta">
                <span className="num">Case 02</span>
              </div>
              <h3>Dishai</h3>
              <p>Turning a founder's instinct for the brand into a documented positioning and growth strategy.</p>
              <Link to="/case-studies#dishai" className="more">
                Read the case study
              </Link>
            </div>
            <div className="case-file reveal">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3L21 8L12 13L3 8Z" />
                  <path d="M3 12L12 17L21 12" />
                  <path d="M3 16L12 21L21 16" />
                </svg>
              </div>
              <div className="case-file-meta">
                <span className="num">Case 03</span>
              </div>
              <h3>Biaana</h3>
              <p>Aligning a fast-growing brand's customer experience with the positioning it had outgrown.</p>
              <Link to="/case-studies#biaana" className="more">
                Read the case study
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="section--tight">
        <div className="divider">
          <span className="mark" />
        </div>
      </div>

      {/* RESEARCH TEASER */}
      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Research &amp; Insights</p>
            <h2>Research is not a marketing activity. It is a business capability.</h2>
          </div>
          <div>
            <p className="lede" style={{ maxWidth: "none" }}>
              We publish original thinking on strategy, branding, hospitality,
              customer experience, and founder growth &mdash; because publishing
              original thinking strengthens long-term credibility, for our
              clients and for us.
            </p>
            <Link to="/research" className="btn">
              Visit Research &amp; Insights
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section--border-top">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Ready to replace guesswork with strategic clarity?</h2>
            <Link to="/contact" className="btn btn--solid">
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default PublicHome;
