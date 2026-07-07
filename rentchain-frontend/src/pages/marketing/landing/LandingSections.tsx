import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import rentchainMark from "../../../assets/rentchain-mark.svg";
import {
  aboutVision,
  audiences,
  features,
  finalCta,
  footer,
  header,
  hero,
  lifecycle,
  operationalTrust,
  pricingStart,
  trustFlow,
  whyRentChain,
} from "./landingContent";
import { tokens } from "./marketingLandingStyles";

type LandingActionProps = {
  onPrimaryCta: () => void;
};

const dotColors: Record<string, string> = {
  pine500: tokens.colors.pine500,
  pine600: tokens.colors.pine600,
  navy200: tokens.colors.navy200,
  navy600: tokens.colors.navy600,
  amber500: tokens.colors.amber500,
  slate600: tokens.colors.slate600,
};

function roleDot(token: string) {
  return <span aria-hidden="true" className="rc-dot" style={{ background: dotColors[token] ?? tokens.colors.pine500 }} />;
}

function supportsReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function RevealOnScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(() => supportsReducedMotion());

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={`rc-reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function MarketingHeader({ onPrimaryCta }: LandingActionProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const loginButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setLoginOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLoginOpen(false);
        setMobileOpen(false);
        loginButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="rc-marketing-header">
      <div className="rc-container rc-marketing-header__inner">
        <Link className="rc-brand" to="/site" aria-label="RentChain home">
          <img src={rentchainMark} alt="" aria-hidden="true" />
          <span className="rc-brand__text">RentChain</span>
        </Link>

        <nav className="rc-header-nav" aria-label="Marketing navigation">
          {header.nav.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="rc-header-actions">
          <div className="rc-login-menu" ref={menuRef}>
            <button
              ref={loginButtonRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={loginOpen}
              className="rc-button rc-button--ghost"
              onClick={() => setLoginOpen((open) => !open)}
            >
              Log in
            </button>
            {loginOpen ? (
              <div className="rc-login-menu__panel" role="menu" aria-label="Choose a login portal">
                {header.logins.map((login) => (
                  <Link key={login.label} className="rc-login-option" to={login.href} role="menuitem">
                    {roleDot(login.dotToken)}
                    <span>{login.label}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link className="rc-link-button rc-link-button--primary" to={header.ctaHref}>
            {header.ctaLabel}
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="rc-mobile-menu"
          className="rc-button rc-button--ghost rc-mobile-toggle"
          onClick={() => setMobileOpen((open) => !open)}
        >
          Menu
        </button>
      </div>

      <div id="rc-mobile-menu" className={`rc-container rc-mobile-menu ${mobileOpen ? "is-open" : ""}`}>
        {header.nav.map((item) => (
          <a key={item.label} className="rc-mobile-link" href={item.href} onClick={() => setMobileOpen(false)}>
            {item.label}
          </a>
        ))}
        {header.logins.map((login) => (
          <Link key={login.label} className="rc-mobile-link" to={login.href} onClick={() => setMobileOpen(false)}>
            {login.label}
          </Link>
        ))}
        <button type="button" className="rc-button rc-button--accent" onClick={onPrimaryCta}>
          {hero.primaryCta.label}
        </button>
        <Link className="rc-link-button rc-link-button--primary" to={header.ctaHref}>
          {header.ctaLabel}
        </Link>
      </div>
    </header>
  );
}

function LedgerRow({ code, title, meta, status }: { code: string; title: string; meta: string; status: string }) {
  return (
    <div className="rc-ledger-row">
      <span className="rc-node-code">{code}</span>
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <strong>{status}</strong>
    </div>
  );
}

export function HeroSection({ onPrimaryCta }: LandingActionProps) {
  return (
    <section className="rc-hero" aria-labelledby="landing-hero-title">
      <div className="rc-container rc-hero__inner">
        <div>
          <p className="rc-kicker">{hero.kicker}</p>
          <h1 id="landing-hero-title">
            {hero.titleLine1} <span className="rc-hero__accent">{hero.titleAccent}</span>
          </h1>
          <p className="rc-hero__subtitle">{hero.subtitle}</p>
          <div className="rc-cta-row">
            <button type="button" className="rc-button rc-button--accent" onClick={onPrimaryCta}>
              {hero.primaryCta.label}
            </button>
            <Link className="rc-link-button rc-link-button--dark" to={hero.secondaryCta.href}>
              {hero.secondaryCta.label}
            </Link>
          </div>
          <p className="rc-microcopy">{hero.microcopy}</p>
          <div className="rc-personas" aria-label="RentChain portals">
            {hero.personas.map((persona) => (
              <span key={persona.label} className="rc-persona-pill">
                {roleDot(persona.dotToken)}
                {persona.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rc-hero-visual" aria-label="Sample connected operating record">
          <div className="rc-ledger">
            <LedgerRow code="LL" title="Lease terms approved" meta="Landlord workspace" status="Ready" />
            <LedgerRow code="TN" title="Tenant request linked" meta="Portal message" status="Open" />
            <LedgerRow code="CO" title="Evidence uploaded" meta="Work order record" status="Verified" />
            <LedgerRow code="PM" title="Renewal review queued" meta="Portfolio operation" status="Next" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustFlowSection() {
  return (
    <section className="rc-section" aria-labelledby="trust-flow-title">
      <div className="rc-container">
        <RevealOnScroll>
          <div className="rc-section-heading">
            <p className="rc-kicker">{trustFlow.kicker}</p>
            <h2 className="rc-section-title" id="trust-flow-title">
              {trustFlow.title}
            </h2>
          </div>
        </RevealOnScroll>
        <div className="rc-trust-flow" aria-label="RentChain role flow">
          <div className="rc-trust-role-grid">
            {trustFlow.nodes.map((node) => (
              <RevealOnScroll key={node.role} className="rc-card rc-trust-node">
                <span className="rc-node-code">{node.code}</span>
                <h3>{node.role}</h3>
                <p>{node.blurb}</p>
              </RevealOnScroll>
            ))}
          </div>
          <svg
            className="rc-trust-connectors"
            viewBox="0 0 120 120"
            role="img"
            aria-label="Role records connect into one shared record"
            preserveAspectRatio="none"
          >
            <path d="M4 18 H48" />
            <path d="M4 42 H48" />
            <path d="M4 78 H48" />
            <path d="M4 102 H48" />
            <path d="M48 18 V102" />
            <path d="M48 60 H116" />
          </svg>
          <RevealOnScroll className="rc-panel rc-trust-hub">
            <p className="rc-kicker">{trustFlow.hubKicker}</p>
            <h3>{trustFlow.hubTitle}</h3>
            <p>{trustFlow.hubBody}</p>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

export function WhyRentChainSection() {
  return (
    <section className="rc-section rc-section--band" aria-labelledby="why-rentchain-title">
      <div className="rc-container">
        <RevealOnScroll>
          <div className="rc-section-heading">
            <p className="rc-kicker">{whyRentChain.kicker}</p>
            <h2 className="rc-section-title" id="why-rentchain-title">
              {whyRentChain.titlePlain} <span style={{ color: tokens.colors.pine700 }}>{whyRentChain.titleAccent}</span>
            </h2>
          </div>
        </RevealOnScroll>
        <div className="rc-comparison">
          {whyRentChain.rows.map((row) => (
            <RevealOnScroll key={row.from} className="rc-card rc-comparison-row">
              <span>{row.from}</span>
              <em aria-hidden="true">to</em>
              <strong>{row.to}</strong>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AudienceSection() {
  return (
    <section className="rc-section" id="who" aria-labelledby="audience-title">
      <div className="rc-container">
        <div className="rc-section-heading">
          <p className="rc-kicker">{audiences.kicker}</p>
          <h2 className="rc-section-title" id="audience-title">
            {audiences.title}
          </h2>
        </div>
        <div className="rc-audience-grid">
          {audiences.cards.map((card) => (
            <RevealOnScroll key={card.key} className="rc-card rc-audience-card">
              <span className="rc-node-code">{card.code}</span>
              <h3>{card.role}</h3>
              <ul>
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LifecycleSection() {
  const [active, setActive] = useState(0);
  const activeStep = lifecycle.steps[active] ?? lifecycle.steps[0];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (supportsReducedMotion()) return;
    const interval = window.setInterval(() => {
      setActive((current) => (current + 1) % lifecycle.steps.length);
    }, lifecycle.autoAdvanceMs);
    return () => window.clearInterval(interval);
  }, []);

  function focusStep(index: number) {
    const nextIndex = (index + lifecycle.steps.length) % lifecycle.steps.length;
    setActive(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusStep(index + 1);
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusStep(index - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusStep(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      focusStep(lifecycle.steps.length - 1);
    }
  }

  return (
    <section className="rc-section rc-section--band" id="lifecycle" aria-labelledby="lifecycle-title">
      <div className="rc-container">
        <div className="rc-section-heading">
          <p className="rc-kicker">{lifecycle.kicker}</p>
          <h2 className="rc-section-title" id="lifecycle-title">
            {lifecycle.title}
          </h2>
          <p className="rc-section-subtitle">{lifecycle.subtitle}</p>
        </div>

        <div className="rc-lifecycle">
          <div className="rc-lifecycle-tabs" role="tablist" aria-label="Rental lifecycle">
            {lifecycle.steps.map((step, index) => (
              <button
                key={step.label}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                aria-selected={active === index}
                aria-controls="lifecycle-panel"
                className="rc-lifecycle-tab"
                onClick={() => setActive(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                {step.label}
              </button>
            ))}
          </div>

          <div id="lifecycle-panel" role="tabpanel" className="rc-panel rc-lifecycle-panel">
            <span className="rc-status">{activeStep.statusLabel}</span>
            <h3>{activeStep.title}</h3>
            <p>{activeStep.body}</p>
            <div className="rc-command-list">
              <div>
                <span>Timeline</span>
                <strong>{activeStep.meta}</strong>
              </div>
              <div>
                <span>Record detail</span>
                <strong>{activeStep.amount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeatureShowcaseSection() {
  return (
    <section className="rc-section" id="features" aria-labelledby="features-title">
      <div className="rc-container">
        <div className="rc-section-heading">
          <p className="rc-kicker">{features.kicker}</p>
          <h2 className="rc-section-title" id="features-title">
            {features.title}
          </h2>
        </div>
        <div className="rc-feature-grid">
          {features.rows.map((row) => (
            <RevealOnScroll key={row.key} className="rc-card">
              <p className="rc-kicker">{row.kicker}</p>
              <h3>{row.title}</h3>
              <p>{row.body}</p>
            </RevealOnScroll>
          ))}
        </div>
        <RevealOnScroll className="rc-panel rc-command-panel">
          <p className="rc-kicker">{features.commandCenter.kicker}</p>
          <h3>{features.commandCenter.title}</h3>
          <p>{features.commandCenter.body}</p>
          <div className="rc-command-list" aria-label="Sample command-center signals">
            <div>
              <span>Attention queue</span>
              <strong>Needs review</strong>
            </div>
            <div>
              <span>Maintenance</span>
              <strong>Open requests</strong>
            </div>
            <div>
              <span>Portfolio record</span>
              <strong>Governed units</strong>
            </div>
          </div>
          <p className="rc-microcopy">{features.commandCenter.sampleStatsNote}</p>
        </RevealOnScroll>
      </div>
    </section>
  );
}

export function OperationalTrustSection() {
  return (
    <section className="rc-section rc-section--dark" aria-labelledby="trust-title">
      <div className="rc-container">
        <div className="rc-section-heading">
          <p className="rc-kicker">{operationalTrust.kicker}</p>
          <h2 className="rc-section-title" id="trust-title">
            {operationalTrust.title}
          </h2>
          <p className="rc-section-subtitle">{operationalTrust.subtitle}</p>
        </div>
        <div className="rc-trust-grid">
          {operationalTrust.cards.map((card) => (
            <RevealOnScroll key={card.title} className="rc-card rc-operational-trust-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingStartSection({ onPrimaryCta }: LandingActionProps) {
  return (
    <section className="rc-section rc-section--pricing" id="pricing-start" aria-labelledby="pricing-start-title">
      <div className="rc-container rc-pricing-start">
        <div>
          <p className="rc-kicker">{pricingStart.kicker}</p>
          <h2 className="rc-section-title" id="pricing-start-title">
            {pricingStart.title}
          </h2>
          <p className="rc-section-subtitle">{pricingStart.body}</p>
          <div className="rc-cta-row">
            <Link className="rc-link-button rc-link-button--primary" to={pricingStart.pricingCta.href}>
              {pricingStart.pricingCta.label}
            </Link>
            <button type="button" className="rc-button rc-button--accent" onClick={onPrimaryCta}>
              {pricingStart.primaryCta.label}
            </button>
          </div>
        </div>
        <div className="rc-pricing-cards" aria-label="Pricing overview">
          <div className="rc-card rc-pricing-card">
            <h3>{pricingStart.freeTitle}</h3>
            <ul>
              {pricingStart.freeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rc-card rc-pricing-card">
            <h3>{pricingStart.paidTitle}</h3>
            <ul>
              {pricingStart.paidItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutVisionSection() {
  return (
    <section className="rc-section" id="vision" aria-labelledby="vision-title">
      <div className="rc-container rc-about-grid">
        <div>
          <p className="rc-kicker">{aboutVision.kicker}</p>
          <h2 className="rc-section-title" id="vision-title">
            {aboutVision.title}
          </h2>
          {aboutVision.body.map((paragraph) => (
            <p key={paragraph} className="rc-section-subtitle">
              {paragraph}
            </p>
          ))}
        </div>
        <aside className="rc-panel" aria-label={aboutVision.visionTitle}>
          <h3>{aboutVision.visionTitle}</h3>
          <div className="rc-tag-cloud">
            {aboutVision.tags.map((tag) => (
              <span key={tag} className="rc-tag">
                {tag}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

export function FinalCtaSection({ onPrimaryCta }: LandingActionProps) {
  return (
    <section className="rc-section" aria-labelledby="final-cta-title">
      <div className="rc-container">
        <div className="rc-final-cta">
          <p className="rc-kicker">{finalCta.kicker}</p>
          <h2 className="rc-section-title" id="final-cta-title">
            {finalCta.title}
          </h2>
          <p className="rc-section-subtitle">{finalCta.subtitle}</p>
          <div className="rc-cta-row">
            <button type="button" className="rc-button rc-button--accent" onClick={onPrimaryCta}>
              {finalCta.primaryCta.label}
            </button>
            <Link className="rc-link-button rc-link-button--dark" to={finalCta.secondaryCta.href}>
              {finalCta.secondaryCta.label}
            </Link>
          </div>
          <p className="rc-microcopy">{finalCta.microcopy}</p>
        </div>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="rc-footer">
      <div className="rc-container">
        <div className="rc-footer-grid">
          <div>
            <Link className="rc-brand" to="/site" aria-label="RentChain home">
              <img src={rentchainMark} alt="" aria-hidden="true" />
              <span className="rc-brand__text">RentChain</span>
            </Link>
            <p>{footer.blurb}</p>
          </div>
          {footer.columns.map((column) => (
            <nav key={column.heading} className="rc-footer-column" aria-label={column.heading}>
              <h2>{column.heading}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="rc-footer-bottom">
          <span>{footer.legal.copyright}</span>
          <nav className="rc-footer-legal" aria-label="Legal links">
            {footer.legal.links.map((link) => (
              <Link key={link.label} to={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
