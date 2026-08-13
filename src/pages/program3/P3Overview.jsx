// src/pages/program3/P3Overview.jsx
import { useMemo, useState, useEffect } from "react";
import "../../styles/p3Overview.css";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  MapPinned,
  BarChart3,
  CalendarDays,
  ShieldAlert,
  Bug,
  Bird,
  RefreshCw,
  Loader,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../services/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
} from "firebase/firestore";
import { subscribeToCases } from "../../services/program3CaseService";

/* =========================================
   QUICK ACCESS MODULE CARDS (Program 3)
   ========================================= */
const MODULES = [
  {
    to: "/program/animal-health-care/case-reporting",
    title: "Case Reporting (ASF / Bird Flu)",
    icon: FilePlus2,
    desc: "Submit new case reports and capture essential field details.",
  },
  {
    to: "/program/animal-health-care/case-monitoring",
    title: "Case Monitoring",
    icon: ClipboardList,
    desc: "Monitor suspected and confirmed cases across barangays.",
  },
  {
    to: "/program/animal-health-care/status-tracking",
    title: "Status Tracking",
    icon: Activity,
    desc: "Track case progress (reported → investigated → closed).",
  },
  {
    to: "/program/animal-health-care/gis-hotspots",
    title: "GIS Hotspots",
    icon: MapPinned,
    desc: "Identify disease hotspots and prioritize surveillance areas.",
  },
  {
    to: "/program/animal-health-care/reports",
    title: "Reports & Trends",
    icon: BarChart3,
    desc: "Monthly and annual incidence trends, summaries, and exports.",
  },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtPct(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

function isWithinDays(dateStr, days = 7) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  return ms >= 0 && ms <= days * 86400000;
}

function formatDate(date) {
  if (!date) return "—";
  try {
    if (date?.toDate) date = date.toDate();
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/* =========================================
   MINI LINE CHART (SVG)
   ========================================= */
function MiniLine({ points = [], height = 110 }) {
  const w = 520;
  const h = height;
  const pad = 12;

  const vals = points.length ? points : Array.from({ length: 12 }).map((_, i) => 30 + i * 2);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = Math.max(1, maxV - minV);

  const xFor = (i) => pad + (i * (w - pad * 2)) / Math.max(1, vals.length - 1);
  const yFor = (v) => h - pad - ((v - minV) / range) * (h - pad * 2);

  const d = vals
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(clamp(v, -9999, 9999))}`)
    .join(" ");

  return (
    <svg className="p3o-miniChart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {Array.from({ length: 4 }).map((_, i) => (
        <line
          key={i}
          x1={pad}
          x2={w - pad}
          y1={pad + i * ((h - pad * 2) / 3)}
          y2={pad + i * ((h - pad * 2) / 3)}
          className="p3o-gridLine"
        />
      ))}
      <path d={d} className="p3o-line" />
      {vals.map((v, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(v)} r="3.2" className="p3o-dot" />
      ))}
    </svg>
  );
}

export default function P3Overview() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cards = useMemo(() => MODULES, []);

  // Load cases from Firestore
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    try {
      if (!auth.currentUser) {
        setLoading(false);
        setError("Please sign in to view data.");
        return;
      }

      unsubscribe = subscribeToCases((fetchedCases) => {
        if (isMounted) {
          setCases(fetchedCases || []);
          setLoading(false);
          setError(null);
        }
      });

      if (!unsubscribe) {
        const q = query(collection(db, "program3_cases"), orderBy("reportedDate", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
          if (isMounted) {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setCases(data);
            setLoading(false);
            setError(null);
          }
        }, (err) => {
          console.error("Fallback query error:", err);
          if (isMounted) {
            setError(err.message);
            setLoading(false);
          }
        });
        unsubscribe = unsub;
      }
    } catch (error) {
      console.error("Failed to subscribe to cases:", error);
      if (isMounted) {
        setLoading(false);
        setError(error.message);
      }
    }

    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (err) {
          console.warn("Error unsubscribing:", err);
        }
      }
    };
  }, []);

  const kpis = useMemo(() => {
    const total = cases.length;

    const suspected = cases.filter((c) => c.status === "suspected").length;
    const confirmed = cases.filter((c) => c.status === "confirmed").length;
    const reported = cases.filter((c) => c.status === "reported").length;
    const investigated = cases.filter((c) => c.status === "investigated").length;
    const closed = cases.filter((c) => c.status === "closed").length;

    const last7 = cases.filter((c) => isWithinDays(c.reportedDate, 7)).length;

    const asf = cases.filter((c) => String(c.disease).toLowerCase() === "asf").length;
    const bf = cases.filter((c) => String(c.disease).toLowerCase().includes("bird")).length;

    const confirmRate = total ? (confirmed / total) * 100 : 0;

    // Generate trend based on actual data
    const trend = (() => {
      if (cases.length === 0) {
        return Array.from({ length: 12 }).map(() => 10 + Math.random() * 20);
      }
      
      // Group cases by month
      const monthMap = new Map();
      cases.forEach(c => {
        if (!c.reportedDate) return;
        const month = c.reportedDate.substring(0, 7);
        monthMap.set(month, (monthMap.get(month) || 0) + 1);
      });
      
      // Sort months and get counts
      const sortedMonths = Array.from(monthMap.keys()).sort();
      const counts = sortedMonths.map(m => monthMap.get(m) || 0);
      
      // Pad or trim to 12 points
      if (counts.length >= 12) {
        return counts.slice(-12);
      } else {
        const padded = Array(12 - counts.length).fill(0);
        return [...padded, ...counts];
      }
    })();

    return {
      total,
      suspected,
      confirmed,
      reported,
      investigated,
      closed,
      last7,
      asf,
      bf,
      confirmRate,
      trend,
    };
  }, [cases]);

  const topBarangays = useMemo(() => {
    const map = new Map();
    for (const c of cases) {
      const b = c.barangay || "Unknown";
      map.set(b, (map.get(b) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [cases]);

  const byDisease = useMemo(() => {
    const map = new Map();
    for (const c of cases) {
      const d = c.disease || "Unknown";
      map.set(d, (map.get(d) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [cases]);

  const recentActivity = useMemo(() => {
    const sorted = cases
      .slice()
      .sort((a, b) => String(b.reportedDate).localeCompare(String(a.reportedDate)))
      .slice(0, 10)
      .map((c) => ({
        title: `${c.disease || "Unknown"} • ${c.species || "Unknown"} • ${c.id?.slice(0, 8) || "N/A"}`,
        sub: `${c.barangay || "Unknown"} • ${c.status || "reported"} • severity: ${c.severity || "medium"} • ${c.reporter || "—"}`,
        date: c.reportedDate ? formatDate(c.reportedDate) : "—",
        tone:
          c.status === "confirmed"
            ? "bad"
            : c.status === "suspected" || c.status === "reported"
            ? "warn"
            : "ok",
      }));

    return sorted;
  }, [cases]);

  if (loading) {
    return (
      <div className="p3o">
        <div className="p3o-loading">
          <Loader size={40} className="p3o-spinner" />
          <div>Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p3o">
        <div className="p3o-error">
          <AlertTriangle size={24} />
          <p>Error loading data: {error}</p>
          <button 
            className="p3o-btn" 
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p3o">
      {/* Header */}
      <div className="p3o-head">
        <div className="p3o-headLeft">
          <div className="p3o-h1">Program 3 Overview</div>
          <div className="p3o-sub">
            Disease surveillance dashboard for ASF and Bird Flu: reporting, monitoring, status tracking, hotspot mapping, and incidence trends.
            <span className="p3o-case-count">{cases.length} total cases</span>
          </div>
        </div>

        <div className="p3o-headRight">
          <button
            className="p3o-btn ghost"
            type="button"
            onClick={() => navigate("/program/animal-health-care/reports")}
          >
            <BarChart3 size={16} /> Open Reports
          </button>

          <button
            className="p3o-btn"
            type="button"
            onClick={() => navigate("/program/animal-health-care/case-reporting")}
          >
            <FilePlus2 size={16} /> New Case Report
          </button>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="p3o-quick-access">
        {cards.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.to}
              className="p3o-quick-card"
              onClick={() => navigate(mod.to)}
            >
              <div className="p3o-quick-icon">
                <Icon size={24} />
              </div>
              <div className="p3o-quick-content">
                <div className="p3o-quick-title">{mod.title}</div>
                <div className="p3o-quick-desc">{mod.desc}</div>
              </div>
              <div className="p3o-quick-arrow">→</div>
            </div>
          );
        })}
      </div>

      {/* KPI GRID */}
      <div className="p3o-kpis">
        <div className="p3o-kpi">
          <div className="k-top">
            <span className="k-ico"><ShieldAlert size={16} /></span>
            <div className="k-label">Total Cases</div>
          </div>
          <div className="k-value">{kpis.total}</div>
          <div className="k-meta">
            <span className="pill warn">{kpis.last7} last 7 days</span>
            <span className="dot">•</span>
            <span className="muted">{kpis.closed} closed</span>
          </div>
        </div>

        <div className="p3o-kpi">
          <div className="k-top">
            <span className="k-ico"><AlertTriangle size={16} /></span>
            <div className="k-label">Suspected</div>
          </div>
          <div className="k-value">{kpis.suspected}</div>
          <div className="k-meta">
            <span className="pill warn">{kpis.reported} reported</span>
            <span className="dot">•</span>
            <span className="muted">{kpis.investigated} investigated</span>
          </div>
        </div>

        <div className="p3o-kpi">
          <div className="k-top">
            <span className="k-ico"><CheckCircle2 size={16} /></span>
            <div className="k-label">Confirmed</div>
          </div>
          <div className="k-value">{kpis.confirmed}</div>
          <div className="k-meta">
            <span className="pill bad">high risk</span>
            <span className="dot">•</span>
            <span className="muted">prioritize containment</span>
          </div>
        </div>

        <div className="p3o-kpi">
          <div className="k-top">
            <span className="k-ico"><Bug size={16} /></span>
            <div className="k-label">Disease Mix</div>
          </div>
          <div className="k-value">{kpis.asf + kpis.bf}</div>
          <div className="k-meta">
            <span className="pill ok">ASF {kpis.asf}</span>
            <span className="dot">•</span>
            <span className="pill ok">Bird Flu {kpis.bf}</span>
          </div>
        </div>
      </div>

      {/* Trend + Activity */}
      <div className="p3o-row">
        {/* Trend card */}
        <div className="p3o-cardWide">
          <div className="p3o-cardHead">
            <div className="p3o-cardTitle">
              <CalendarDays size={18} /> Incidence Trend
            </div>
            <button
              className="p3o-link"
              type="button"
              onClick={() => navigate("/program/animal-health-care/reports")}
            >
              View analytics →
            </button>
          </div>

          <div className="p3o-chartMeta">
            <div className="p3o-miniStat">
              <div className="ms-label">Reported</div>
              <div className="ms-value">{kpis.reported}</div>
            </div>
            <div className="p3o-miniStat">
              <div className="ms-label">Investigated</div>
              <div className="ms-value">{kpis.investigated}</div>
            </div>
            <div className="p3o-miniStat">
              <div className="ms-label">Closed</div>
              <div className="ms-value">{kpis.closed}</div>
            </div>
          </div>

          <MiniLine points={kpis.trend} />
          <div className="p3o-chartHint">
            {cases.length > 0 
              ? `Trend based on ${cases.length} reported cases`
              : "No data available yet. Start reporting cases to see trends."}
          </div>
        </div>

        {/* Activity feed */}
        <div className="p3o-cardWide">
          <div className="p3o-cardHead">
            <div className="p3o-cardTitle">
              <ClipboardList size={18} /> Recent Case Activity
            </div>
            <button
              className="p3o-link"
              type="button"
              onClick={() => navigate("/program/animal-health-care/case-monitoring")}
            >
              Open monitoring →
            </button>
          </div>

          <div className="p3o-feed">
            {recentActivity.map((e, idx) => (
              <div key={idx} className={`p3o-feedItem ${e.tone}`}>
                <div className="fi-left">
                  <div className="fi-title">
                    {e.tone === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{e.title}</span>
                  </div>
                  <div className="fi-sub">{e.sub}</div>
                </div>
                <div className="fi-date">{e.date}</div>
              </div>
            ))}
            {recentActivity.length === 0 ? (
              <div className="p3o-empty">No activity yet. Start reporting cases.</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="p3o-row3">
        <div className="p3o-cardBox">
          <div className="p3o-cardHead">
            <div className="p3o-cardTitle">
              <MapPinned size={18} /> Top Barangays (Cases)
            </div>
            <button
              className="p3o-link"
              type="button"
              onClick={() => navigate("/program/animal-health-care/gis-hotspots")}
            >
              Open GIS →
            </button>
          </div>

          <table className="p3o-table">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Cases</th>
              </tr>
            </thead>
            <tbody>
              {topBarangays.map(([b, c]) => (
                <tr key={b}>
                  <td><b>{b}</b></td>
                  <td>{c}</td>
                </tr>
              ))}
              {topBarangays.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p3o-emptyRow">No cases yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="p3o-cardBox">
          <div className="p3o-cardHead">
            <div className="p3o-cardTitle">
              <Bug size={18} /> Cases by Disease
            </div>
            <button
              className="p3o-link"
              type="button"
              onClick={() => navigate("/program/animal-health-care/reports")}
            >
              Open reports →
            </button>
          </div>

          <table className="p3o-table">
            <thead>
              <tr>
                <th>Disease</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {byDisease.map(([d, c]) => (
                <tr key={d}>
                  <td>
                    <b style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {String(d).toLowerCase() === "asf" ? <Bug size={14} /> : <Bird size={14} />}
                      {d}
                    </b>
                  </td>
                  <td>{c}</td>
                </tr>
              ))}
              {byDisease.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p3o-emptyRow">No data yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="p3o-cardBox">
          <div className="p3o-cardHead">
            <div className="p3o-cardTitle">
              <Activity size={18} /> Status Snapshot
            </div>
            <button
              className="p3o-link"
              type="button"
              onClick={() => navigate("/program/animal-health-care/status-tracking")}
            >
              Open tracker →
            </button>
          </div>

          <div className="p3o-statusList">
            {[
              { label: "Reported", value: kpis.reported, tone: "neutral" },
              { label: "Suspected", value: kpis.suspected, tone: "warn" },
              { label: "Investigated", value: kpis.investigated, tone: "ok" },
              { label: "Confirmed", value: kpis.confirmed, tone: "bad" },
              { label: "Closed", value: kpis.closed, tone: "ok" },
            ].map((x) => (
              <div key={x.label} className="p3o-statusItem">
                <div className="p3o-statusLeft">
                  <span className={`p3o-badge ${x.tone}`}>{x.label}</span>
                </div>
                <div className="p3o-statusRight">{x.value}</div>
              </div>
            ))}
          </div>

          <div className="p3o-note">
            <AlertTriangle size={14} />
            <span>Confirmed cases should be reviewed immediately for containment and hotspot updating.</span>
          </div>
        </div>
      </div>
    </div>
  );
}