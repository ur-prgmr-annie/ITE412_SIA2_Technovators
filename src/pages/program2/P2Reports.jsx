import { useEffect, useMemo, useState } from "react";
import "../../styles/p1Reports.css";

import {
  BarChart3,
  Download,
  CalendarDays,
  LineChart,
  PieChart,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  FileText,
  Users,
  MapPinned,
} from "lucide-react";

import { db } from "../../services/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toCSV(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const header = keys.map(esc).join(",");
  const body = rows.map((r) => keys.map((k) => esc(r[k])).join(",")).join("\n");
  return header + "\n" + body;
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

function ymd(d) {
  const x = safeDate(d);
  if (!x) return "";
  return x.toISOString().slice(0, 10);
}

function monthShort(d) {
  const x = safeDate(d);
  if (!x) return "";
  return x.toLocaleDateString("en-PH", { month: "short" });
}

function formatDateTimePH(v) {
  const d = safeDate(v);
  if (!d) return "—";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPct(n) {
  const v = Number(n || 0);
  return `${Math.round(v)}%`;
}

function LineChartSVG({ months, series, height = 320 }) {
  return (
    <div className="p1p-chartWrap" aria-label="Monthly trends chart">
      <svg
        className="p1p-chart"
        viewBox="0 0 1000 340"
        preserveAspectRatio="none"
        style={{ height }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="50"
            x2="980"
            y1={40 + i * 35}
            y2={40 + i * 35}
            className="p1p-grid"
          />
        ))}

        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={50 + i * 84.5}
            x2={50 + i * 84.5}
            y1="40"
            y2="320"
            className="p1p-grid"
          />
        ))}

        <line x1="50" x2="50" y1="30" y2="320" className="p1p-axis" />
        <line x1="50" x2="980" y1="320" y2="320" className="p1p-axis" />

        {[80, 60, 40, 20, 0].map((val, i) => (
          <text key={val} x="20" y={80 + i * 60} className="p1p-ytext">
            {val}
          </text>
        ))}

        {months.map((m, i) => (
          <text
            key={m}
            x={50 + i * 84.5}
            y="335"
            className="p1p-xtext"
            textAnchor="middle"
          >
            {m}
          </text>
        ))}

        {(() => {
          const xFor = (i) => 50 + i * 84.5;
          const yFor = (v) => 320 - (v / 80) * 280;
          const toPath = (arr) =>
            arr.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");

          return (
            <>
              {series.map((s) => (
                <path key={s.key} d={toPath(s.data)} className={`p1p-line ${s.colorClass}`} />
              ))}

              {series.map((s) =>
                s.data.map((v, i) => (
                  <circle
                    key={`${s.key}-${i}`}
                    cx={xFor(i)}
                    cy={yFor(v)}
                    r="4"
                    className={`p1p-dot ${s.colorClass}`}
                  />
                ))
              )}
            </>
          );
        })()}
      </svg>
    </div>
  );
}

