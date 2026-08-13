import { useEffect, useMemo, useState } from "react";
import "../../styles/p2Module.css";
import { TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

import { db } from "../../services/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

function fmtPct(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

export default function P2Performance() {
  const [ai, setAi] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loadingAI, setLoadingAI] = useState(true);
  const [loadingChecks, setLoadingChecks] = useState(true);
  const [aiError, setAiError] = useState("");
  const [checksError, setChecksError] = useState("");

  useEffect(() => {
    const qAI = query(collection(db, "program2_ai"));
    const unsubAI = onSnapshot(
      qAI,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAi(list);
        setAiError("");
        setLoadingAI(false);
      },
      (error) => {
        console.error("Error loading AI records:", error);
        setAi([]);
        setAiError(error?.message || "Failed to load AI records.");
        setLoadingAI(false);
      }
    );

    const qPregnancy = query(collection(db, "program2_pregnancy"));
    const unsubPregnancy = onSnapshot(
      qPregnancy,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setChecks(list);
        setChecksError("");
        setLoadingChecks(false);
      },
      (error) => {
        console.error("Error loading pregnancy records:", error);
        setChecks([]);
        setChecksError(error?.message || "Failed to load pregnancy records.");
        setLoadingChecks(false);
      }
    );

    return () => {
      unsubAI();
      unsubPregnancy();
    };
  }, []);

  const stats = useMemo(() => {
    const totalAI = ai.length;
    const pregnant = checks.filter((c) => String(c.result).toLowerCase() === "pregnant").length;
    const open = checks.filter((c) => String(c.result).toLowerCase() === "open").length;

    const conceptionRate = totalAI ? (pregnant / totalAI) * 100 : 0;

    const calved = checks.filter(
      (c) => String(c.outcome).toLowerCase() === "calved"
    ).length;

    const successRate = pregnant ? (calved / pregnant) * 100 : 0;

    const repeatBreeder = checks.filter(
      (c) => String(c.outcome).toLowerCase() === "repeat_breeder"
    ).length;

    const pending = checks.filter(
      (c) => String(c.outcome).toLowerCase() === "pending"
    ).length;

    const aborted = checks.filter(
      (c) => String(c.outcome).toLowerCase() === "aborted"
    ).length;

    return {
      totalAI,
      pregnant,
      open,
      conceptionRate,
      calved,
      successRate,
      repeatBreeder,
      pending,
      aborted,
    };
  }, [ai, checks]);

  const insights = useMemo(() => {
    const list = [];

    if (stats.totalAI === 0) {
      list.push({
        tone: "neutral",
        title: "No AI records yet",
        sub: "Add artificial insemination records to generate performance analytics.",
      });
      return list;
    }

    if (stats.conceptionRate >= 70) {
      list.push({
        tone: "ok",
        title: "Conception performance is strong",
        sub: "Maintain current protocol timing, estrus detection, and semen handling.",
      });
    } else if (stats.conceptionRate >= 40) {
      list.push({
        tone: "warn",
        title: "Conception rate is moderate",
        sub: "Review estrus timing window, sire selection, and field execution consistency.",
      });
    } else {
      list.push({
        tone: "bad",
        title: "Conception rate is low",
        sub: "Check animal readiness, technician timing, semen quality, and protocol compliance.",
      });
    }

    if (stats.repeatBreeder > 0) {
      list.push({
        tone: "warn",
        title: `Repeat breeders detected (${stats.repeatBreeder})`,
        sub: "Flag these animals for veterinary review and possible resynchronization.",
      });
    }

    if (stats.open > 0) {
      list.push({
        tone: "warn",
        title: `Open results require follow-up (${stats.open})`,
        sub: "Schedule re-checks or repeat breeding plans for non-pregnant animals.",
      });
    }

    if (stats.aborted > 0) {
      list.push({
        tone: "bad",
        title: `Aborted cases recorded (${stats.aborted})`,
        sub: "Review nutrition, disease risk, stress factors, and clinical history.",
      });
    }

    if (stats.pending > 0) {
      list.push({
        tone: "warn",
        title: `Pending outcomes need monitoring (${stats.pending})`,
        sub: "Continue diagnosis and outcome monitoring for recently checked animals.",
      });
    }

    if (stats.calved > 0 && stats.successRate >= 60) {
      list.push({
        tone: "ok",
        title: "Calving outcome trend is favorable",
        sub: "A healthy portion of confirmed pregnancies already resulted in calving.",
      });
    }

    return list;
  }, [stats]);

  const loading = loadingAI || loadingChecks;

  return (
    <div className="m2">
      <div className="m2-head">
        <div>
          <div className="m2-h1">
            <TrendingUp size={18} /> Breeding Performance
          </div>
          <div className="m2-sub">
            Live Program 2 analytics based on artificial insemination and pregnancy diagnosis records.
          </div>
        </div>
      </div>

      <div className="m2-kpis">
        <div className="m2-kpi">
          <div className="k-label">Total AI</div>
          <div className="k-value">{loading ? "..." : stats.totalAI}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Pregnant</div>
          <div className="k-value">{loading ? "..." : stats.pregnant}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Conception Rate</div>
          <div className="k-value">{loading ? "..." : fmtPct(stats.conceptionRate)}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Success Rate</div>
          <div className="k-value">{loading ? "..." : fmtPct(stats.successRate)}</div>
        </div>
      </div>

      {aiError && (
        <div className="m2-card" style={{ marginBottom: 12 }}>
          <div className="m2-emptyRow">AI records error: {aiError}</div>
        </div>
      )}

      {checksError && (
        <div className="m2-card" style={{ marginBottom: 12 }}>
          <div className="m2-emptyRow">Pregnancy records error: {checksError}</div>
        </div>
      )}

      <div className="m2-card">
        <div className="m2-cardHead">
          <div className="m2-cardTitle">Insights & Flags</div>
          <div className="m2-cardHint">Actionable reminders</div>
        </div>

        <div className="m2-feed">
          {!loading &&
            insights.map((i, idx) => (
              <div key={idx} className={`m2-feedItem ${i.tone}`}>
                <div className="fi-left">
                  <div className="fi-title">
                    {i.tone === "ok" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                    <span>{i.title}</span>
                  </div>
                  <div className="fi-sub">{i.sub}</div>
                </div>
                <div className="fi-date">Live</div>
              </div>
            ))}

          {!loading && insights.length === 0 && (
            <div className="m2-emptyRow">No insights yet.</div>
          )}

          {loading && <div className="m2-emptyRow">Loading performance analytics...</div>}
        </div>

        <div className="m2-split">
          <div className="m2-miniCard">
            <div className="m2-miniTitle">Repeat Breeders</div>
            <div className="m2-miniValue">{loading ? "..." : stats.repeatBreeder}</div>
            <div className="m2-miniSub">Outcome flagged as repeat_breeder</div>
          </div>

          <div className="m2-miniCard">
            <div className="m2-miniTitle">Open Follow-ups</div>
            <div className="m2-miniValue">{loading ? "..." : stats.open}</div>
            <div className="m2-miniSub">Not pregnant and needs follow-up</div>
          </div>

          <div className="m2-miniCard">
            <div className="m2-miniTitle">Calved Outcomes</div>
            <div className="m2-miniValue">{loading ? "..." : stats.calved}</div>
            <div className="m2-miniSub">Successful calving outcome count</div>
          </div>
        </div>

        <div className="m2-split" style={{ marginTop: 12 }}>
          <div className="m2-miniCard">
            <div className="m2-miniTitle">Pending Outcomes</div>
            <div className="m2-miniValue">{loading ? "..." : stats.pending}</div>
            <div className="m2-miniSub">Still under observation</div>
          </div>

          <div className="m2-miniCard">
            <div className="m2-miniTitle">Aborted Cases</div>
            <div className="m2-miniValue">{loading ? "..." : stats.aborted}</div>
            <div className="m2-miniSub">Pregnancy loss records</div>
          </div>

          <div className="m2-miniCard">
            <div className="m2-miniTitle">Open Rate</div>
            <div className="m2-miniValue">
              {loading
                ? "..."
                : fmtPct(stats.totalAI ? (stats.open / stats.totalAI) * 100 : 0)}
            </div>
            <div className="m2-miniSub">Share of AI with open results</div>
          </div>
        </div>
      </div>
    </div>
  );
}