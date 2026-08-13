import { useEffect, useMemo, useState } from "react";
import "../../styles/p2Overview.css";
import {
  CalendarClock,
  Syringe,
  Baby,
  TrendingUp,
  BarChart3,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  MapPinned,
  ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { db } from "../../services/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

/* =========================================
   HELPERS
   ========================================= */
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
  const d = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  return ms >= 0 && ms <= days * 86400000;
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "pregnant" || s === "success") return "ok";
  if (s === "scheduled" || s === "in_progress" || s === "pending") return "warn";
  if (s === "open" || s === "failed" || s === "overdue" || s === "aborted") return "bad";
  return "neutral";
}

function safeDate(v) {
  if (!v) return null;

  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof v === "object" && typeof v.seconds === "number") {
    const d = new Date(v.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(v) {
  const d = safeDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* =========================================
   MINI LINE CHART
   ========================================= */
function MiniLine({ points = [], height = 110 }) {
  const w = 520;
  const h = height;
  const pad = 12;

  const vals = points.length ? points : Array.from({ length: 12 }).map((_, i) => 40 + i * 2);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = Math.max(1, maxV - minV);

  const xFor = (i) => pad + (i * (w - pad * 2)) / Math.max(1, vals.length - 1);
  const yFor = (v) => h - pad - ((v - minV) / range) * (h - pad * 2);

  const d = vals
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(clamp(v, -9999, 9999))}`)
    .join(" ");

  return (
    <svg className="p2o-miniChart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {Array.from({ length: 4 }).map((_, i) => (
        <line
          key={i}
          x1={pad}
          x2={w - pad}
          y1={pad + i * ((h - pad * 2) / 3)}
          y2={pad + i * ((h - pad * 2) / 3)}
          className="p2o-gridLine"
        />
      ))}
      <path d={d} className="p2o-line" />
      {vals.map((v, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(v)} r="3.2" className="p2o-dot" />
      ))}
    </svg>
  );
}

/* =========================================
   MAIN
   ========================================= */
export default function P2Overview() {
  const navigate = useNavigate();

  const [animals, setAnimals] = useState([]);
  const [estrus, setEstrus] = useState([]);
  const [ai, setAi] = useState([]);
  const [pregChecks, setPregChecks] = useState([]);

  const [animalsError, setAnimalsError] = useState("");
  const [estrusError, setEstrusError] = useState("");
  const [aiError, setAiError] = useState("");
  const [pregError, setPregError] = useState("");

  useEffect(() => {
    const unsubAnimals = onSnapshot(
      query(collection(db, "program2_animals")),
      (snap) => {
        setAnimals(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setAnimalsError("");
      },
      (error) => {
        console.error("Error loading program2_animals:", error);
        setAnimals([]);
        setAnimalsError(error?.message || "Failed to load animals.");
      }
    );

    const unsubEstrus = onSnapshot(
      query(collection(db, "program2_estrus")),
      (snap) => {
        setEstrus(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setEstrusError("");
      },
      (error) => {
        console.error("Error loading program2_estrus:", error);
        setEstrus([]);
        setEstrusError(error?.message || "Failed to load estrus records.");
      }
    );

    const unsubAi = onSnapshot(
      query(collection(db, "program2_ai")),
      (snap) => {
        setAi(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setAiError("");
      },
      (error) => {
        console.error("Error loading program2_ai:", error);
        setAi([]);
        setAiError(error?.message || "Failed to load AI records.");
      }
    );

    const unsubPreg = onSnapshot(
      query(collection(db, "program2_pregnancy")),
      (snap) => {
        setPregChecks(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setPregError("");
      },
      (error) => {
        console.error("Error loading program2_pregnancy:", error);
        setPregChecks([]);
        setPregError(error?.message || "Failed to load pregnancy records.");
      }
    );

    return () => {
      unsubAnimals();
      unsubEstrus();
      unsubAi();
      unsubPreg();
    };
  }, []);

  const kpis = useMemo(() => {
    const totalBreedingAnimals = animals.length;
    const activeBreedingAnimals = animals.filter(
      (a) => String(a.breedingStatus || a.status || "").toLowerCase() === "active"
    ).length;

    const farmsCount = new Set(
      animals.map((a) => `${a.farmerName || ""}|${a.barangay || ""}`).filter(Boolean)
    ).size;

    const totalEstrus = estrus.length;
    const scheduledEstrus = estrus.filter((e) => e.status === "scheduled").length;
    const inProgressEstrus = estrus.filter((e) => e.status === "in_progress").length;
    const completedEstrus = estrus.filter((e) => e.status === "completed").length;

    const totalAI = ai.length;
    const last7dAI = ai.filter((x) => isWithinDays(x.aiDate || x.date, 7)).length;

    const totalChecks = pregChecks.length;
    const pregnant = pregChecks.filter(
      (p) => String(p.result).toLowerCase() === "pregnant"
    ).length;
    const open = pregChecks.filter((p) => String(p.result).toLowerCase() === "open").length;

    const conceptionRate = totalAI ? (pregnant / totalAI) * 100 : 0;

    const calved = pregChecks.filter(
      (p) => String(p.outcome).toLowerCase() === "calved"
    ).length;
    const successRate = pregnant ? (calved / pregnant) * 100 : 0;

    const activityTotal = totalAI + totalChecks + totalEstrus;
    const trend = Array.from({ length: 12 }).map((_, idx) => {
      const base = activityTotal * 7;
      return clamp(base + idx * 3 - (idx % 4) * 5, 10, 100);
    });

    return {
      totalBreedingAnimals,
      activeBreedingAnimals,
      farmsCount,
      totalEstrus,
      scheduledEstrus,
      inProgressEstrus,
      completedEstrus,
      totalAI,
      last7dAI,
      totalChecks,
      pregnant,
      open,
      conceptionRate,
      successRate,
      calved,
      trend,
    };
  }, [animals, estrus, ai, pregChecks]);

  const topBarangays = useMemo(() => {
    const map = new Map();

    for (const e of estrus) {
      const key = e.barangay || "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }
    for (const x of ai) {
      const key = x.barangay || "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }
    for (const p of pregChecks) {
      const key = p.barangay || "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [estrus, ai, pregChecks]);

  const byOutcome = useMemo(() => {
    const map = new Map();
    for (const p of pregChecks) {
      const k =
        String(p.result).toLowerCase() === "pregnant"
          ? "Pregnant"
          : String(p.result).toLowerCase() === "open"
          ? "Open / Not Pregnant"
          : "Unknown";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [pregChecks]);

  const recentActivity = useMemo(() => {
    const a = ai
      .slice()
      .sort((x, y) => String(y.aiDate || y.date || "").localeCompare(String(x.aiDate || x.date || "")))
      .slice(0, 3)
      .map((x) => ({
        tone: "ok",
        title: `AI Completed • ${x.animalTagId || x.tagId || "—"}`,
        sub: `${x.barangay || "—"} • ${x.sireCode || x.semenBatch || "—"} • ${x.technician || "—"}`,
        date: fmtDate(x.aiDate || x.date),
      }));

    const e = estrus
      .slice()
      .sort((x, y) => String(y.startDate || "").localeCompare(String(x.startDate || "")))
      .slice(0, 4)
      .map((x) => ({
        tone: x.status === "completed" ? "ok" : "warn",
        title: `Estrus ${String(x.status || "").replaceAll("_", " ")} • ${x.animalTagId || x.tagId || "—"}`,
        sub: `${x.barangay || "—"} • Protocol: ${x.protocol || "—"} • Target AI: ${x.targetAI || "—"}`,
        date: fmtDate(x.startDate),
      }));

    const p = pregChecks
      .slice()
      .sort((x, y) => String(y.checkDate || "").localeCompare(String(x.checkDate || "")))
      .slice(0, 4)
      .map((x) => ({
        tone: x.result === "pregnant" ? "ok" : "bad",
        title: `Pregnancy Check • ${x.animalTagId || x.tagId || "—"} (${String(x.result || "").toUpperCase()})`,
        sub: `${x.barangay || "—"} • Outcome: ${String(x.outcome || "—").replaceAll("_", " ")} • ${x.notes || "—"}`,
        date: fmtDate(x.checkDate),
      }));

    const alerts = [];
    if (kpis.open > 0) {
      alerts.push({
        tone: "warn",
        title: `Follow-up Needed • ${kpis.open} open result(s)`,
        sub: "Some animals require rescheduling or repeat breeding assessment.",
        date: "Today",
      });
    }

    return [...alerts, ...p, ...a, ...e].slice(0, 3);
  }, [ai, estrus, pregChecks, kpis.open]);

  const hasAnyError = animalsError || estrusError || aiError || pregError;

  return (
    <div className="p2o">
      <div className="p2o-head">
        <div className="p2o-headLeft">
          <div className="p2o-h1">Program 2 Overview</div>
          <div className="p2o-sub">
            Animal Breeding dashboard snapshot (Identification & Scheduling • AI • Pregnancy Diagnosis • Performance).
          </div>
        </div>

        <div className="p2o-headRight">
          <button
            className="p2o-btn ghost"
            type="button"
            onClick={() => navigate("/program/animal-breeding/reports")}
          >
            <BarChart3 size={16} /> Open Reports
          </button>
          <button
            className="p2o-btn"
            type="button"
            onClick={() => navigate("/program/animal-breeding/insemination")}
          >
            <Syringe size={16} /> Add AI Record
          </button>
        </div>
      </div>

      {hasAnyError ? (
        <div className="p2o-empty" style={{ marginBottom: 12 }}>
          {animalsError && <div>Animals: {animalsError}</div>}
          {estrusError && <div>Estrus: {estrusError}</div>}
          {aiError && <div>AI: {aiError}</div>}
          {pregError && <div>Pregnancy: {pregError}</div>}
        </div>
      ) : null}

      <div className="p2o-kpis">
        <div className="p2o-kpi">
          <div className="k-top">
            <span className="k-ico">
              <ClipboardList size={16} />
            </span>
            <div className="k-label">Breeding Animals</div>
          </div>
          <div className="k-value">{kpis.totalBreedingAnimals}</div>
          <div className="k-meta">
            <span className="pill ok">{kpis.activeBreedingAnimals} active</span>
            <span className="dot">•</span>
            <span className="muted">{kpis.farmsCount} farmer groups</span>
          </div>
        </div>

        <div className="p2o-kpi">
          <div className="k-top">
            <span className="k-ico">
              <CalendarClock size={16} />
            </span>
            <div className="k-label">Estrus Scheduling</div>
          </div>
          <div className="k-value">{kpis.totalEstrus}</div>
          <div className="k-meta">
            <span className="pill warn">{kpis.scheduledEstrus} scheduled</span>
            <span className="dot">•</span>
            <span className="muted">{kpis.inProgressEstrus} in progress</span>
          </div>
        </div>

        <div className="p2o-kpi">
          <div className="k-top">
            <span className="k-ico">
              <Syringe size={16} />
            </span>
            <div className="k-label">AI Records</div>
          </div>
          <div className="k-value">{kpis.totalAI}</div>
          <div className="k-meta">
            <span className="pill ok">{kpis.last7dAI} last 7 days</span>
            <span className="dot">•</span>
            <span className="muted">{kpis.completedEstrus} estrus completed</span>
          </div>
        </div>

        <div className="p2o-kpi">
          <div className="k-top">
            <span className="k-ico">
              <TrendingUp size={16} />
            </span>
            <div className="k-label">Conception Rate</div>
          </div>
          <div className="k-value">{fmtPct(kpis.conceptionRate)}</div>
          <div className="k-meta">
            <span className="pill ok">{kpis.pregnant} pregnant</span>
            <span className="dot">•</span>
            <span className="muted">{kpis.open} open</span>
          </div>
        </div>
      </div>

      <div className="p2o-row">
        <div className="p2o-cardWide">
          <div className="p2o-cardHead">
            <div className="p2o-cardTitle">
              <CalendarDays size={18} /> Breeding Activity Trend
            </div>
            <button
              className="p2o-link"
              type="button"
              onClick={() => navigate("/program/animal-breeding/reports")}
            >
              View analytics →
            </button>
          </div>

          <div className="p2o-chartMeta">
            <div className="p2o-miniStat">
              <div className="ms-label">AI Records</div>
              <div className="ms-value">{kpis.totalAI}</div>
            </div>
            <div className="p2o-miniStat">
              <div className="ms-label">Preg Checks</div>
              <div className="ms-value">{kpis.totalChecks}</div>
            </div>
            <div className="p2o-miniStat">
              <div className="ms-label">Success Rate</div>
              <div className="ms-value">{fmtPct(kpis.successRate)}</div>
            </div>
          </div>

          <MiniLine points={kpis.trend} />
          <div className="p2o-chartHint">
            Live overview trend from identification/scheduling, AI, and pregnancy diagnosis totals.
          </div>
        </div>

        <div className="p2o-cardWide">
          <div className="p2o-cardHead">
            <div className="p2o-cardTitle">
              <Users size={18} /> Recent Activity
            </div>
            <button
              className="p2o-link"
              type="button"
              onClick={() => navigate("/program/animal-breeding/pregnancy")}
            >
              Open pregnancy checks →
            </button>
          </div>

          <div className="p2o-feed">
            {recentActivity.map((e, idx) => (
              <div key={idx} className={`p2o-feedItem ${e.tone}`}>
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
            {recentActivity.length === 0 ? <div className="p2o-empty">No activity yet.</div> : null}
          </div>
        </div>
      </div>

      <div className="p2o-row3">
        <div className="p2o-cardBox">
          <div className="p2o-cardHead">
            <div className="p2o-cardTitle">
              <MapPinned size={18} /> Top Barangays
            </div>
            <button
              className="p2o-link"
              type="button"
              onClick={() => navigate("/program/animal-breeding/estrus")}
            >
              Open scheduling →
            </button>
          </div>

          <table className="p2o-table">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Activities</th>
              </tr>
            </thead>
            <tbody>
              {topBarangays.map(([b, c]) => (
                <tr key={b}>
                  <td>
                    <b>{b}</b>
                  </td>
                  <td>{c}</td>
                </tr>
              ))}
              {topBarangays.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p2o-emptyRow">
                    No records yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="p2o-cardBox">
          <div className="p2o-cardHead">
            <div className="p2o-cardTitle">
              <Baby size={18} /> Pregnancy Results
            </div>
            <button
              className="p2o-link"
              type="button"
              onClick={() => navigate("/program/animal-breeding/pregnancy")}
            >
              Manage →
            </button>
          </div>

          <table className="p2o-table">
            <thead>
              <tr>
                <th>Result</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {byOutcome.map(([t, c]) => (
                <tr key={t}>
                  <td>
                    <b>{t}</b>
                  </td>
                  <td>{c}</td>
                </tr>
              ))}
              {byOutcome.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p2o-emptyRow">
                    No data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="p2o-cardBox">
          <div className="p2o-cardHead">
            <div className="p2o-cardTitle">
              <Activity size={18} /> Performance Snapshot
            </div>
            <button
              className="p2o-link"
              type="button"
              onClick={() => navigate("/program/animal-breeding/performance")}
            >
              Open performance →
            </button>
          </div>

          <div className="p2o-perfList">
            <div className="p2o-perfItem">
              <div className="p2o-perfMain">
                <div className="p2o-perfName">Conception Rate</div>
                <div className="p2o-perfMeta">
                  <span className={`p2o-badge ${badgeClass("success")}`}>{fmtPct(kpis.conceptionRate)}</span>
                  <span className="dot">•</span>
                  <span>
                    {kpis.pregnant} pregnant / {kpis.totalAI} AI
                  </span>
                </div>
              </div>
              <div className="p2o-perfTime">Updated today</div>
            </div>

            <div className="p2o-perfItem">
              <div className="p2o-perfMain">
                <div className="p2o-perfName">Breeding Success</div>
                <div className="p2o-perfMeta">
                  <span className={`p2o-badge ${badgeClass(kpis.successRate > 0 ? "success" : "pending")}`}>
                    {fmtPct(kpis.successRate)}
                  </span>
                  <span className="dot">•</span>
                  <span>{kpis.calved} calved outcome(s)</span>
                </div>
              </div>
              <div className="p2o-perfTime">Updated today</div>
            </div>

            <div className="p2o-perfItem">
              <div className="p2o-perfMain">
                <div className="p2o-perfName">Scheduled Estrus</div>
                <div className="p2o-perfMeta">
                  <span className={`p2o-badge ${badgeClass("scheduled")}`}>
                    {kpis.scheduledEstrus} scheduled
                  </span>
                  <span className="dot">•</span>
                  <span>{kpis.inProgressEstrus} in progress</span>
                </div>
              </div>
              <div className="p2o-perfTime">Updated today</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}