function Bars({ rows, formatter }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="p1p-bars">
      {rows.map((r) => {
        const pct = Math.round((r.value / max) * 100);
        return (
          <div className="p1p-barRow" key={r.label}>
            <div className="p1p-barLeft">
              <div className="p1p-barLabel">{r.label}</div>
              <div className="p1p-barMeta">{formatter ? formatter(r.value) : r.value}</div>
            </div>
            <div className="p1p-barTrack" aria-hidden="true">
              <div className="p1p-barFill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PercentageBars({ rows }) {
  return (
    <div className="p1p-bars">
      {rows.map((r) => (
        <div className="p1p-barRow" key={r.label}>
          <div className="p1p-barLeft">
            <div className="p1p-barLabel">{r.label}</div>
            <div className="p1p-barMeta">
              {r.value}% ({r.count})
            </div>
          </div>
          <div className="p1p-barTrack" aria-hidden="true">
            <div className="p1p-barFill" style={{ width: `${r.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function P2Reports() {
  const [activeTab, setActiveTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [aiRaw, setAiRaw] = useState([]);
  const [pregnancyRaw, setPregnancyRaw] = useState([]);
  const [estrusRaw, setEstrusRaw] = useState([]);

  useEffect(() => {
    if (from || to) return;
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }, [from, to]);

  useEffect(() => {
    setErr("");
    const qAI = query(collection(db, "program2_ai"), orderBy("aiDate", "desc"));
    const unsub = onSnapshot(
      qAI,
      (snap) => setAiRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setErr("Failed to load AI records.");
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setErr("");
    const qPreg = query(collection(db, "program2_pregnancy"), orderBy("checkDate", "desc"));
    const unsub = onSnapshot(
      qPreg,
      (snap) => setPregnancyRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setErr("Failed to load pregnancy records.");
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setErr("");
    const qEstrus = query(collection(db, "program2_estrus"), orderBy("startDate", "desc"));
    const unsub = onSnapshot(
      qEstrus,
      (snap) => setEstrusRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setErr("Failed to load estrus records.");
      }
    );
    return () => unsub();
  }, []);

  const ai = useMemo(() => {
    const hasFrom = !!from;
    const hasTo = !!to;
    const fromD = hasFrom ? new Date(`${from}T00:00:00`) : null;
    const toD = hasTo ? new Date(`${to}T23:59:59`) : null;

    return aiRaw
      .map((r) => {
        const d = safeDate(r.aiDate || r.date || r.createdAt);
        return {
          ...r,
          _dateObj: d,
          month: monthShort(d),
          barangay: r.barangay || "Unknown",
          species: r.species || "Unknown",
          farmerName: r.farmerName || "—",
          technician: r.technician || "Unknown",
        };
      })
      .filter((r) => {
        if (!r._dateObj) return false;
        if (fromD && r._dateObj < fromD) return false;
        if (toD && r._dateObj > toD) return false;
        return true;
      });
  }, [aiRaw, from, to]);

  const pregnancy = useMemo(() => {
    const hasFrom = !!from;
    const hasTo = !!to;
    const fromD = hasFrom ? new Date(`${from}T00:00:00`) : null;
    const toD = hasTo ? new Date(`${to}T23:59:59`) : null;

    return pregnancyRaw
      .map((r) => {
        const d = safeDate(r.checkDate || r.createdAt);
        return {
          ...r,
          _dateObj: d,
          month: monthShort(d),
          barangay: r.barangay || "Unknown",
          species: r.species || "Unknown",
          farmerName: r.farmerName || "—",
          technician: r.technician || "Unknown",
        };
      })
      .filter((r) => {
        if (!r._dateObj) return false;
        if (fromD && r._dateObj < fromD) return false;
        if (toD && r._dateObj > toD) return false;
        return true;
      });
  }, [pregnancyRaw, from, to]);

  const estrus = useMemo(() => {
    const hasFrom = !!from;
    const hasTo = !!to;
    const fromD = hasFrom ? new Date(`${from}T00:00:00`) : null;
    const toD = hasTo ? new Date(`${to}T23:59:59`) : null;

    return estrusRaw
      .map((r) => {
        const d = safeDate(r.startDate || r.createdAt);
        return {
          ...r,
          _dateObj: d,
          month: monthShort(d),
          barangay: r.barangay || "Unknown",
          species: r.species || "Unknown",
          farmerName: r.farmerName || "—",
        };
      })
      .filter((r) => {
        if (!r._dateObj) return false;
        if (fromD && r._dateObj < fromD) return false;
        if (toD && r._dateObj > toD) return false;
        return true;
      });
  }, [estrusRaw, from, to]);

  const months = useMemo(
    () => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    []
  );

  const lineSeries = useMemo(() => {
    const monthIndex = (m) => months.indexOf(m);

    const estrusPerMonth = Array(12).fill(0);
    const aiPerMonth = Array(12).fill(0);
    const pregPerMonth = Array(12).fill(0);

    for (const s of estrus) {
      const mi = monthIndex(s.month);
      if (mi >= 0) estrusPerMonth[mi] += 1;
    }

    for (const s of ai) {
      const mi = monthIndex(s.month);
      if (mi >= 0) aiPerMonth[mi] += 1;
    }

    for (const s of pregnancy) {
      const mi = monthIndex(s.month);
      if (mi >= 0 && String(s.result).toLowerCase() === "pregnant") pregPerMonth[mi] += 1;
    }

    const max = Math.max(1, ...estrusPerMonth, ...aiPerMonth, ...pregPerMonth);
    const scale = (arr) => arr.map((v) => clamp(Math.round((v / max) * 80), 0, 80));

    return [
      { key: "forest", label: "Estrus Records", colorClass: "forest", data: scale(estrusPerMonth) },
      { key: "mint", label: "AI Records", colorClass: "mint", data: scale(aiPerMonth) },
      { key: "teal", label: "Pregnant Results", colorClass: "teal", data: scale(pregPerMonth) },
    ];
  }, [estrus, ai, pregnancy, months]);

  const metrics = useMemo(() => {
    const totalEstrus = estrus.length;
    const totalAI = ai.length;
    const totalChecks = pregnancy.length;

    const pregnant = pregnancy.filter((c) => String(c.result).toLowerCase() === "pregnant").length;
    const open = pregnancy.filter((c) => String(c.result).toLowerCase() === "open").length;
    const calved = pregnancy.filter((c) => String(c.outcome).toLowerCase() === "calved").length;
    const repeatBreeder = pregnancy.filter(
      (c) => String(c.outcome).toLowerCase() === "repeat_breeder"
    ).length;
    const aborted = pregnancy.filter((c) => String(c.outcome).toLowerCase() === "aborted").length;

    const conceptionRate = totalAI ? (pregnant / totalAI) * 100 : 0;
    const successRate = pregnant ? (calved / pregnant) * 100 : 0;
    const openRate = totalAI ? (open / totalAI) * 100 : 0;
    const estrusToAiRate = totalEstrus ? (totalAI / totalEstrus) * 100 : 0;
    const pregnancyConfirmationRate = totalChecks ? (pregnant / totalChecks) * 100 : 0;
    const repeatBreederRate = totalChecks ? (repeatBreeder / totalChecks) * 100 : 0;
    const abortionRate = totalChecks ? (aborted / totalChecks) * 100 : 0;

    const byBarangay = new Map();
    const bySpecies = new Map();
    const byOutcome = new Map();

    for (const r of estrus) {
      const barangay = r.barangay || "Unknown";
      const species = r.species || "Unknown";
      byBarangay.set(barangay, (byBarangay.get(barangay) || 0) + 1);
      bySpecies.set(species, (bySpecies.get(species) || 0) + 1);
    }

    for (const r of ai) {
      const barangay = r.barangay || "Unknown";
      const species = r.species || "Unknown";
      byBarangay.set(barangay, (byBarangay.get(barangay) || 0) + 1);
      bySpecies.set(species, (bySpecies.get(species) || 0) + 1);
    }

    for (const r of pregnancy) {
      const barangay = r.barangay || "Unknown";
      const species = r.species || "Unknown";
      const outcome = r.outcome || "pending";

      byBarangay.set(barangay, (byBarangay.get(barangay) || 0) + 1);
      bySpecies.set(species, (bySpecies.get(species) || 0) + 1);
      byOutcome.set(outcome, (byOutcome.get(outcome) || 0) + 1);
    }

    const barangayTop = Array.from(byBarangay.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    const speciesTop = Array.from(bySpecies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    const resultRows = [
      { label: "Pregnant", value: pregnant, count: pregnant },
      { label: "Open", value: open, count: open },
    ];

    const outcomeRows = Array.from(byOutcome.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label: String(label).replaceAll("_", " "),
        value,
      }));

    return {
      totalEstrus,
      totalAI,
      totalChecks,
      pregnant,
      open,
      calved,
      repeatBreeder,
      aborted,
      conceptionRate,
      successRate,
      openRate,
      estrusToAiRate,
      pregnancyConfirmationRate,
      repeatBreederRate,
      abortionRate,
      barangayTop,
      speciesTop,
      resultRows,
      outcomeRows,
      topBarangay: barangayTop[0]?.label || "—",
      topBarangayCount: barangayTop[0]?.value || 0,
    };
  }, [estrus, ai, pregnancy]);

  const barangayAnalytics = useMemo(() => {
    const map = new Map();

    for (const r of estrus) {
      const key = r.barangay || "Unknown";
      if (!map.has(key)) {
        map.set(key, {
          barangay: key,
          estrus: 0,
          ai: 0,
          pregnant: 0,
          open: 0,
          calved: 0,
        });
      }
      map.get(key).estrus += 1;
    }

    for (const r of ai) {
      const key = r.barangay || "Unknown";
      if (!map.has(key)) {
        map.set(key, {
          barangay: key,
          estrus: 0,
          ai: 0,
          pregnant: 0,
          open: 0,
          calved: 0,
        });
      }
      map.get(key).ai += 1;
    }

    for (const r of pregnancy) {
      const key = r.barangay || "Unknown";
      if (!map.has(key)) {
        map.set(key, {
          barangay: key,
          estrus: 0,
          ai: 0,
          pregnant: 0,
          open: 0,
          calved: 0,
        });
      }

      if (String(r.result).toLowerCase() === "pregnant") map.get(key).pregnant += 1;
      if (String(r.result).toLowerCase() === "open") map.get(key).open += 1;
      if (String(r.outcome).toLowerCase() === "calved") map.get(key).calved += 1;
    }

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        conceptionRate: r.ai ? Math.round((r.pregnant / r.ai) * 100) : 0,
      }))
      .sort((a, b) => b.ai - a.ai);
  }, [estrus, ai, pregnancy]);

  const technicianAnalytics = useMemo(() => {
    const map = new Map();

    for (const r of ai) {
      const tech = r.technician || "Unknown";
      if (!map.has(tech)) {
        map.set(tech, {
          technician: tech,
          aiCount: 0,
          pregnant: 0,
          open: 0,
          calved: 0,
        });
      }
      map.get(tech).aiCount += 1;
    }

    for (const r of pregnancy) {
      const tech = r.technician || "Unknown";
      if (!map.has(tech)) {
        map.set(tech, {
          technician: tech,
          aiCount: 0,
          pregnant: 0,
          open: 0,
          calved: 0,
        });
      }

      if (String(r.result).toLowerCase() === "pregnant") map.get(tech).pregnant += 1;
      if (String(r.result).toLowerCase() === "open") map.get(tech).open += 1;
      if (String(r.outcome).toLowerCase() === "calved") map.get(tech).calved += 1;
    }

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        conceptionRate: r.aiCount ? Math.round((r.pregnant / r.aiCount) * 100) : 0,
        successRate: r.pregnant ? Math.round((r.calved / r.pregnant) * 100) : 0,
      }))
      .sort((a, b) => b.conceptionRate - a.conceptionRate);
  }, [ai, pregnancy]);

  const aiRows = useMemo(() => {
    return ai
      .slice()
      .sort(
        (a, b) =>
          (safeDate(b.aiDate || b.date)?.getTime() || 0) -
          (safeDate(a.aiDate || a.date)?.getTime() || 0)
      )
      .map((r) => ({
        animalTagId: r.animalTagId || "—",
        species: r.species || "—",
        breed: r.breed || "—",
        color: r.color || "—",
        age: r.age || "—",
        barangay: r.barangay || "—",
        farmerName: r.farmerName || "—",
        aiDate: ymd(r.aiDate || r.date || r._dateObj) || "—",
        noOfStrawUsed: Number(r.noOfStrawUsed || 0),
        sireBreed: r.sireBreed || "—",
        sireCode: r.sireCode || "—",
        technician: r.technician || "—",
      }));
  }, [ai]);

  const pregRows = useMemo(() => {
    return pregnancy
      .slice()
      .sort((a, b) => (safeDate(b.checkDate)?.getTime() || 0) - (safeDate(a.checkDate)?.getTime() || 0))
      .map((r) => ({
        animalTagId: r.animalTagId || "—",
        species: r.species || "—",
        breed: r.breed || "—",
        color: r.color || "—",
        age: r.age || "—",
        barangay: r.barangay || "—",
        farmerName: r.farmerName || "—",
        checkDate: ymd(r.checkDate || r._dateObj) || "—",
        result: r.result || "—",
        outcome: r.outcome || "—",
        notes: r.notes || "—",
        technician: r.technician || "—",
      }));
  }, [pregnancy]);

  const generate = async () => {
    setBusy(true);
    setErr("");
    try {
      await new Promise((r) => setTimeout(r, 450));
    } catch {
      setErr("Failed to generate report.");
    } finally {
      setBusy(false);
    }
  };

  function downloadCSV(filename, rows, fallbackHeader) {
    const csv = rows.length ? toCSV(rows) : fallbackHeader || "";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const exportSummaryCSV = () => {
    const rows = [
      { metric: "Total Estrus", value: metrics.totalEstrus, from: from || "—", to: to || "—" },
      { metric: "Total AI", value: metrics.totalAI, from: from || "—", to: to || "—" },
      { metric: "Total Checks", value: metrics.totalChecks, from: from || "—", to: to || "—" },
      { metric: "Pregnant", value: metrics.pregnant, from: from || "—", to: to || "—" },
      { metric: "Open", value: metrics.open, from: from || "—", to: to || "—" },
      { metric: "Calved", value: metrics.calved, from: from || "—", to: to || "—" },
      { metric: "Repeat Breeder", value: metrics.repeatBreeder, from: from || "—", to: to || "—" },
      { metric: "Aborted", value: metrics.aborted, from: from || "—", to: to || "—" },
      { metric: "Conception Rate", value: fmtPct(metrics.conceptionRate), from: from || "—", to: to || "—" },
      { metric: "Success Rate", value: fmtPct(metrics.successRate), from: from || "—", to: to || "—" },
      { metric: "Estrus to AI Rate", value: fmtPct(metrics.estrusToAiRate), from: from || "—", to: to || "—" },
      {
        metric: "Pregnancy Confirmation Rate",
        value: fmtPct(metrics.pregnancyConfirmationRate),
        from: from || "—",
        to: to || "—",
      },
      {
        metric: "Repeat Breeder Rate",
        value: fmtPct(metrics.repeatBreederRate),
        from: from || "—",
        to: to || "—",
      },
      {
        metric: "Abortion Rate",
        value: fmtPct(metrics.abortionRate),
        from: from || "—",
        to: to || "—",
      },
    ];

    downloadCSV(
      `p2_reports_summary_${from || "all"}_${to || "all"}.csv`,
      rows,
      "metric,value,from,to\n"
    );
  };

  const exportAIRecordsCSV = () => {
    downloadCSV(
      `p2_ai_records_${from || "all"}_${to || "all"}.csv`,
      aiRows,
      "animalTagId,species,breed,color,age,barangay,farmerName,aiDate,noOfStrawUsed,sireBreed,sireCode,technician\n"
    );
  };

  const exportPregnancyCSV = () => {
    downloadCSV(
      `p2_pregnancy_records_${from || "all"}_${to || "all"}.csv`,
      pregRows,
      "animalTagId,species,breed,color,age,barangay,farmerName,checkDate,result,outcome,notes,technician\n"
    );
  };

  const exportBarangayAnalyticsCSV = () => {
    downloadCSV(
      `p2_barangay_analytics_${from || "all"}_${to || "all"}.csv`,
      barangayAnalytics,
      "barangay,estrus,ai,pregnant,open,calved,conceptionRate\n"
    );
  };

  const exportTechnicianCSV = () => {
    downloadCSV(
      `p2_technician_performance_${from || "all"}_${to || "all"}.csv`,
      technicianAnalytics,
      "technician,aiCount,pregnant,open,calved,conceptionRate,successRate\n"
    );
  };

  const exportJSON = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      from: from || null,
      to: to || null,
      summary: metrics,
      barangayAnalytics,
      technicianAnalytics,
      aiRecords: aiRows,
      pregnancyRecords: pregRows,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `p2_reports_${from || "all"}_${to || "all"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDFReport = () => {
    const pdf = new jsPDF({ orientation: "landscape" });
    const fileName = `p2_reports_${from || "all"}_${to || "all"}.pdf`;

    pdf.setFontSize(14);
    pdf.text("REPORTS & ANALYTICS — PROGRAM 2", 14, 14);

    pdf.setFontSize(10);
    const meta = [
      `Generated: ${formatDateTimePH(new Date())}`,
      `Date Range: ${from || "—"} to ${to || "—"}`,
      `Estrus Records: ${metrics.totalEstrus}`,
      `AI Records: ${metrics.totalAI}`,
      `Pregnancy Checks: ${metrics.totalChecks}`,
      `Pregnant: ${metrics.pregnant} | Open: ${metrics.open}`,
      `Conception Rate: ${fmtPct(metrics.conceptionRate)} | Success Rate: ${fmtPct(metrics.successRate)}`,
      `Estrus to AI Rate: ${fmtPct(metrics.estrusToAiRate)}`,
      `Pregnancy Confirmation Rate: ${fmtPct(metrics.pregnancyConfirmationRate)}`,
      `Repeat Breeder Rate: ${fmtPct(metrics.repeatBreederRate)} | Abortion Rate: ${fmtPct(metrics.abortionRate)}`,
    ];

    let y = 22;
    meta.forEach((line) => {
      pdf.text(line, 14, y);
      y += 5;
    });

    autoTable(pdf, {
      startY: y + 2,
      head: [["Metric", "Value"]],
      body: [
        ["Total Estrus", String(metrics.totalEstrus)],
        ["Total AI", String(metrics.totalAI)],
        ["Total Pregnancy Checks", String(metrics.totalChecks)],
        ["Pregnant", String(metrics.pregnant)],
        ["Open", String(metrics.open)],
        ["Calved", String(metrics.calved)],
        ["Repeat Breeder", String(metrics.repeatBreeder)],
        ["Aborted", String(metrics.aborted)],
        ["Conception Rate", fmtPct(metrics.conceptionRate)],
        ["Success Rate", fmtPct(metrics.successRate)],
        ["Open Rate", fmtPct(metrics.openRate)],
        ["Estrus to AI Rate", fmtPct(metrics.estrusToAiRate)],
        ["Pregnancy Confirmation Rate", fmtPct(metrics.pregnancyConfirmationRate)],
        ["Repeat Breeder Rate", fmtPct(metrics.repeatBreederRate)],
        ["Abortion Rate", fmtPct(metrics.abortionRate)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fontStyle: "bold" },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });

    const barangayRows = barangayAnalytics.map((r) => [
      r.barangay,
      String(r.estrus),
      String(r.ai),
      String(r.pregnant),
      String(r.open),
      String(r.calved),
      `${r.conceptionRate}%`,
    ]);

    if (barangayRows.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [["Barangay", "Estrus", "AI", "Pregnant", "Open", "Calved", "Conception Rate"]],
        body: barangayRows,
        styles: { fontSize: 9 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
    }

    const technicianRows = technicianAnalytics.map((r) => [
      r.technician,
      String(r.aiCount),
      String(r.pregnant),
      String(r.open),
      String(r.calved),
      `${r.conceptionRate}%`,
      `${r.successRate}%`,
    ]);

    if (technicianRows.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [["Technician", "AI Count", "Pregnant", "Open", "Calved", "Conception Rate", "Success Rate"]],
        body: technicianRows,
        styles: { fontSize: 9 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
    }

    const aiTableRows = aiRows.slice(0, 40).map((r) => [
      r.animalTagId,
      r.species,
      r.breed,
      r.color,
      r.age,
      r.barangay,
      r.farmerName,
      r.aiDate,
      String(r.noOfStrawUsed),
      r.sireBreed,
      r.sireCode,
      r.technician,
    ]);

    autoTable(pdf, {
      startY: pdf.lastAutoTable.finalY + 8,
      head: [[
        "Animal Tag",
        "Species",
        "Breed",
        "Color",
        "Age",
        "Barangay",
        "Farmer",
        "AI Date",
        "Straw Used",
        "Sire Breed",
        "Sire Code",
        "Technician",
      ]],
      body: aiTableRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fontStyle: "bold" },
      theme: "grid",
      margin: { left: 10, right: 10 },
    });

    if (pregRows.length) {
      const pregTableRows = pregRows.slice(0, 40).map((r) => [
        r.animalTagId,
        r.species,
        r.breed,
        r.color,
        r.age,
        r.barangay,
        r.farmerName,
        r.checkDate,
        r.result,
        String(r.outcome).replaceAll("_", " "),
        r.technician,
        r.notes,
      ]);

      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 8,
        head: [[
          "Animal Tag",
          "Species",
          "Breed",
          "Color",
          "Age",
          "Barangay",
          "Farmer",
          "Check Date",
          "Result",
          "Outcome",
          "Technician",
          "Notes",
        ]],
        body: pregTableRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 10, right: 10 },
      });
    }

    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pdf.internal.pageSize.getWidth() - 30,
        pdf.internal.pageSize.getHeight() - 8
      );
    }

    pdf.save(fileName);
  };

  return (
    <div className="p1p p1p-font">
      <div className="p1p-head">
        <div className="p1p-headLeft">
          <div className="p1p-h1">Reports & Analytics</div>
          <div className="p1p-sub">
            Program 2 breeding reports with live graphs, summaries, rankings, and downloadable files.
          </div>
        </div>

        <div className="p1p-headRight">
          <button className="p1p-primary" onClick={generate} disabled={busy} type="button">
            <BarChart3 size={18} /> {busy ? "Generating…" : "Generate"}
          </button>

          <button
            className="p1p-ghost"
            onClick={exportPDFReport}
            disabled={busy}
            type="button"
            title="Export PDF report"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {err ? <div className="p1p-error">{err}</div> : null}

      <div className="p1p-tabs">
        <button
          className={`p1p-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
          type="button"
        >
          <LineChart size={16} /> Overview
        </button>
        <button
          className={`p1p-tab ${activeTab === "records" ? "active" : ""}`}
          onClick={() => setActiveTab("records")}
          type="button"
        >
          <PieChart size={16} /> Records
        </button>
        <button
          className={`p1p-tab ${activeTab === "geographic" ? "active" : ""}`}
          onClick={() => setActiveTab("geographic")}
          type="button"
        >
          <MapPinned size={16} /> Geographic
        </button>
        <button
          className={`p1p-tab ${activeTab === "technicians" ? "active" : ""}`}
          onClick={() => setActiveTab("technicians")}
          type="button"
        >
          <Users size={16} /> Technicians
        </button>
        <button
          className={`p1p-tab ${activeTab === "exports" ? "active" : ""}`}
          onClick={() => setActiveTab("exports")}
          type="button"
        >
          <ClipboardList size={16} /> Exports
        </button>
      </div>

      <div className="p1p-controls">
        <div className="p1p-date">
          <CalendarDays size={16} />
          <div className="p1p-dateGrid">
            <div>
              <label>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="p1p-hint">
          Live data: Estrus + AI + Pregnancy Diagnosis. Date range filters analytics and exports.
        </div>
      </div>

      <div className="p1p-kpiGrid">
        <div className="p1p-kpi">
          <div className="p1p-k">Estrus Records</div>
          <div className="p1p-v">{metrics.totalEstrus}</div>
          <div className="p1p-s">Selected range</div>
        </div>

        <div className="p1p-kpi">
          <div className="p1p-k">AI Records</div>
          <div className="p1p-v">{metrics.totalAI}</div>
          <div className="p1p-s">Selected range</div>
        </div>

        <div className="p1p-kpi">
          <div className="p1p-k">Pregnant</div>
          <div className="p1p-v">{metrics.pregnant}</div>
          <div className="p1p-s">Open: {metrics.open}</div>
        </div>

        <div className="p1p-kpi">
          <div className="p1p-k">Conception Rate</div>
          <div className="p1p-v">{fmtPct(metrics.conceptionRate)}</div>
          <div className="p1p-s">Pregnant / Total AI</div>
        </div>

        <div className="p1p-kpi">
          <div className="p1p-k">Success Rate</div>
          <div className="p1p-v">{fmtPct(metrics.successRate)}</div>
          <div className="p1p-s">Calved / Pregnant</div>
        </div>

        <div className="p1p-kpi">
          <div className="p1p-k">Estrus → AI Rate</div>
          <div className="p1p-v">{fmtPct(metrics.estrusToAiRate)}</div>
          <div className="p1p-s">AI / Estrus</div>
        </div>

        <div className="p1p-kpi">
          <div className="p1p-k">Pregnancy Confirmation</div>
          <div className="p1p-v">{fmtPct(metrics.pregnancyConfirmationRate)}</div>
          <div className="p1p-s">Pregnant / Checks</div>
        </div>

        <div className="p1p-kpi">
          <div className="p1p-k">Repeat Breeder Rate</div>
          <div className="p1p-v">{fmtPct(metrics.repeatBreederRate)}</div>
          <div className="p1p-s">Repeat breeder / Checks</div>
        </div>
      </div>

      {metrics.repeatBreeder > 0 || metrics.aborted > 0 ? (
        <div className="p1p-error" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} />
          <span>
            Breeding alerts: <b>{metrics.repeatBreeder}</b> repeat breeder case(s), <b>{metrics.aborted}</b> aborted
            case(s).
          </span>
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <>
          <div className="p1p-layout">
            <div className="p1p-card">
              <div className="p1p-cardHead">
                <div>
                  <div className="p1p-title">Monthly Trends</div>
                  <div className="p1p-muted">Estrus, AI, and pregnant results in selected range</div>
                </div>

                <div className="p1p-legend">
                  {lineSeries.map((s) => (
                    <div key={s.key} className="p1p-legItem">
                      <span className={`p1p-legDot ${s.colorClass}`} />
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>

              <LineChartSVG months={months} series={lineSeries} />
            </div>

            <div className="p1p-side">
              <div className="p1p-card">
                <div className="p1p-title">Pregnancy Result Status</div>
                <div className="p1p-muted">Pregnant vs open</div>

                <PercentageBars
                  rows={[
                    {
                      label: "Pregnant",
                      value: metrics.totalChecks
                        ? Math.round((metrics.pregnant / metrics.totalChecks) * 1000) / 10
                        : 0,
                      count: metrics.pregnant,
                    },
                    {
                      label: "Open",
                      value: metrics.totalChecks
                        ? Math.round((metrics.open / metrics.totalChecks) * 1000) / 10
                        : 0,
                      count: metrics.open,
                    },
                  ]}
                />
              </div>

              <div className="p1p-card">
                <div className="p1p-title">Pregnancy Outcomes</div>
                <div className="p1p-muted">Outcome distribution</div>
                <Bars rows={metrics.outcomeRows.slice(0, 6)} />
              </div>
            </div>
          </div>

          <div className="p1p-grid2">
            <div className="p1p-card">
              <div className="p1p-title">Top Barangays</div>
              <table className="p1p-table">
                <thead>
                  <tr>
                    <th>Barangay</th>
                    <th>Total Records</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.barangayTop.map((r) => (
                    <tr key={r.label}>
                      <td>
                        <b>{r.label}</b>
                      </td>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                  {metrics.barangayTop.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p1p-empty">
                        No data yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="p1p-card">
              <div className="p1p-title">Species Distribution</div>
              <table className="p1p-table">
                <thead>
                  <tr>
                    <th>Species</th>
                    <th>Total Records</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.speciesTop.map((r) => (
                    <tr key={r.label}>
                      <td>
                        <b>{r.label}</b>
                      </td>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                  {metrics.speciesTop.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p1p-empty">
                        No data yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "records" ? (
        <div className="p1p-layout" style={{ marginTop: 12 }}>
          <div className="p1p-card">
            <div className="p1p-title">AI Records</div>
            <div className="p1p-muted">Records inside the selected date range</div>

            <table className="p1p-table">
              <thead>
                <tr>
                  <th>AI Date</th>
                  <th>Animal Tag</th>
                  <th>Species</th>
                  <th>Breed</th>
                  <th>Color</th>
                  <th>Age</th>
                  <th>Barangay</th>
                  <th>Farmer</th>
                  <th>Straw Used</th>
                  <th>Sire Breed</th>
                  <th>Sire Code</th>
                  <th>Technician</th>
                </tr>
              </thead>
              <tbody>
                {aiRows.slice(0, 50).map((r, i) => (
                  <tr key={`${r.animalTagId}-${r.aiDate}-${i}`}>
                    <td>
                      <b>{r.aiDate}</b>
                    </td>
                    <td>{r.animalTagId}</td>
                    <td>{r.species}</td>
                    <td>{r.breed}</td>
                    <td>{r.color}</td>
                    <td>{r.age}</td>
                    <td>{r.barangay}</td>
                    <td>{r.farmerName}</td>
                    <td>{r.noOfStrawUsed}</td>
                    <td>{r.sireBreed}</td>
                    <td>{r.sireCode}</td>
                    <td>{r.technician}</td>
                  </tr>
                ))}
                {aiRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p1p-empty">
                      No AI records in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="p1p-side">
            <div className="p1p-card">
              <div className="p1p-title">Records by Barangay</div>
              <div className="p1p-muted">Distribution in selected range</div>
              <Bars rows={metrics.barangayTop.slice(0, 8)} />
            </div>

            <div className="p1p-card">
              <div className="p1p-title">Records by Species</div>
              <div className="p1p-muted">Species coverage across Program 2</div>
              <Bars rows={metrics.speciesTop} />
            </div>

            <div className="p1p-card">
              <div className="p1p-title">Technician Ranking</div>
              <div className="p1p-muted">Top by conception rate</div>
              <Bars
                rows={technicianAnalytics.slice(0, 6).map((r) => ({
                  label: r.technician,
                  value: r.conceptionRate,
                }))}
                formatter={(v) => `${v}%`}
              />
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "geographic" ? (
        <>
          <div className="p1p-layout" style={{ marginTop: 12 }}>
            <div className="p1p-card">
              <div className="p1p-title">Barangay Program Density</div>
              <div className="p1p-muted">Counts by barangay within selected date range</div>

              <Bars rows={metrics.barangayTop} />
            </div>

            <div className="p1p-side">
              <div className="p1p-card">
                <div className="p1p-title">Top Barangay</div>
                <div className="p1p-muted">Highest total program records in current range</div>
                <div className="p1p-v" style={{ marginTop: 12 }}>
                  {metrics.topBarangay}
                </div>
                <div className="p1p-s">{metrics.topBarangayCount} total record(s)</div>
              </div>

              <div className="p1p-card">
                <div className="p1p-title">Open Follow-ups</div>
                <div className="p1p-muted">Needs reschedule or recheck</div>
                <div className="p1p-v" style={{ marginTop: 12 }}>
                  {metrics.open}
                </div>
                <div className="p1p-s">{fmtPct(metrics.openRate)} of AI records</div>
              </div>
            </div>
          </div>

          <div className="p1p-card" style={{ marginTop: 12 }}>
            <div className="p1p-title">Barangay Performance Heat Table</div>
            <table className="p1p-table">
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>Estrus</th>
                  <th>AI</th>
                  <th>Pregnant</th>
                  <th>Open</th>
                  <th>Calved</th>
                  <th>Conception Rate</th>
                </tr>
              </thead>
              <tbody>
                {barangayAnalytics.map((r) => (
                  <tr key={r.barangay}>
                    <td>
                      <b>{r.barangay}</b>
                    </td>
                    <td>{r.estrus}</td>
                    <td>{r.ai}</td>
                    <td>{r.pregnant}</td>
                    <td>{r.open}</td>
                    <td>{r.calved}</td>
                    <td>{r.conceptionRate}%</td>
                  </tr>
                ))}
                {barangayAnalytics.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p1p-empty">
                      No barangay data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {activeTab === "technicians" ? (
        <div className="p1p-card" style={{ marginTop: 12 }}>
          <div className="p1p-title">Technician Performance Ranking</div>
          <div className="p1p-muted">Based on AI and pregnancy diagnosis outcomes</div>

          <table className="p1p-table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>AI Count</th>
                <th>Pregnant</th>
                <th>Open</th>
                <th>Calved</th>
                <th>Conception Rate</th>
                <th>Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {technicianAnalytics.map((r) => (
                <tr key={r.technician}>
                  <td>
                    <b>{r.technician}</b>
                  </td>
                  <td>{r.aiCount}</td>
                  <td>{r.pregnant}</td>
                  <td>{r.open}</td>
                  <td>{r.calved}</td>
                  <td>{r.conceptionRate}%</td>
                  <td>{r.successRate}%</td>
                </tr>
              ))}
              {technicianAnalytics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p1p-empty">
                    No technician data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "exports" ? (
        <div className="p1p-card" style={{ marginTop: 12 }}>
          <div className="p1p-title">Exports</div>
          <div className="p1p-muted">All exports respect the selected date range.</div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="p1p-primary" type="button" onClick={exportSummaryCSV} disabled={busy}>
              <Download size={18} /> Export Summary (CSV)
            </button>

            <button className="p1p-ghost" type="button" onClick={exportAIRecordsCSV} disabled={busy}>
              <ClipboardList size={18} /> Export AI Records (CSV)
            </button>

            <button className="p1p-ghost" type="button" onClick={exportPregnancyCSV} disabled={busy}>
              <ClipboardList size={18} /> Export Pregnancy Records (CSV)
            </button>

            <button className="p1p-ghost" type="button" onClick={exportBarangayAnalyticsCSV} disabled={busy}>
              <MapPinned size={18} /> Export Barangay Analytics (CSV)
            </button>

            <button className="p1p-ghost" type="button" onClick={exportTechnicianCSV} disabled={busy}>
              <Users size={18} /> Export Technician Ranking (CSV)
            </button>

            <button className="p1p-ghost" type="button" onClick={exportPDFReport} disabled={busy}>
              <FileText size={18} /> Export Full Report (PDF)
            </button>

            <button className="p1p-ghost" type="button" onClick={exportJSON} disabled={busy}>
              <FileText size={18} /> Export JSON Backup
            </button>
          </div>

          <div className="p1p-note" style={{ marginTop: 12 }}>
            Exports available: <b>{aiRows.length}</b> AI record(s), <b>{pregRows.length}</b> pregnancy record(s),{" "}
            <b>{barangayAnalytics.length}</b> barangay row(s), <b>{technicianAnalytics.length}</b> technician row(s).
          </div>
        </div>
      ) : null}
    </div>
  );
}