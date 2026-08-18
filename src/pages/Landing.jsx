import { useNavigate } from "react-router-dom";
import "../styles/landing.css";
import logo from "../images/logo.png";
import naujan from "../images/naujan.png";

const FeatureCard = ({ icon, title, desc, bullets }) => (
  <div className="card fade-up">
    <div className="card-head">
      <div className="icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p className="desc">{desc}</p>
      </div>
    </div>

    {bullets?.length ? (
      <ul className="bullets">
        {bullets.map((b, i) => (
          <li key={i}>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    ) : null}

    <div className="hr" />
    <div className="card-footer">
      <span>
        <span className="dot" /> Module Ready
      </span>
      <span className="muted-link">Explore →</span>
    </div>
  </div>
);

const FlowStep = ({ n, title, desc, active }) => (
  <div className={`step fade-up ${active ? "active" : ""}`}>
    <div className="num">{n}</div>
    <div>
      <h4>{title}</h4>
      <div className="sdesc">{desc}</div>
    </div>
  </div>
);

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-wrap">
      <div className="bg-layer" />
      <div className="grid-layer" />

      {/* CSS animated blobs */}
      <div className="blob a" aria-hidden />
      <div className="blob b" aria-hidden />
      <div className="blob c" aria-hidden />

      {/* Full width header */}
      <header className="header">
        <div className="header-inner fade-up">
          {/* ✅ CHANGE: wrap the two logos so they stay horizontal on mobile */}
          <div className="header-logos">
            <div className="logo-box">
              <img src={logo} alt="ANIMIS Logo" />
            </div>

            <div className="naujan-logo-box">
              <img src={naujan} alt="Naujan Logo" />
            </div>
          </div>

          <div className="brand">
            <div className="kicker">MUNICIPAL AGRICULTURE OFFICE • NAUJAN</div>
            <div className="title-row">
              <h1 className="brand-title">ANIMIS</h1>
              <div className="brand-sub">
                Animal Health • Breeding • Surveillance • Inventory • GIS
              </div>
            </div>
          </div>

          <div className="header-actions">
            <div className="badge">
              <span className="dot" /> System Operational
            </div>
            <button className="btn" onClick={() => navigate("/auth")}>
              Access System
            </button>
          </div>
        </div>
      </header>

      <div className="shell">
        <main className="main">
          <section className="hero">
            <div className="pill fade-up">
              <span className="dot" />
              Field-ready • Offline-capable • Role-based access
            </div>

            {/* Center logo in hero */}
            <div className="hero-logo fade-up">
              <img src={logo} alt="ANIMIS Logo Large" />
            </div>

            <h2 className="fade-up">
              Integrated animal management for{" "}
              <span className="gradient">
                registration, health services, breeding, surveillance and inventory
              </span>{" "}
              —built for Naujan.
            </h2>

            <p className="fade-up">
              ANIMIS streamlines animal profiling, vaccination and treatment programs, breeding outcomes,
              ASF/Bird Flu case tracking, vaccine stock control, GIS service mapping, and cold-chain monitoring—
              supporting data-driven LGU planning and DA-aligned reporting.
            </p>

            <div className="hero-cta fade-up">
              <button className="btn big-btn" onClick={() => navigate("/auth")}>
                Access System →
              </button>
              <div className="hint">Authorized personnel login required</div>
            </div>
          </section>

          <section className="section">
            <div className="grid">
              <FeatureCard
                icon="🐄"
                title="Animal & Farm Registration"
                desc="Centralized profiling and barangay assignment for accurate coverage tracking."
                bullets={[
                  "Animal profile (species, breed, sex, age, tag/ID)",
                  "Farm/household recording and owner details",
                  "Barangay + location assignment (GPS optional)",
                ]}
              />

              <FeatureCard
                icon="💉"
                title="Health Services Monitoring"
                desc="Track interventions and follow-ups with alerts for better program compliance."
                bullets={[
                  "Vaccination, deworming, vitamin supplementation",
                  "Consultation, treatment, and inspection encoding",
                  "Follow-up scheduling + missed/pending alerts",
                ]}
              />

              <FeatureCard
                icon="🧬"
                title="Breeding Management"
                desc="Support breeding programs with measurable outcomes."
                bullets={[
                  "Estrus synchronization scheduling & monitoring",
                  "Artificial insemination record management",
                  "Pregnancy check + outcome tracking",
                  "Breeding performance monitoring",
                ]}
              />

              <FeatureCard
                icon="🦠"
                title="Disease Surveillance"
                desc="Structured case reporting and status workflows for rapid response."
                bullets={[
                  "ASF and Bird Flu case reporting",
                  "Suspected & confirmed monitoring",
                  "Status tracking: reported → investigated → closed",
                ]}
              />

              <FeatureCard
                icon="📦"
                title="Vaccine & Supply Inventory"
                desc="Stock visibility and expiry controls for uninterrupted field operations."
                bullets={[
                  "Stock-in / stock-out tracking",
                  "Batch and expiration monitoring",
                  "Monthly consumption report",
                  "Low-stock and near-expiry notifications",
                ]}
              />

              <FeatureCard
                icon="🗺️"
                title="GIS + Cold Chain Monitoring"
                desc="Map service coverage and protect vaccine potency with temperature alerts."
                bullets={[
                  "Mapping of service coverage by barangay",
                  "Vaccination and mission activity visualization",
                  "Disease hotspot identification + cold-chain alerts",
                ]}
              />
            </div>
          </section>

          <section className="section">
            <div className="split">
              <div className="panel">
                <h3 className="fade-up">System Access Flow</h3>
                <p className="fade-up">
                  Role-based access: Admin • Field Officer • Inventory Officer
                </p>

                <div className="flow">
                  <FlowStep n="1" active title="Secure Authentication" desc="Login with audit-ready access controls and role routing." />
                  <FlowStep n="2" title="Field Data Encoding" desc="Register animals and encode services on-site (sync when online)." />
                  <FlowStep n="3" title="Monitoring & Alerts" desc="Follow-ups, low stock, near expiry, and cold-chain notifications." />
                  <FlowStep n="4" title="Analytics & Reports" desc="Barangay statistics, breeding success, and monthly/annual trends." />
                </div>
              </div>

              <div className="panel">
                <h3 className="fade-up">Security & Compliance</h3>
                <p className="fade-up">
                  Built around LGU workflows, accountability, and data integrity.
                </p>

                <div className="grid" style={{ marginTop: 12 }}>
                  <div className="card fade-up" style={{ padding: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>🔐 Role-based Access</h3>
                    <p className="desc" style={{ marginTop: 6 }}>Admin / Field / Inventory permissions per module.</p>
                  </div>

                  <div className="card fade-up" style={{ padding: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>🧾 Audit Logs</h3>
                    <p className="desc" style={{ marginTop: 6 }}>Traceable actions for encoding and inventory changes.</p>
                  </div>

                  <div className="card fade-up" style={{ padding: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>📶 Offline-ready</h3>
                    <p className="desc" style={{ marginTop: 6 }}>Field encoding even with weak connectivity.</p>
                  </div>

                  <div className="card fade-up" style={{ padding: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>📍 GIS Visibility</h3>
                    <p className="desc" style={{ marginTop: 6 }}>Coverage maps + hotspot identification for response.</p>
                  </div>
                </div>

                <button className="panel-btn fade-up" onClick={() => navigate("/auth")}>
                  Continue to Login
                </button>
              </div>
            </div>
          </section>


        </main>
      </div>
    </div>
  );
}
