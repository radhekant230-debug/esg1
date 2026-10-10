import React from "react";
import { Link } from "react-router-dom";

const PublicCaseStudies = () => {
  return (
    <>
      <section className="page-head container">
        <p className="breadcrumb">
          <Link to="/">Home</Link> / Case Studies
        </p>
        <p className="eyebrow">Selected Work</p>
        <h1>Strategy, applied.</h1>
        <p className="lede">
          Every engagement follows the same discipline: challenge, research,
          insight, strategy, execution, outcomes, and the lessons that carry
          into the next project.
        </p>
      </section>

      {/* CAFE MYSA */}
      <section id="cafe-mysa" className="case-detail container">
        <div className="case-detail-head">
          <div className="icon-row">
            <div className="icon icon--sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8H16V15A5 5 0 0 1 11 20H10A5 5 0 0 1 5 15Z" />
                <path d="M16 9H19A2 2 0 0 1 21 11V12A2 2 0 0 1 19 14H16" />
                <path d="M8 4C8 5 9 5 9 6" />
                <path d="M12 4C12 5 13 5 13 6" />
              </svg>
            </div>
            <div>
              <p className="eyebrow">Case 01 &mdash; Positioning &amp; Experience Design</p>
              <h2 className="mb-0">Café Mysa</h2>
            </div>
          </div>
          <span className="tag">Hospitality &mdash; Café</span>
        </div>
        <div className="case-stages">
          <div className="case-stage reveal">
            <span className="num">Challenge</span>
            <p>A neighbourhood café with a loyal but small following, competing against louder, better-funded openings nearby without a clear point of view.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Research</span>
            <p>ESG Discovery&trade; mapped the guest base, the surrounding competitive set, and the moments where the café's own service fell short of its food.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Insight</span>
            <p>Guests weren't choosing Mysa for its menu alone &mdash; they were choosing it as a routine. The brand had never named or designed for that role.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Strategy</span>
            <p>A positioning built around "the neighbourhood's second kitchen," with an identity and tone to match, and a service blueprint to make the routine repeatable.</p>
          </div>
        </div>
        <div className="case-stages" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="case-stage reveal">
            <span className="num">Execution</span>
            <p>Identity, in-café signage and menu language, and a revised service SOP delivered through the Experience Blueprint framework.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Business Outcomes</span>
            <p>Clearer identity across every touchpoint, a documented service standard the team could run without us, and stronger repeat visitation from the surrounding neighbourhood.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Lessons Learned</span>
            <p>In hospitality, the experience is the positioning &mdash; a strategy that only lives on paper never reaches the guest.</p>
          </div>
        </div>
      </section>

      {/* DISHAI */}
      <section id="dishai" className="case-detail container">
        <div className="case-detail-head">
          <div className="icon-row">
            <div className="icon icon--sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3H14L18 7V21H7Z" />
                <path d="M14 3V7H18" />
                <path d="M9.5 12H15.5M9.5 15.5H15.5" />
              </svg>
            </div>
            <div>
              <p className="eyebrow">Case 02 &mdash; Brand Strategy &amp; Growth</p>
              <h2 className="mb-0">Dishai</h2>
            </div>
          </div>
          <span className="tag">Founder-Led Brand</span>
        </div>
        <div className="case-stages">
          <div className="case-stage reveal">
            <span className="num">Challenge</span>
            <p>A founder-led brand growing on instinct and word of mouth, with no documented positioning to guide hiring, partnerships, or its next stage of growth.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Research</span>
            <p>ESG Discovery&trade; and Brand DNA&trade; work surfaced what customers valued in the founder's instincts &mdash; and where those instincts hadn't yet been written down.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Insight</span>
            <p>The brand's real differentiator wasn't a product feature; it was a point of view the founder held but had never articulated externally.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Strategy</span>
            <p>A documented positioning and messaging system built around that point of view, paired with a growth plan sequenced through the Growth Engine&trade; framework.</p>
          </div>
        </div>
        <div className="case-stages" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="case-stage reveal">
            <span className="num">Execution</span>
            <p>Positioning documentation, messaging guidelines, and a founder communication strategy the team could apply consistently.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Business Outcomes</span>
            <p>A repeatable positioning the founder no longer had to reinvent in every conversation, and a growth plan aligned with that identity rather than working against it.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Lessons Learned</span>
            <p>Founder-led brands often already have the right instinct &mdash; the work is documenting it before growth outpaces it.</p>
          </div>
        </div>
      </section>

      {/* BIAANA */}
      <section id="biaana" className="case-detail container">
        <div className="case-detail-head">
          <div className="icon-row">
            <div className="icon icon--sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3L21 8L12 13L3 8Z" />
                <path d="M3 12L12 17L21 12" />
                <path d="M3 16L12 21L21 16" />
              </svg>
            </div>
            <div>
              <p className="eyebrow">Case 03 &mdash; Customer Experience &amp; Scale</p>
              <h2 className="mb-0">Biaana</h2>
            </div>
          </div>
          <span className="tag">Consumer Brand</span>
        </div>
        <div className="case-stages">
          <div className="case-stage reveal">
            <span className="num">Challenge</span>
            <p>A brand that had grown quickly, to the point where its customer experience no longer matched the premium positioning it had earned.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Research</span>
            <p>Journey mapping under the Experience Blueprint&trade; framework identified exactly where operations had outpaced the brand's original standards.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Insight</span>
            <p>The gap wasn't strategic &mdash; it was operational. The brand's promise was right; its systems hadn't scaled to keep it.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Strategy</span>
            <p>A Scale Framework&trade; engagement to rebuild SOPs and service standards so growth stopped eroding the experience it was meant to fund.</p>
          </div>
        </div>
        <div className="case-stages" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="case-stage reveal">
            <span className="num">Execution</span>
            <p>Revised SOPs, a loyalty and service system, and a measurement cadence installed through the Performance Loop&trade; framework.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Business Outcomes</span>
            <p>A customer experience realigned with the brand's positioning, and operational systems built to hold as the business keeps growing.</p>
          </div>
          <div className="case-stage reveal">
            <span className="num">Lessons Learned</span>
            <p>Growth doesn't dilute a brand on its own &mdash; it exposes whichever systems were never built to scale.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section--raised section--border-top">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Want a strategy engagement built around your business?</h2>
            <Link to="/contact" className="btn btn--solid">
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default PublicCaseStudies;
