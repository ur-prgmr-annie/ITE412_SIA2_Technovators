// src/pages/program1/P1Reports.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import "../../styles/p1Reports.css";

import {
  BarChart3,
  Download,
  CalendarDays,
  LineChart,
  PieChart,
  MapPinned,
  ClipboardList,
  Package,
  AlertTriangle,
  FileText,
  Users,
} from "lucide-react";

import { db } from "../../services/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ========== HELPERS (unchanged) ==========
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
  const d = v?.toDate?.() ? v.toDate() : new Date(v);
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

function money(n) {
  const x = Number(n || 0);
  return `₱${x.toLocaleString("en-PH", {
    minimumFractionDigits: x % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// ========== EXPORT DROPDOWN (replaces modal) ==========
function ExportDropdown({ onExport, busy, selectedFarmer }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [
    { id: "services", label: "Services (CSV)", desc: "Full service records with fees" },
    { id: "barangay", label: "Barangay Summary (CSV)", desc: "Counts and fees per barangay" },
    { id: "type", label: "Service Type Summary (CSV)", desc: "Counts and fees per service type" },
    { id: "pdf_full", label: "Full Report (PDF)", desc: "Comprehensive PDF with all sections" },
    { id: "farmer_individual", label: "Individual Farmer Report (PDF)", desc: "Complete report for selected farmer" },
    { id: "farmer_all", label: "All Farmers Summary (CSV)", desc: "Summary stats for all farmers" },
  ];

  const handleOptionClick = (id) => {
    setOpen(false);
    onExport(id);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={dropdownRef}>
      <button
        className="p1p-primary"
        onClick={() => setOpen(!open)}
        disabled={busy}
        type="button"
        style={{ padding: "10px 16px" }}
      >
        <Download size={18} /> Export {open ? "▲" : "▼"}
      </button>
      {open && !busy && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            minWidth: "240px",
            maxWidth: "300px",
            overflow: "hidden",
            padding: "4px 0",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleOptionClick(opt.id)}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 16px",
                border: "none",
                background: "white",
                textAlign: "left",
                fontSize: "0.8rem",
                cursor: "pointer",
                color: "#1e293b",
                transition: "background 0.15s",
                fontFamily: "inherit",
                borderBottom: "1px solid #f1f5f9",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              <div style={{ fontWeight: 500 }}>{opt.label}</div>
              <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== INLINE CHARTS (unchanged) ==========
function LineChartSVG({ months, series, height = 320 }) {
  // ... (same as before)
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

// ========== MAIN COMPONENT ==========
export default function P1Reports() {
  const [activeTab, setActiveTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Data
  const [animals, setAnimals] = useState([]);
  const [servicesRaw, setServicesRaw] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [farmers, setFarmers] = useState([]);

  // Farmer report selection
  const [selectedFarmerId, setSelectedFarmerId] = useState("");

  // ========== LOAD DATA ==========
  useEffect(() => {
    if (from || to) return;
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }, [from, to]);

  useEffect(() => {
    const qA = query(collection(db, "program1_animals"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qA,
      (snap) => setAnimals(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => { console.error(e); setErr("Failed to load animals."); }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const qS = query(collection(db, "program1_routine_services"), orderBy("date", "desc"));
    const unsub = onSnapshot(
      qS,
      (snap) => setServicesRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => { console.error(e); setErr("Failed to load service records."); }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const qI = query(collection(db, "p1_inventory_batches"), orderBy("expiryDate", "asc"));
    const unsub = onSnapshot(
      qI,
      (snap) => setInventoryBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error(e)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const qF = query(collection(db, "program1_farmers"), orderBy("lastName", "asc"));
    const unsub = onSnapshot(
      qF,
      (snap) => setFarmers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error(e)
    );
    return () => unsub();
  }, []);

  // ========== SERVICES (filtered by date) ==========
  const services = useMemo(() => {
    const normalized = servicesRaw.map((s) => {
      const activity = s.activity || s.type || "Unknown";
      const barangay = s.barangay || s.farmBarangay || "Unknown";
      const d = safeDate(s.date);
      const month = d ? monthShort(d) : "";
      return {
        ...s,
        type: activity,
        barangay,
        month,
        serviceFee: Number(s.serviceFee || 0),
        feeCategory: s.feeCategory || "",
        dewormingType: s.dewormingType || "",
        _dateObj: d,
      };
    });

    const hasFrom = !!from;
    const hasTo = !!to;
    const fromD = hasFrom ? new Date(from + "T00:00:00") : null;
    const toD = hasTo ? new Date(to + "T23:59:59") : null;

    return normalized.filter((s) => {
      if (!s._dateObj) return false;
      if (fromD && s._dateObj < fromD) return false;
      if (toD && s._dateObj > toD) return false;
      return true;
    });
  }, [servicesRaw, from, to]);

  // ========== MONTHS ==========
  const months = useMemo(
    () => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    []
  );

  // ========== LINE SERIES ==========
  const lineSeries = useMemo(() => {
    const monthIndex = (m) => months.indexOf(m);
    const totalPerMonth = Array(12).fill(0);
    const vaxPerMonth = Array(12).fill(0);
    const followPerMonth = Array(12).fill(0);

    for (const s of services) {
      const mi = monthIndex(s.month);
      if (mi < 0) continue;
      totalPerMonth[mi] += 1;
      const act = String(s.type || "").toLowerCase();
      if (act.includes("vaccin")) vaxPerMonth[mi] += 1;
      const hasFU = !!s.followUpDate || !!s.followUp || !!s.nextVisit;
      const pendingish = String(s.status || "").toLowerCase() === "pending";
      if (hasFU || pendingish) followPerMonth[mi] += 1;
    }

    const max = Math.max(1, ...totalPerMonth, ...vaxPerMonth, ...followPerMonth);
    const scale = (arr) => arr.map((v) => clamp(Math.round((v / max) * 80), 0, 80));

    return [
      { key: "forest", label: "Service Events", colorClass: "forest", data: scale(totalPerMonth) },
      { key: "mint", label: "Vaccinations", colorClass: "mint", data: scale(vaxPerMonth) },
      { key: "teal", label: "Follow-ups", colorClass: "teal", data: scale(followPerMonth) },
    ];
  }, [services, months]);

  // ========== METRICS ==========
  const metrics = useMemo(() => {
    const totalAnimals = animals.length;
    const totalServices = services.length;
    const totalFees = services.reduce((sum, s) => sum + Number(s.serviceFee || 0), 0);

    const byBarangay = new Map();
    const feesByBarangay = new Map();
    for (const s of services) {
      const b = s.barangay || "Unknown";
      byBarangay.set(b, (byBarangay.get(b) || 0) + 1);
      feesByBarangay.set(b, (feesByBarangay.get(b) || 0) + Number(s.serviceFee || 0));
    }
    const barangayTop = Array.from(byBarangay.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
    const barangayFeesTop = Array.from(feesByBarangay.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value: Math.round((value + Number.EPSILON) * 100) / 100 }));

    const byType = new Map();
    const feesByType = new Map();
    for (const s of services) {
      let t = s.type || "Unknown";
      if (t === "Deworming" && s.dewormingType) {
        t = `${t} (${s.dewormingType === "large" ? "Large Ruminant" : "Small Ruminant"})`;
      }
      byType.set(t, (byType.get(t) || 0) + 1);
      feesByType.set(t, (feesByType.get(t) || 0) + Number(s.serviceFee || 0));
    }
    const typeTop = Array.from(byType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
    const feeTypeTop = Array.from(feesByType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value: Math.round((value + Number.EPSILON) * 100) / 100 }));

    const vaccinationServices = services.filter((s) =>
      String(s.type || "").toLowerCase().includes("vaccin")
    );
    const vaccination = vaccinationServices.length;
    const vaccinatedRegistered = vaccinationServices.filter(
      (s) => String(s.animalRegistered || "").toLowerCase() === "yes"
    ).length;
    const vaccinatedNotRegistered = vaccinationServices.filter(
      (s) => String(s.animalRegistered || "").toLowerCase() === "no"
    ).length;
    const vaccinatedRegisteredPct = vaccination
      ? Math.round((vaccinatedRegistered / vaccination) * 1000) / 10
      : 0;
    const vaccinatedNotRegisteredPct = vaccination
      ? Math.round((vaccinatedNotRegistered / vaccination) * 1000) / 10
      : 0;

    const vaccinatedSet = new Set(
      vaccinationServices
        .map((s) => s.animalId || s.animalTagId || s.tagId)
        .filter(Boolean)
    );
    const vaxRate = totalServices ? Math.round((vaccination / totalServices) * 1000) / 10 : 0;
    const avgFeePerService = totalServices ? Math.round((totalFees / totalServices + Number.EPSILON) * 100) / 100 : 0;

    const today = new Date();
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);
    let invUnits = 0;
    let lowStock = 0;
    let expiringSoon = 0;
    for (const b of inventoryBatches) {
      const qty = Number(b.qtyOnHand || 0);
      invUnits += qty;
      const rp = Number(b.reorderPoint ?? 10);
      if (qty > 0 && qty <= rp) lowStock++;
      if (b.expiryDate) {
        const ex = safeDate(b.expiryDate);
        if (ex && ex <= threeMonths && ex >= new Date(today.toISOString().slice(0, 10))) {
          expiringSoon++;
        }
      }
    }

    const topB = barangayTop[0]?.label || "—";
    const topBCount = barangayTop[0]?.value || 0;

    return {
      totalAnimals,
      totalServices,
      totalFees: Math.round((totalFees + Number.EPSILON) * 100) / 100,
      avgFeePerService,
      barangayTop,
      barangayFeesTop,
      typeTop,
      feeTypeTop,
      vaccination,
      vaccinatedSetSize: vaccinatedSet.size,
      vaxRate,
      vaccinatedRegistered,
      vaccinatedNotRegistered,
      vaccinatedRegisteredPct,
      vaccinatedNotRegisteredPct,
      invUnits: Math.round((invUnits + Number.EPSILON) * 100) / 100,
      lowStock,
      expiringSoon,
      topB,
      topBCount,
    };
  }, [animals, services, inventoryBatches]);

  // ========== FARMER REPORT DATA ==========
  const selectedFarmer = useMemo(() => {
    return farmers.find((f) => f.id === selectedFarmerId) || null;
  }, [farmers, selectedFarmerId]);

  const farmerAnimals = useMemo(() => {
    if (!selectedFarmer) return [];
    return animals.filter((a) => a.farmerId === selectedFarmer.id);
  }, [animals, selectedFarmer]);

  const farmerServiceIds = useMemo(() => {
    const animalIds = new Set(farmerAnimals.map((a) => a.id));
    const serviceIds = new Set();
    for (const s of services) {
      if (s.animalId && animalIds.has(s.animalId)) {
        serviceIds.add(s.id);
      }
    }
    return serviceIds;
  }, [farmerAnimals, services]);

  const farmerServices = useMemo(() => {
    return services.filter((s) => farmerServiceIds.has(s.id));
  }, [services, farmerServiceIds]);

  const farmerMetrics = useMemo(() => {
    if (!selectedFarmer) return null;
    const totalAnimals = farmerAnimals.length;
    const totalServices = farmerServices.length;
    const totalFees = farmerServices.reduce((sum, s) => sum + Number(s.serviceFee || 0), 0);
    const bySpecies = {};
    for (const a of farmerAnimals) {
      const sp = a.species === "Other" ? a.speciesOther || "Other" : a.species || "Unknown";
      bySpecies[sp] = (bySpecies[sp] || 0) + 1;
    }
    const byServiceType = {};
    for (const s of farmerServices) {
      const t = s.type || "Unknown";
      byServiceType[t] = (byServiceType[t] || 0) + 1;
    }
    return {
      totalAnimals,
      totalServices,
      totalFees: Math.round((totalFees + Number.EPSILON) * 100) / 100,
      bySpecies,
      byServiceType,
    };
  }, [selectedFarmer, farmerAnimals, farmerServices]);

  // ========== EXPORT HANDLERS ==========
  const downloadCSV = (filename, rows, fallbackHeader) => {
    const csv = rows.length ? toCSV(rows) : fallbackHeader || "";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportServicesCSV = () => {
    const flat = services.map((s) => ({
      id: s.id,
      date: ymd(s._dateObj) || s.date || "—",
      activity: s.type === "Deworming" && s.dewormingType
        ? `${s.type} (${s.dewormingType === "large" ? "Large Ruminant" : "Small Ruminant"})`
        : s.type || "—",
      barangay: s.barangay || "—",
      species: s.species === "Other" ? s.speciesOther || "Other" : s.species || "—",
      heads: Number(s.heads || 1),
      fee: Number(s.serviceFee || 0),
      feeCategory: s.feeCategory || "—",
      animalRegistered: s.animalRegistered || "—",
      status: s.status || "—",
      performedBy: s.performedBy || "—",
      from: from || "—",
      to: to || "—",
    }));
    downloadCSV(
      `p1_reports_services_${from || "all"}_${to || "all"}.csv`,
      flat,
      "id,date,activity,barangay,species,heads,fee,feeCategory,animalRegistered,status,performedBy,from,to\n"
    );
  };

  const exportBarangayCSV = () => {
    const rows = metrics.barangayTop.map((r) => {
      const feeMatch = metrics.barangayFeesTop.find((x) => x.label === r.label);
      return {
        barangay: r.label,
        count: r.value,
        totalFees: feeMatch?.value || 0,
        from: from || "—",
        to: to || "—",
      };
    });
    downloadCSV(
      `p1_reports_barangays_${from || "all"}_${to || "all"}.csv`,
      rows,
      "barangay,count,totalFees,from,to\n"
    );
  };

  const exportTypeCSV = () => {
    const rows = metrics.typeTop.map((r) => {
      const feeMatch = metrics.feeTypeTop.find((x) => x.label === r.label);
      return {
        type: r.label,
        count: r.value,
        totalFees: feeMatch?.value || 0,
        from: from || "—",
        to: to || "—",
      };
    });
    downloadCSV(
      `p1_reports_service_types_${from || "all"}_${to || "all"}.csv`,
      rows,
      "type,count,totalFees,from,to\n"
    );
  };

  const exportPDFReport = () => {
    const pdf = new jsPDF({ orientation: "landscape" });
    const fileName = `p1_reports_${from || "all"}_${to || "all"}.pdf`;

    pdf.setFontSize(14);
    pdf.text("REPORTS & ANALYTICS — PROGRAM 1", 14, 14);
    pdf.setFontSize(10);
    const meta = [
      `Generated: ${formatDateTimePH(new Date())}`,
      `Date Range: ${from || "—"} to ${to || "—"}`,
      `Registered Animals: ${metrics.totalAnimals}`,
      `Service Records: ${metrics.totalServices}`,
      `Vaccinations: ${metrics.vaccination} (${metrics.vaxRate}%)`,
      `Vaccinated Registered: ${metrics.vaccinatedRegisteredPct}%`,
      `Vaccinated Not Registered: ${metrics.vaccinatedNotRegisteredPct}%`,
      `Total Fees: ${money(metrics.totalFees)} | Average per Service: ${money(metrics.avgFeePerService)}`,
      `Inventory Units: ${metrics.invUnits} | Low: ${metrics.lowStock} | Expiring (3 mo): ${metrics.expiringSoon}`,
    ];
    let y = 22;
    meta.forEach((line) => { pdf.text(line, 14, y); y += 5; });

    autoTable(pdf, {
      startY: y + 2,
      head: [["Metric", "Value"]],
      body: [
        ["Registered Animals", String(metrics.totalAnimals)],
        ["Service Records (in range)", String(metrics.totalServices)],
        ["Vaccinations", `${metrics.vaccination} (${metrics.vaxRate}%)`],
        ["Vaccinated Registered", `${metrics.vaccinatedRegistered} (${metrics.vaccinatedRegisteredPct}%)`],
        ["Vaccinated Not Registered", `${metrics.vaccinatedNotRegistered} (${metrics.vaccinatedNotRegisteredPct}%)`],
        ["Total Fees", money(metrics.totalFees)],
        ["Average Fee per Service", money(metrics.avgFeePerService)],
        ["Inventory Units", String(metrics.invUnits)],
        ["Low Stock Batches", String(metrics.lowStock)],
        ["Expiring within 3 months", String(metrics.expiringSoon)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fontStyle: "bold" },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });

    const barangayRows = metrics.barangayTop.map((r) => {
      const feeMatch = metrics.barangayFeesTop.find((x) => x.label === r.label);
      return [r.label, String(r.value), money(feeMatch?.value || 0)];
    });
    if (barangayRows.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [["Top Barangays", "Count", "Total Fees"]],
        body: barangayRows,
        styles: { fontSize: 9 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
    }

    const typeRows = metrics.typeTop.slice(0, 12).map((r) => {
      const feeMatch = metrics.feeTypeTop.find((x) => x.label === r.label);
      return [r.label, String(r.value), money(feeMatch?.value || 0)];
    });
    if (typeRows.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [["Service Types", "Count", "Total Fees"]],
        body: typeRows,
        styles: { fontSize: 9 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
    }

    const vaccinationRows = [
      ["Registered", String(metrics.vaccinatedRegistered), `${metrics.vaccinatedRegisteredPct}%`],
      ["Not Registered", String(metrics.vaccinatedNotRegistered), `${metrics.vaccinatedNotRegisteredPct}%`],
    ];
    if (metrics.vaccination > 0) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [["Vaccination Registration Status", "Count", "Percent"]],
        body: vaccinationRows,
        styles: { fontSize: 9 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
    }

    const recordRows = services
      .slice()
      .sort((a, b) => (safeDate(b.date)?.getTime() || 0) - (safeDate(a.date)?.getTime() || 0))
      .map((s) => [
        ymd(s._dateObj) || "—",
        s.type === "Deworming" && s.dewormingType
          ? `${s.type} (${s.dewormingType === "large" ? "Large Ruminant" : "Small Ruminant"})`
          : s.type || "—",
        s.barangay || "—",
        s.species === "Other" ? s.speciesOther || "Other" : s.species || "—",
        String(Number(s.heads || 1)),
        money(Number(s.serviceFee || 0)),
        String(s.animalRegistered || "—"),
        s.status || "—",
        s.performedBy || "—",
      ]);

    autoTable(pdf, {
      startY: pdf.lastAutoTable.finalY + 8,
      head: [["Date", "Activity", "Barangay", "Species", "Heads", "Fee", "Registered", "Status", "Performed By"]],
      body: recordRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fontStyle: "bold" },
      theme: "grid",
      margin: { left: 10, right: 10 },
    });

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

  const exportIndividualFarmerCSV = () => {
    if (!selectedFarmer) return;
    const rows = farmerServices.map((s) => ({
      date: ymd(s._dateObj) || "—",
      activity: s.type || "—",
      barangay: s.barangay || "—",
      species: s.species || "—",
      heads: Number(s.heads || 1),
      fee: Number(s.serviceFee || 0),
      status: s.status || "—",
    }));
    downloadCSV(
      `farmer_${selectedFarmer.lastName}_${selectedFarmer.firstName}_services.csv`,
      rows,
      "date,activity,barangay,species,heads,fee,status\n"
    );
  };

  const exportIndividualFarmerPDF = () => {
    if (!selectedFarmer) return;
    const pdf = new jsPDF({ orientation: "landscape" });
    const fileName = `farmer_${selectedFarmer.lastName}_${selectedFarmer.firstName}_report.pdf`;

    pdf.setFontSize(14);
    pdf.text(`FARMER REPORT — ${selectedFarmer.firstName} ${selectedFarmer.lastName}`, 14, 14);
    pdf.setFontSize(10);
    pdf.text(`Barangay: ${selectedFarmer.barangay || "—"}`, 14, 22);
    pdf.text(`Contact: ${selectedFarmer.contact || "—"}`, 14, 28);
    pdf.text(`Generated: ${formatDateTimePH(new Date())}`, 14, 34);

    const metricsRows = [
      ["Total Animals", String(farmerMetrics.totalAnimals)],
      ["Total Services", String(farmerMetrics.totalServices)],
      ["Total Fees", money(farmerMetrics.totalFees)],
    ];
    autoTable(pdf, {
      startY: 40,
      head: [["Metric", "Value"]],
      body: metricsRows,
      styles: { fontSize: 9 },
      headStyles: { fontStyle: "bold" },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });

    const animalRows = farmerAnimals.map((a) => [
      a.tagId || "—",
      a.species === "Other" ? a.speciesOther || "Other" : a.species || "—",
      a.breed || "—",
      a.sex || "—",
      String(Number(a.noOfHeads || 0)),
      a.animalRegistered || "—",
    ]);
    if (animalRows.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [["Tag ID", "Species", "Breed", "Sex", "Heads", "Registered"]],
        body: animalRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
    }

    const serviceRows = farmerServices.map((s) => [
      ymd(s._dateObj) || "—",
      s.type || "—",
      s.barangay || "—",
      s.species || "—",
      String(Number(s.heads || 1)),
      money(Number(s.serviceFee || 0)),
      s.status || "—",
    ]);
    if (serviceRows.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [["Date", "Activity", "Barangay", "Species", "Heads", "Fee", "Status"]],
        body: serviceRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
    }

    pdf.save(fileName);
  };

  const exportAllFarmersSummaryCSV = () => {
    const rows = farmers.map((f) => {
      const farmerAnimals = animals.filter((a) => a.farmerId === f.id);
      const animalIds = new Set(farmerAnimals.map((a) => a.id));
      const farmerServices = services.filter((s) => s.animalId && animalIds.has(s.animalId));
      const totalFees = farmerServices.reduce((sum, s) => sum + Number(s.serviceFee || 0), 0);
      return {
        farmer: `${f.firstName} ${f.lastName}`,
        barangay: f.barangay || "—",
        contact: f.contact || "—",
        animals: farmerAnimals.length,
        services: farmerServices.length,
        fees: Math.round((totalFees + Number.EPSILON) * 100) / 100,
      };
    });
    downloadCSV(
      `all_farmers_summary_${new Date().toISOString().slice(0,10)}.csv`,
      rows,
      "farmer,barangay,contact,animals,services,fees\n"
    );
  };

  // ========== EXPORT DISPATCHER ==========
  const handleExport = (type) => {
    setBusy(true);
    try {
      switch (type) {
        case "services": exportServicesCSV(); break;
        case "barangay": exportBarangayCSV(); break;
        case "type": exportTypeCSV(); break;
        case "pdf_full": exportPDFReport(); break;
        case "farmer_individual":
          if (selectedFarmer) exportIndividualFarmerPDF();
          else alert("Please select a farmer first.");
          break;
        case "farmer_all": exportAllFarmersSummaryCSV(); break;
        default: break;
      }
    } catch (e) {
      setErr("Export failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ========== MISC ==========
  const serviceRows = useMemo(() => {
    return services
      .slice()
      .sort((a, b) => (safeDate(b.date)?.getTime() || 0) - (safeDate(a.date)?.getTime() || 0))
      .map((s) => ({
        id: s.id,
        date: ymd(s._dateObj) || "—",
        activity: s.type === "Deworming" && s.dewormingType
          ? `${s.type} (${s.dewormingType === "large" ? "Large Ruminant" : "Small Ruminant"})`
          : s.type || "—",
        barangay: s.barangay || "—",
        species: s.species === "Other" ? s.speciesOther || "Other" : s.species || "—",
        heads: Number(s.heads || 1),
        fee: Number(s.serviceFee || 0),
        status: s.status || "—",
        performedBy: s.performedBy || "—",
      }));
  }, [services]);

  const speciesTop = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const sp = s.species === "Other" ? s.speciesOther || "Other" : s.species || "Unknown";
      map.set(sp, (map.get(sp) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }, [services]);

  const vaccinationStatusGraph = useMemo(() => {
    return [
      {
        label: "Registered",
        value: metrics.vaccinatedRegisteredPct,
        count: metrics.vaccinatedRegistered,
      },
      {
        label: "Not Registered",
        value: metrics.vaccinatedNotRegisteredPct,
        count: metrics.vaccinatedNotRegistered,
      },
    ];
  }, [metrics]);

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

  // ========== RENDER ==========
  return (
    <div className="p1p p1p-font">
      <div className="p1p-head">
        <div className="p1p-headLeft">
          <div className="p1p-h1">Reports & Analytics</div>
          <div className="p1p-sub">
            Service statistics by barangay + standard LGU/DA exports with pricing totals.
          </div>
        </div>

        <div className="p1p-headRight">
          <button className="p1p-primary" onClick={generate} disabled={busy} type="button">
            <BarChart3 size={18} /> {busy ? "Generating…" : "Generate"}
          </button>
          <ExportDropdown onExport={handleExport} busy={busy} selectedFarmer={selectedFarmer} />
        </div>
      </div>

      {err && <div className="p1p-error">{err}</div>}

      {metrics.lowStock > 0 || metrics.expiringSoon > 0 ? (
        <div className="p1p-error" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} />
          <span>
            Inventory alerts: <b>{metrics.lowStock}</b> low-stock batch(es), <b>{metrics.expiringSoon}</b> expiring
            within 3 months.
          </span>
        </div>
      ) : null}

      <div className="p1p-tabs">
        <button
          className={`p1p-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
          type="button"
        >
          <LineChart size={16} /> Overview
        </button>
        <button
          className={`p1p-tab ${activeTab === "services" ? "active" : ""}`}
          onClick={() => setActiveTab("services")}
          type="button"
        >
          <PieChart size={16} /> Services
        </button>
        <button
          className={`p1p-tab ${activeTab === "geographic" ? "active" : ""}`}
          onClick={() => setActiveTab("geographic")}
          type="button"
        >
          <MapPinned size={16} /> Geographic
        </button>
        <button
          className={`p1p-tab ${activeTab === "farmers" ? "active" : ""}`}
          onClick={() => setActiveTab("farmers")}
          type="button"
        >
          <Users size={16} /> Farmers
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
          Live data: Registration + Services + Inventory. Date range filters service reports and fees.
        </div>
      </div>

      {/* ========== KPI CARDS – hidden on Farmers tab ========== */}
      {activeTab !== "farmers" && (
        <div className="p1p-kpiGrid">
          <div className="p1p-kpi">
            <div className="p1p-k">Registered Animals</div>
            <div className="p1p-v">{metrics.totalAnimals}</div>
            <div className="p1p-s">From Registration</div>
          </div>
          <div className="p1p-kpi">
            <div className="p1p-k">Service Records</div>
            <div className="p1p-v">{metrics.totalServices}</div>
            <div className="p1p-s">Filtered by range</div>
          </div>
          <div className="p1p-kpi">
            <div className="p1p-k">Vaccinations</div>
            <div className="p1p-v">{metrics.vaccination}</div>
            <div className="p1p-s">
              {metrics.vaccinatedRegisteredPct}% registered • {metrics.vaccinatedNotRegisteredPct}% not registered
            </div>
          </div>
          <div className="p1p-kpi">
            <div className="p1p-k">Total Fees</div>
            <div className="p1p-v">{money(metrics.totalFees)}</div>
            <div className="p1p-s">Avg: {money(metrics.avgFeePerService)} / service</div>
          </div>
          <div className="p1p-kpi">
            <div className="p1p-k">Inventory Units</div>
            <div className="p1p-v">{metrics.invUnits}</div>
            <div className="p1p-s">
              <Package size={14} style={{ verticalAlign: "middle" }} /> Low: {metrics.lowStock} • Expiring:{" "}
              {metrics.expiringSoon}
            </div>
          </div>
        </div>
      )}

      {activeTab === "overview" && (
        <>
          <div className="p1p-layout">
            <div className="p1p-card">
              <div className="p1p-cardHead">
                <div>
                  <div className="p1p-title">Monthly Trends</div>
                  <div className="p1p-muted">Based on services within selected date range</div>
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
                <div className="p1p-title">Vaccination Registration Status</div>
                <div className="p1p-muted">Percentage of vaccinated animals by registration status</div>
                <PercentageBars rows={vaccinationStatusGraph} />
                <table className="p1p-table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr><th>Status</th><th>Count</th><th>Percent</th></tr>
                  </thead>
                  <tbody>
                    <tr><td><b>Registered</b></td><td>{metrics.vaccinatedRegistered}</td><td>{metrics.vaccinatedRegisteredPct}%</td></tr>
                    <tr><td><b>Not Registered</b></td><td>{metrics.vaccinatedNotRegistered}</td><td>{metrics.vaccinatedNotRegisteredPct}%</td></tr>
                    {metrics.vaccination === 0 && <tr><td colSpan={3} className="p1p-empty">No vaccination data yet.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="p1p-card">
                <div className="p1p-title">Fees by Service Type</div>
                <div className="p1p-muted">Collected charges in selected range</div>
                <Bars rows={metrics.feeTypeTop.slice(0, 6)} formatter={money} />
              </div>
            </div>
          </div>

          <div className="p1p-grid2">
            <div className="p1p-card">
              <div className="p1p-title">Top barangays (table)</div>
              <table className="p1p-table">
                <thead><tr><th>Barangay</th><th>Count</th><th>Total Fees</th></tr></thead>
                <tbody>
                  {metrics.barangayTop.map((r) => {
                    const feeMatch = metrics.barangayFeesTop.find((x) => x.label === r.label);
                    return <tr key={r.label}><td><b>{r.label}</b></td><td>{r.value}</td><td>{money(feeMatch?.value || 0)}</td></tr>;
                  })}
                  {metrics.barangayTop.length === 0 && <tr><td colSpan={3} className="p1p-empty">No data yet.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="p1p-card">
              <div className="p1p-title">By service type (table)</div>
              <table className="p1p-table">
                <thead><tr><th>Type</th><th>Count</th><th>Total Fees</th></tr></thead>
                <tbody>
                  {metrics.typeTop.map((r) => {
                    const feeMatch = metrics.feeTypeTop.find((x) => x.label === r.label);
                    return <tr key={r.label}><td><b>{r.label}</b></td><td>{r.value}</td><td>{money(feeMatch?.value || 0)}</td></tr>;
                  })}
                  {metrics.typeTop.length === 0 && <tr><td colSpan={3} className="p1p-empty">No data yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "services" && (
        <div className="p1p-layout" style={{ marginTop: 12 }}>
          <div className="p1p-card">
            <div className="p1p-title">Services (filtered list)</div>
            <div className="p1p-muted">Shows all service records inside the selected date range</div>
            <table className="p1p-table">
              <thead><tr><th>Date</th><th>Activity</th><th>Barangay</th><th>Species</th><th>Heads</th><th>Fee</th><th>Registered</th><th>Status</th><th>Performed By</th></tr></thead>
              <tbody>
                {services.slice(0, 50).map((s) => (
                  <tr key={s.id}>
                    <td><b>{ymd(s._dateObj) || "—"}</b></td>
                    <td>{s.type === "Deworming" && s.dewormingType ? `${s.type} (${s.dewormingType === "large" ? "Large Ruminant" : "Small Ruminant"})` : s.type || "—"}</td>
                    <td>{s.barangay || "—"}</td>
                    <td>{s.species === "Other" ? s.speciesOther || "Other" : s.species || "—"}</td>
                    <td>{Number(s.heads || 1)}</td>
                    <td>{money(s.serviceFee || 0)}</td>
                    <td>{s.animalRegistered || "—"}</td>
                    <td>{s.status || "—"}</td>
                    <td>{s.performedBy || "—"}</td>
                  </tr>
                ))}
                {serviceRows.length === 0 && <tr><td colSpan={9} className="p1p-empty">No service records in this range.</td></tr>}
              </tbody>
            </table>
            {serviceRows.length > 50 && <div className="p1p-note">Showing first 50 of <b>{serviceRows.length}</b> records (export to get all).</div>}
          </div>

          <div className="p1p-side">
            <div className="p1p-card">
              <div className="p1p-title">By Service Type</div>
              <div className="p1p-muted">Distribution in selected range</div>
              <Bars rows={metrics.typeTop.slice(0, 8)} />
            </div>
            <div className="p1p-card">
              <div className="p1p-title">By Species</div>
              <div className="p1p-muted">Species coverage from services</div>
              <Bars rows={speciesTop} />
            </div>
            <div className="p1p-card">
              <div className="p1p-title">Vaccination Registration Status</div>
              <div className="p1p-muted">Vaccinated animals only</div>
              <PercentageBars rows={vaccinationStatusGraph} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "geographic" && (
        <>
          <div className="p1p-layout" style={{ marginTop: 12 }}>
            <div className="p1p-card">
              <div className="p1p-title">Barangay Service Density</div>
              <div className="p1p-muted">Counts and total fees per barangay within selected date range</div>
              <Bars rows={metrics.barangayTop} />
            </div>
            <div className="p1p-side">
              <div className="p1p-card">
                <div className="p1p-title">Top Barangay</div>
                <div className="p1p-muted">Highest count in current range</div>
                <div className="p1p-v" style={{ marginTop: 12 }}>{metrics.topB}</div>
                <div className="p1p-s">{metrics.topBCount} service record(s)</div>
              </div>
              <div className="p1p-card">
                <div className="p1p-title">Top Barangay Fees</div>
                <div className="p1p-muted">Highest collected charges</div>
                <div className="p1p-v" style={{ marginTop: 12 }}>{metrics.barangayFeesTop[0]?.label || "—"}</div>
                <div className="p1p-s">{money(metrics.barangayFeesTop[0]?.value || 0)}</div>
              </div>
            </div>
          </div>
          <div className="p1p-card" style={{ marginTop: 12 }}>
            <div className="p1p-title">Barangays (table)</div>
            <table className="p1p-table">
              <thead><tr><th>Barangay</th><th>Count</th><th>Total Fees</th></tr></thead>
              <tbody>
                {metrics.barangayTop.map((r) => {
                  const feeMatch = metrics.barangayFeesTop.find((x) => x.label === r.label);
                  return <tr key={r.label}><td><b>{r.label}</b></td><td>{r.value}</td><td>{money(feeMatch?.value || 0)}</td></tr>;
                })}
                {metrics.barangayTop.length === 0 && <tr><td colSpan={3} className="p1p-empty">No data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "farmers" && (
        <div className="p1p-card" style={{ marginTop: 12 }}>
          <div className="p1p-cardHead">
            <div>
              <div className="p1p-title">
                <Users size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Farmer Reports
              </div>
              <div className="p1p-muted">Select a farmer to view their animals, services, and summary.</div>
            </div>
          </div>

          <div className="p1p-farmer-selector" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={selectedFarmerId}
                onChange={(e) => setSelectedFarmerId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ddd", minWidth: "250px" }}
              >
                <option value="">— Select a farmer —</option>
                {farmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.firstName} {f.lastName} — {f.barangay || "No barangay"}
                  </option>
                ))}
              </select>
              {selectedFarmer && (
                <>
                  <button
                    className="p1p-ghost"
                    onClick={() => { exportIndividualFarmerCSV(); }}
                    style={{ padding: "6px 12px" }}
                    type="button"
                  >
                    <Download size={16} /> CSV
                  </button>
                  <button
                    className="p1p-ghost"
                    onClick={() => { exportIndividualFarmerPDF(); }}
                    style={{ padding: "6px 12px" }}
                    type="button"
                  >
                    <FileText size={16} /> PDF
                  </button>
                </>
              )}
            </div>
            {farmers.length === 0 && <div className="p1p-note">No farmers registered yet.</div>}
          </div>

          {selectedFarmer && farmerMetrics ? (
            <>
              <div className="p1p-farmer-summary" style={{ marginTop: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div><b>Name:</b> {selectedFarmer.firstName} {selectedFarmer.lastName}</div>
                <div><b>Barangay:</b> {selectedFarmer.barangay || "—"}</div>
                <div><b>Contact:</b> {selectedFarmer.contact || "—"}</div>
                <div><b>Animals:</b> {farmerMetrics.totalAnimals}</div>
                <div><b>Services:</b> {farmerMetrics.totalServices}</div>
                <div><b>Total Fees:</b> {money(farmerMetrics.totalFees)}</div>
              </div>

              <div className="p1p-grid2" style={{ marginTop: 16 }}>
                <div>
                  <h4>Animals</h4>
                  <table className="p1p-table">
                    <thead><tr><th>Tag</th><th>Species</th><th>Breed</th><th>Sex</th><th>Heads</th><th>Registered</th></tr></thead>
                    <tbody>
                      {farmerAnimals.map((a) => (
                        <tr key={a.id}>
                          <td>{a.tagId || "—"}</td>
                          <td>{a.species === "Other" ? a.speciesOther || "Other" : a.species || "—"}</td>
                          <td>{a.breed || "—"}</td>
                          <td>{a.sex || "—"}</td>
                          <td>{Number(a.noOfHeads || 0)}</td>
                          <td>{a.animalRegistered || "—"}</td>
                        </tr>
                      ))}
                      {farmerAnimals.length === 0 && <tr><td colSpan={6} className="p1p-empty">No animals.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4>Services</h4>
                  <table className="p1p-table">
                    <thead><tr><th>Date</th><th>Activity</th><th>Fee</th><th>Status</th></tr></thead>
                    <tbody>
                      {farmerServices.map((s) => (
                        <tr key={s.id}>
                          <td>{ymd(s._dateObj) || "—"}</td>
                          <td>{s.type || "—"}</td>
                          <td>{money(s.serviceFee || 0)}</td>
                          <td>{s.status || "—"}</td>
                        </tr>
                      ))}
                      {farmerServices.length === 0 && <tr><td colSpan={4} className="p1p-empty">No services.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p1p-note" style={{ marginTop: 12 }}>
                <b>Totals:</b> {farmerMetrics.totalAnimals} animals, {farmerMetrics.totalServices} services, {money(farmerMetrics.totalFees)} fees.
              </div>
            </>
          ) : selectedFarmerId ? (
            <div className="p1p-note">No data found for this farmer.</div>
          ) : null}
        </div>
      )}

      {activeTab === "exports" && (
        <div className="p1p-card" style={{ marginTop: 12 }}>
          <div className="p1p-title">Exports</div>
          <div className="p1p-muted">
            All exports respect the selected date range, including service fees.
          </div>
          <div style={{ marginTop: 12 }}>
            <ExportDropdown onExport={handleExport} busy={busy} selectedFarmer={selectedFarmer} />
          </div>
          <div className="p1p-note" style={{ marginTop: 12 }}>
            <b>{serviceRows.length}</b> service record(s) in range • Total fees:{" "}
            <b>{money(metrics.totalFees)}</b>
          </div>
        </div>
      )}
    </div>
  );
}