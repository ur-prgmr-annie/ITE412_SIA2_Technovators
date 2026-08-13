// src/pages/program3/P3Reports.jsx
import { useMemo, useState, useEffect } from "react";
import "../../styles/p3Reports.css";
import { BarChart3, Download, CalendarDays, Bug, Bird, AlertTriangle, RefreshCw, FileText, X, CheckCircle } from "lucide-react";
import { auth, db } from "../../services/firebase";
import { collection, query, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { subscribeToCases } from "../../services/program3CaseService";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`p3r-toast ${toast.type || "ok"}`} role="status" aria-live="polite">
      <div className="p3r-toast-icon">
        {toast.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
      </div>
      <div className="p3r-toast-content">
        <div className="p3r-toast-title">{toast.title}</div>
        {toast.message && <div className="p3r-toast-message">{toast.message}</div>}
      </div>
      <button className="p3r-toast-close" onClick={onClose} type="button" aria-label="Close toast">
        <X size={16} />
      </button>
    </div>
  );
}

export default function P3Reports() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("monthly");
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState(false);

  const showToast = (type, title, message = "", ms = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToast({ id, type, title, message });
    setTimeout(() => setToast(null), ms);
  };

  // Load cases
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;
    try {
      if (!auth.currentUser) {
        setLoading(false);
        showToast("error", "Not Authenticated", "Please sign in to view reports.");
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
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCases(data);
            setLoading(false);
            setError(null);
          }
        }, (err) => {
          console.error("Fallback query error:", err);
          if (isMounted) { setError(err.message); setLoading(false); }
        });
        unsubscribe = unsub;
      }
    } catch (error) {
      console.error("Failed to subscribe to cases:", error);
      if (isMounted) { setLoading(false); setError(error.message); showToast("error", "Connection Error", "Failed to load cases."); }
    }
    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (err) { console.warn("Error unsubscribing:", err); }
      }
    };
  }, []);

  // ===============================
  // SUMMARY DATA PER PERIOD
  // ===============================
  const summary = useMemo(() => {
    const map = new Map();

    for (const c of cases) {
      const period = monthKey(c.reportedDate);
      if (!period) continue;

      if (!map.has(period)) {
        map.set(period, {
          period,
          barangays: new Set(),
          totalPopulation: 0,
          totalMorbidity: 0,
          totalMortality: 0,
          samplesCollected: 0,
          labPositive: 0,
          labNegative: 0,
          asf: 0,
          birdFlu: 0,
        });
      }

      const row = map.get(period);
      if (c.barangay) row.barangays.add(c.barangay);

      row.totalPopulation += Number(c.population) || 0;
      row.totalMorbidity += Number(c.sickCount) || 0;
      row.totalMortality += Number(c.deathsCount) || 0;
      row.samplesCollected += Number(c.samplesCollected) || 0;

      // Lab results - placeholder until we add field
      // For now, we assume all samples are pending.
      // We'll add later.

      // Disease counts
      const d = String(c.disease || "").toLowerCase();
      if (d === "asf") row.asf += 1;
      else if (d === "bird flu" || d === "birdflu") row.birdFlu += 1;
      else row.birdFlu += 1; // fallback
    }

    // Convert Sets to counts
    return Array.from(map.values()).map(row => ({
      ...row,
      barangayCount: row.barangays.size,
    })).sort((a, b) => a.period.localeCompare(b.period));
  }, [cases]);

  // Totals row
  const totals = useMemo(() => {
    const asf = cases.filter((c) => String(c.disease || "").toLowerCase() === "asf").length;
    const birdFlu = cases.filter((c) => {
      const d = String(c.disease || "").toLowerCase();
      return d === "bird flu" || d === "birdflu";
    }).length;
    const total = cases.length;
    const population = cases.reduce((sum, c) => sum + (Number(c.population) || 0), 0);
    const morbidity = cases.reduce((sum, c) => sum + (Number(c.sickCount) || 0), 0);
    const mortality = cases.reduce((sum, c) => sum + (Number(c.deathsCount) || 0), 0);
    const samples = cases.reduce((sum, c) => sum + (Number(c.samplesCollected) || 0), 0);
    const barangays = new Set(cases.map(c => c.barangay).filter(Boolean)).size;
    return { asf, birdFlu, total, population, morbidity, mortality, samples, barangays };
  }, [cases]);

  // Export handlers (updated to include summary)
  const exportCSV = () => {
    if (summary.length === 0) { showToast("error", "No data", "There is no data to export."); return; }
    setExporting(true);
    try {
      const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const head = ["Period", "Barangays", "Population", "Morbidity", "Mortality", "Samples", "ASF", "Bird Flu"];
      const lines = [head.join(",")];
      summary.forEach((r) => {
        lines.push([
          esc(r.period),
          r.barangayCount,
          r.totalPopulation,
          r.totalMorbidity,
          r.totalMortality,
          r.samplesCollected,
          r.asf,
          r.birdFlu,
        ].join(","));
      });
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `program3_summary_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("ok", "Export successful", "CSV file downloaded.");
    } catch (err) {
      console.error("Export error:", err);
      showToast("error", "Export failed", err.message);
    } finally { setExporting(false); }
  };

  const exportXLSX = async () => {
    if (summary.length === 0) { showToast("error", "No data", "There is no data to export."); return; }
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "ANIMIS";
      wb.created = new Date();

      // Summary sheet
      const ws1 = wb.addWorksheet("Summary");
      ws1.addRow(["Province", "Oriental Mindoro"]);
      ws1.addRow(["Municipality", "Naujan"]);
      ws1.addRow(["Exported At", new Date().toLocaleString("en-PH")]);
      ws1.addRow(["Exported By", auth.currentUser?.email || "Unknown"]);
      ws1.addRow([]);
      ws1.addRow(["Metric", "Value"]);
      ws1.addRow(["Total Cases", totals.total]);
      ws1.addRow(["ASF", totals.asf]);
      ws1.addRow(["Bird Flu", totals.birdFlu]);
      ws1.addRow(["Total Barangays", totals.barangays]);
      ws1.addRow(["Total Population", totals.population]);
      ws1.addRow(["Total Morbidity", totals.morbidity]);
      ws1.addRow(["Total Mortality", totals.mortality]);
      ws1.addRow(["Total Samples", totals.samples]);
      ws1.addRow([]);
      ws1.addRow(["Monthly Summary"]);
      ws1.columns = [{ width: 24 }, { width: 42 }];

      // Data sheet
      const ws2 = wb.addWorksheet("Monthly Data");
      ws2.columns = [
        { header: "Period", key: "period", width: 16 },
        { header: "Barangays", key: "barangayCount", width: 12 },
        { header: "Population", key: "totalPopulation", width: 14 },
        { header: "Morbidity", key: "totalMorbidity", width: 12 },
        { header: "Mortality", key: "totalMortality", width: 12 },
        { header: "Samples", key: "samplesCollected", width: 12 },
        { header: "ASF", key: "asf", width: 10 },
        { header: "Bird Flu", key: "birdFlu", width: 12 },
      ];
      ws2.getRow(1).font = { bold: true };
      summary.forEach((r) => ws2.addRow(r));

      const buf = await wb.xlsx.writeBuffer();
      saveAs(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `program3_summary_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      showToast("ok", "Export successful", "Excel file downloaded.");
    } catch (err) {
      console.error("Export error:", err);
      showToast("error", "Export failed", err.message);
    } finally { setExporting(false); }
  };

  const exportPDF = () => {
    if (summary.length === 0) { showToast("error", "No data", "There is no data to export."); return; }
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Program 3 - Monthly Summary Report", 14, 14);
      doc.setFontSize(10);
      doc.text(`Exported: ${new Date().toLocaleString("en-PH")}`, 14, 22);
      doc.text(`Exported By: ${auth.currentUser?.email || "Unknown"}`, 14, 28);

      // Summary table
      autoTable(doc, {
        startY: 35,
        head: [["Period", "Barangays", "Population", "Morbidity", "Mortality", "Samples", "ASF", "Bird Flu"]],
        body: summary.map((r) => [
          r.period,
          r.barangayCount,
          r.totalPopulation,
          r.totalMorbidity,
          r.totalMortality,
          r.samplesCollected,
          r.asf,
          r.birdFlu,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() - 30,
          doc.internal.pageSize.getHeight() - 8
        );
      }
      doc.save(`program3_summary_${new Date().toISOString().split("T")[0]}.pdf`);
      showToast("ok", "Export successful", "PDF file downloaded.");
    } catch (err) {
      console.error("Export error:", err);
      showToast("error", "Export failed", err.message);
    } finally { setExporting(false); }
  };

  if (loading) {
    return (
      <div className="p3r">
        <div className="p3r-loading"><div className="p3r-spinner"></div><div>Loading reports...</div></div>
      </div>
    );
  }

  return (
    <div className="p3r">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <div className="p3r-head">
        <div>
          <div className="p3r-h1">Reports & Trends</div>
          <div className="p3r-sub">
            Monthly summary of ASF and Bird Flu cases with key metrics
            {error && <span className="p3r-error-indicator"> ⚠️ Error loading</span>}
          </div>
        </div>
        <div className="p3r-actions">
          <button className="p3r-iconBtn" onClick={() => window.location.reload()} title="Refresh" type="button">
            <RefreshCw size={18} />
          </button>
          <div className="p3r-toggle">
            <button className={`p3r-chip ${mode === "monthly" ? "active" : ""}`} onClick={() => setMode("monthly")} type="button">
              <CalendarDays size={16} /> Monthly
            </button>
            <button className={`p3r-chip ${mode === "annual" ? "active" : ""}`} onClick={() => setMode("annual")} type="button">
              <BarChart3 size={16} /> Annual
            </button>
          </div>
          <div className="p3r-export-group">
            <button className="p3r-btn" type="button" onClick={exportCSV} disabled={exporting || summary.length === 0}>
              <Download size={16} /> CSV
            </button>
            <button className="p3r-btn" type="button" onClick={exportXLSX} disabled={exporting || summary.length === 0}>
              <FileText size={16} /> Excel
            </button>
            <button className="p3r-btn" type="button" onClick={exportPDF} disabled={exporting || summary.length === 0}>
              <FileText size={16} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="p3r-kpis">
        <div className="p3r-kpi">
          <div className="k-label">Total Cases</div>
          <div className="k-value">{totals.total}</div>
          <div className="k-meta"><span className="pill neutral">all time</span></div>
        </div>
        <div className="p3r-kpi">
          <div className="k-label">ASF</div>
          <div className="k-value">{totals.asf}</div>
          <div className="k-meta"><span className="pill ok"><Bug size={14} /> ASF</span></div>
        </div>
        <div className="p3r-kpi">
          <div className="k-label">Bird Flu</div>
          <div className="k-value">{totals.birdFlu}</div>
          <div className="k-meta"><span className="pill ok"><Bird size={14} /> Bird Flu</span></div>
        </div>
        <div className="p3r-kpi">
          <div className="k-label">Barangays</div>
          <div className="k-value">{totals.barangays}</div>
          <div className="k-meta"><span className="pill neutral">unique</span></div>
        </div>
        <div className="p3r-kpi">
          <div className="k-label">Population</div>
          <div className="k-value">{totals.population}</div>
          <div className="k-meta"><span className="pill neutral">total</span></div>
        </div>
        <div className="p3r-kpi">
          <div className="k-label">Samples</div>
          <div className="k-value">{totals.samples}</div>
          <div className="k-meta"><span className="pill neutral">collected</span></div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="p3r-card">
        <div className="p3r-cardHead">
          <div className="p3r-cardTitle">Monthly Summary</div>
          <div className="p3r-cardHint">{summary.length} period(s) • {cases.length} total cases</div>
        </div>
        <div className="p3r-tableWrap">
          {error ? (
            <div className="p3r-error-state">
              <AlertTriangle size={24} />
              <p>Error loading data: {error}</p>
              <button className="p3r-btn" onClick={() => window.location.reload()}>Refresh</button>
            </div>
          ) : summary.length === 0 ? (
            <div className="p3r-empty-state">
              <FileText size={40} />
              <p>No data available. Start reporting cases to see trends.</p>
            </div>
          ) : (
            <table className="p3r-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Barangays</th>
                  <th>Population</th>
                  <th>Morbidity</th>
                  <th>Mortality</th>
                  <th>Samples</th>
                  <th>ASF</th>
                  <th>Bird Flu</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.period}>
                    <td><b>{r.period}</b></td>
                    <td>{r.barangayCount}</td>
                    <td>{r.totalPopulation}</td>
                    <td>{r.totalMorbidity}</td>
                    <td>{r.totalMortality}</td>
                    <td>{r.samplesCollected}</td>
                    <td>{r.asf}</td>
                    <td>{r.birdFlu}</td>
                  </tr>
                ))}
                <tr className="p3r-total-row">
                  <td><b>Total</b></td>
                  <td><b>{totals.barangays}</b></td>
                  <td><b>{totals.population}</b></td>
                  <td><b>{totals.morbidity}</b></td>
                  <td><b>{totals.mortality}</b></td>
                  <td><b>{totals.samples}</b></td>
                  <td><b>{totals.asf}</b></td>
                  <td><b>{totals.birdFlu}</b></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <div className="p3r-note">
          <FileText size={14} />
          <span>Data is aggregated from case reports. Laboratory results will be added in a future update.</span>
        </div>
      </div>
    </div>
  );
}