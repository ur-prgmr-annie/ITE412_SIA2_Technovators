// src/pages/program3/P3CaseReporting.jsx
import { useMemo, useState, useEffect } from "react";
import "../../styles/p3CaseReporting.css";
import { FilePlus2, Save, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { subscribeToCases, addCaseToFirestore } from "../../services/program3CaseService";
import { auth } from "../../services/firebase";

const BRGYS = ["Sampaguita", "Poblacion I", "Wawa", "Poblacion II", "San Andres", "Barcenaga", "Unknown"];

function Pill({ tone = "neutral", children }) {
  return <span className={`p3cr-pill ${tone}`}>{children}</span>;
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="p3cr-modalWrap" role="dialog" aria-modal="true">
      <button className="p3cr-modalBackdrop" onClick={onClose} aria-label="Close" />
      <div className="p3cr-modal">
        <div className="p3cr-modalHead">
          <div className="p3cr-modalTitle">{title}</div>
          <button className="p3cr-iconBtn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p3cr-modalBody">{children}</div>
      </div>
    </div>
  );
}

function Toasts({ items, onRemove }) {
  return (
    <div className="p3cr-toasts" aria-live="polite" aria-atomic="true">
      {items.map((t) => (
        <div key={t.id} className={`p3cr-toast ${t.type}`}>
          <div className="p3cr-toastTitle">{t.title}</div>
          {t.message && <div className="p3cr-toastMsg">{t.message}</div>}
          <button className="p3cr-toastX" onClick={() => onRemove(t.id)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isFuture(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  return d.getTime() > Date.now();
}

export default function P3CaseReporting() {
  const [cases, setCases] = useState([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pushToast = (type, title, message = "", ms = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item = { id, type, title, message };
    setToasts((prev) => [item, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, ms);
  };

  // 🔹 FORM STATE – reordered to match priority
  const [form, setForm] = useState({
    disease: "ASF",
    species: "Swine",
    barangay: "Sampaguita",
    reportedDate: todayISO(),
    status: "reported",
    severity: "medium",
    symptoms: "",
    reporter: "Field Officer",
    notes: "",

    // GPS
    latitude: "",
    longitude: "",
    // Farmer
    farmerName: "",
    // Premises
    premisesType: "Backyard",
    premisesOther: "",
    // Details
    population: "",
    ageClassification: "",
    sex: "Mixed",
    sickCount: "",
    deathsCount: "",
    depopulateCount: "",
    // Samples
    samplesCollected: "",
    sampleId: "",
    // History & Movement
    history: "",
    movement: "",
  });

  const [errors, setErrors] = useState({});

  // Real-time Firestore subscription
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;
    
    try {
      if (!auth.currentUser) {
        setLoading(false);
        pushToast("error", "Not Authenticated", "Please sign in to view cases.");
        return;
      }

      unsubscribe = subscribeToCases((fetchedCases) => {
        if (isMounted) {
          setCases(fetchedCases || []);
          setLoading(false);
          setError(null);
        }
      });
    } catch (error) {
      console.error("Failed to subscribe to cases:", error);
      setLoading(false);
      setError(error.message);
      pushToast("error", "Connection Error", "Failed to load cases. Please refresh the page.");
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

  const validate = () => {
    const e = {};
    if (!form.disease) e.disease = "Disease is required.";
    if (!form.species) e.species = "Species is required.";
    if (!form.barangay) e.barangay = "Barangay is required.";
    if (!form.reportedDate) e.reportedDate = "Reported date is required.";
    if (form.reportedDate && isFuture(form.reportedDate)) {
      e.reportedDate = "Date cannot be in the future.";
    }
    if (!form.status) e.status = "Status is required.";
    if (!form.severity) e.severity = "Severity is required.";

    const symptomsArr = String(form.symptoms || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (symptomsArr.length === 0) e.symptoms = "Add at least one symptom (comma-separated).";

    // Validate numbers if provided
    const numFields = ["population", "sickCount", "deathsCount", "depopulateCount", "samplesCollected"];
    numFields.forEach(f => {
      if (form[f] && isNaN(Number(form[f]))) {
        e[f] = "Must be a number.";
      }
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const stats = useMemo(() => {
    const total = cases.length;
    const last7 = cases.filter((c) => {
      if (!c.reportedDate) return false;
      const d = new Date(c.reportedDate);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      return diff >= 0 && diff <= 7 * 86400000;
    }).length;
    const urgent = cases.filter((c) => c.severity === "high" && c.status !== "closed").length;
    return { total, last7, urgent };
  }, [cases]);

  const resetForm = () => {
    setForm({
      disease: "ASF",
      species: "Swine",
      barangay: "Sampaguita",
      reportedDate: todayISO(),
      status: "reported",
      severity: "medium",
      symptoms: "",
      reporter: "Field Officer",
      notes: "",
      latitude: "",
      longitude: "",
      farmerName: "",
      premisesType: "Backyard",
      premisesOther: "",
      population: "",
      ageClassification: "",
      sex: "Mixed",
      sickCount: "",
      deathsCount: "",
      depopulateCount: "",
      samplesCollected: "",
      sampleId: "",
      history: "",
      movement: "",
    });
    setErrors({});
  };

  const addCase = async () => {
    if (saving) return;
    if (!auth.currentUser) {
      pushToast("error", "Not Authenticated", "Please sign in to save cases.");
      return;
    }
    if (!validate()) {
      pushToast("error", "Please fix the form", "Some required fields are missing or invalid.");
      return;
    }

    setSaving(true);

    try {
      const symptomsArr = String(form.symptoms || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const newCaseData = {
        disease: form.disease,
        species: form.species,
        barangay: form.barangay,
        reportedDate: form.reportedDate,
        status: form.status,
        severity: form.severity,
        symptoms: symptomsArr,
        reporter: form.reporter || "—",
        notes: form.notes || "",

        latitude: form.latitude || null,
        longitude: form.longitude || null,
        farmerName: form.farmerName || "",
        premisesType: form.premisesType,
        premisesOther: form.premisesType === "Others" ? form.premisesOther : "",
        population: form.population ? Number(form.population) : null,
        ageClassification: form.ageClassification || "",
        sex: form.sex || "Mixed",
        sickCount: form.sickCount ? Number(form.sickCount) : null,
        deathsCount: form.deathsCount ? Number(form.deathsCount) : null,
        depopulateCount: form.depopulateCount ? Number(form.depopulateCount) : null,
        samplesCollected: form.samplesCollected ? Number(form.samplesCollected) : null,
        sampleId: form.sampleId || "",
        history: form.history || "",
        movement: form.movement || "",
      };

      await addCaseToFirestore(newCaseData);
      
      setOpen(false);
      resetForm();
      pushToast("success", "Case saved", `${form.disease} • ${form.barangay}`);
    } catch (err) {
      console.error("Error saving case:", err);
      pushToast("error", "Failed to save case", err.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p3cr">
      <Toasts
        items={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <div className="p3cr-head">
        <div>
          <div className="p3cr-h1">Case Reporting</div>
          <div className="p3cr-sub">
            Create new disease surveillance reports for <b>ASF</b> and <b>Bird Flu</b>.
          </div>
        </div>

        <button 
          className="p3cr-btn" 
          onClick={() => setOpen(true)} 
          type="button" 
          disabled={saving || !auth.currentUser}
        >
          <FilePlus2 size={16} /> New Case
        </button>
      </div>

      <div className="p3cr-kpis">
        <div className="p3cr-kpi">
          <div className="k-label">Total Cases</div>
          <div className="k-value">{stats.total}</div>
          <div className="k-meta"><Pill tone="neutral">all records</Pill></div>
        </div>
        <div className="p3cr-kpi">
          <div className="k-label">Last 7 Days</div>
          <div className="k-value">{stats.last7}</div>
          <div className="k-meta"><Pill tone="warn">recent</Pill></div>
        </div>
        <div className="p3cr-kpi">
          <div className="k-label">Urgent (High)</div>
          <div className="k-value">{stats.urgent}</div>
          <div className="k-meta">
            <Pill tone={stats.urgent ? "bad" : "ok"}>
              {stats.urgent ? "needs action" : "ok"}
            </Pill>
          </div>
        </div>
      </div>

      <div className="p3cr-card">
        <div className="p3cr-cardHead">
          <div className="p3cr-cardTitle">Recent Reports</div>
          <div className="p3cr-cardHint">Real-time from Firestore</div>
        </div>

        <div className="p3cr-tableWrap">
          {error ? (
            <div className="p3cr-error-state">
              <AlertTriangle size={24} />
              <p>Error loading cases: {error}</p>
              <button 
                className="p3cr-btn" 
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
            </div>
          ) : (
            <table className="p3cr-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Disease</th>
                  <th>Species</th>
                  <th>Barangay</th>
                  <th>Reported</th>
                  <th>Status</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p3cr-emptyRow">Loading cases...</td>
                  </tr>
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p3cr-emptyRow">No case reports yet.</td>
                  </tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id}>
                      <td><b>{c.id.slice(0, 8)}</b></td>
                      <td>{c.disease}</td>
                      <td>{c.species}</td>
                      <td>{c.barangay}</td>
                      <td>{c.reportedDate}</td>
                      <td><span className={`p3cr-badge ${c.status}`}>{c.status}</span></td>
                      <td><span className={`p3cr-badge sev-${c.severity}`}>{c.severity}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========== REORGANIZED MODAL – PRIORITY ORDER ========== */}
      <Modal
        open={open}
        title="New Case Report"
        onClose={() => {
          if (!saving) {
            setOpen(false);
            setErrors({});
            resetForm();
          }
        }}
      >
        <div className="p3cr-formGrid">
          {/* 1. BASIC INFO */}
          <div className="p3cr-section-title span2">Basic Information</div>

          <label className={`p3cr-field ${errors.disease ? "err" : ""}`}>
            <span>Disease</span>
            <select value={form.disease} onChange={(e) => setForm((f) => ({ ...f, disease: e.target.value }))}>
              <option value="ASF">ASF</option>
              <option value="Bird Flu">Bird Flu</option>
            </select>
            {errors.disease && <div className="p3cr-err">{errors.disease}</div>}
          </label>

          <label className={`p3cr-field ${errors.species ? "err" : ""}`}>
            <span>Species</span>
            <select value={form.species} onChange={(e) => setForm((f) => ({ ...f, species: e.target.value }))}>
              <option value="Swine">Swine</option>
              <option value="Poultry">Poultry</option>
              <option value="Cattle">Cattle</option>
              <option value="Goat">Goat</option>
              <option value="Other">Other</option>
            </select>
            {errors.species && <div className="p3cr-err">{errors.species}</div>}
          </label>

          <label className={`p3cr-field ${errors.barangay ? "err" : ""}`}>
            <span>Barangay</span>
            <select value={form.barangay} onChange={(e) => setForm((f) => ({ ...f, barangay: e.target.value }))}>
              {BRGYS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.barangay && <div className="p3cr-err">{errors.barangay}</div>}
          </label>

          <label className={`p3cr-field ${errors.reportedDate ? "err" : ""}`}>
            <span>Reported Date</span>
            <input
              type="date"
              value={form.reportedDate}
              onChange={(e) => setForm((f) => ({ ...f, reportedDate: e.target.value }))}
            />
            {errors.reportedDate && <div className="p3cr-err">{errors.reportedDate}</div>}
          </label>

          <label className={`p3cr-field ${errors.status ? "err" : ""}`}>
            <span>Status</span>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="reported">reported</option>
              <option value="suspected">suspected</option>
              <option value="investigated">investigated</option>
              <option value="confirmed">confirmed</option>
              <option value="closed">closed</option>
            </select>
          </label>

          <label className={`p3cr-field ${errors.severity ? "err" : ""}`}>
            <span>Severity</span>
            <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>

          {/* 2. GPS COORDINATES */}
          <div className="p3cr-section-title span2">GPS Coordinates</div>
          <div className="p3cr-field-group span2">
            <label className="p3cr-field">
              <span>Latitude</span>
              <input
                type="text"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="e.g. 13.4125"
              />
            </label>
            <label className="p3cr-field">
              <span>Longitude</span>
              <input
                type="text"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="e.g. 121.1578"
              />
            </label>
          </div>

          {/* 3. FARMER NAME */}
          <label className="p3cr-field span2">
            <span>Farmer's Name</span>
            <input
              value={form.farmerName}
              onChange={(e) => setForm((f) => ({ ...f, farmerName: e.target.value }))}
              placeholder="Full name of the farmer"
            />
          </label>

          {/* 4. PREMISES AFFECTED */}
          <div className="p3cr-section-title span2">Premises Affected</div>
          <div className="p3cr-field-group span2">
            <label className="p3cr-field">
              <span>Type</span>
              <select value={form.premisesType} onChange={(e) => setForm((f) => ({ ...f, premisesType: e.target.value }))}>
                <option value="Backyard">Backyard</option>
                <option value="Commercial">Commercial</option>
                <option value="Semi-commercial">Semi-commercial</option>
                <option value="Others">Others</option>
              </select>
            </label>
            {form.premisesType === "Others" && (
              <label className="p3cr-field">
                <span>Specify</span>
                <input
                  value={form.premisesOther}
                  onChange={(e) => setForm((f) => ({ ...f, premisesOther: e.target.value }))}
                  placeholder="Specify premises type"
                />
              </label>
            )}
          </div>

          {/* 5. SYMPTOMS – important, placed early */}
          <label className={`p3cr-field span2 ${errors.symptoms ? "err" : ""}`}>
            <span>Symptoms (comma-separated)</span>
            <input
              value={form.symptoms}
              placeholder="e.g. Fever, Sudden death, Anorexia"
              onChange={(e) => setForm((f) => ({ ...f, symptoms: e.target.value }))}
            />
            {errors.symptoms && <div className="p3cr-err">{errors.symptoms}</div>}
            <div className="p3cr-tip">Tip: Use high severity for sudden deaths or multiple affected animals.</div>
          </label>

          {/* 6. DETAILS */}
          <div className="p3cr-section-title span2">Details</div>

          <label className={`p3cr-field ${errors.population ? "err" : ""}`}>
            <span>Population</span>
            <input
              type="number"
              min="0"
              value={form.population}
              onChange={(e) => setForm((f) => ({ ...f, population: e.target.value }))}
            />
            {errors.population && <div className="p3cr-err">{errors.population}</div>}
          </label>

          <label className="p3cr-field">
            <span>Age Classification</span>
            <input
              value={form.ageClassification}
              onChange={(e) => setForm((f) => ({ ...f, ageClassification: e.target.value }))}
              placeholder="e.g. Grower, Finisher, Adult"
            />
          </label>

          <label className="p3cr-field">
            <span>Sex</span>
            <select value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
              <option value="Mixed">Mixed</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </label>

          <label className={`p3cr-field ${errors.sickCount ? "err" : ""}`}>
            <span>No. of sick animals</span>
            <input
              type="number"
              min="0"
              value={form.sickCount}
              onChange={(e) => setForm((f) => ({ ...f, sickCount: e.target.value }))}
            />
            {errors.sickCount && <div className="p3cr-err">{errors.sickCount}</div>}
          </label>

          <label className={`p3cr-field ${errors.deathsCount ? "err" : ""}`}>
            <span>No. of deaths</span>
            <input
              type="number"
              min="0"
              value={form.deathsCount}
              onChange={(e) => setForm((f) => ({ ...f, deathsCount: e.target.value }))}
            />
            {errors.deathsCount && <div className="p3cr-err">{errors.deathsCount}</div>}
          </label>

          <label className={`p3cr-field ${errors.depopulateCount ? "err" : ""}`}>
            <span>No. of heads destroy/depopulate</span>
            <input
              type="number"
              min="0"
              value={form.depopulateCount}
              onChange={(e) => setForm((f) => ({ ...f, depopulateCount: e.target.value }))}
            />
            {errors.depopulateCount && <div className="p3cr-err">{errors.depopulateCount}</div>}
          </label>

          {/* 7. SAMPLES */}
          <div className="p3cr-section-title span2">Sample Collection</div>
          <div className="p3cr-field-group span2">
            <label className={`p3cr-field ${errors.samplesCollected ? "err" : ""}`}>
              <span>No. of samples collected</span>
              <input
                type="number"
                min="0"
                value={form.samplesCollected}
                onChange={(e) => setForm((f) => ({ ...f, samplesCollected: e.target.value }))}
              />
              {errors.samplesCollected && <div className="p3cr-err">{errors.samplesCollected}</div>}
            </label>
            <label className="p3cr-field">
              <span>Sample ID</span>
              <input
                value={form.sampleId}
                onChange={(e) => setForm((f) => ({ ...f, sampleId: e.target.value }))}
                placeholder="e.g. S-001"
              />
            </label>
          </div>

          {/* 8. HISTORY & MOVEMENT */}
          <div className="p3cr-section-title span2">History & Movement</div>
          <label className="p3cr-field span2">
            <span>History</span>
            <textarea
              rows={2}
              value={form.history}
              onChange={(e) => setForm((f) => ({ ...f, history: e.target.value }))}
              placeholder="Animal movement history, previous diseases, etc."
            />
          </label>

          <label className="p3cr-field span2">
            <span>Movement</span>
            <textarea
              rows={2}
              value={form.movement}
              onChange={(e) => setForm((f) => ({ ...f, movement: e.target.value }))}
              placeholder="Recent movements of animals, people, or vehicles"
            />
          </label>

          {/* 9. REPORTER & NOTES */}
          <div className="p3cr-section-title span2">Reporting</div>
          <label className="p3cr-field span2">
            <span>Reporter</span>
            <input value={form.reporter} onChange={(e) => setForm((f) => ({ ...f, reporter: e.target.value }))} />
          </label>

          <label className="p3cr-field span2">
            <span>Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>

        <div className="p3cr-actions">
          <button 
            className="p3cr-btn ghost" 
            onClick={() => { 
              if (!saving) { 
                setOpen(false); 
                resetForm(); 
              } 
            }} 
            disabled={saving}
          >
            <X size={16} /> Cancel
          </button>
          <button 
            className="p3cr-btn" 
            onClick={addCase} 
            disabled={saving || !auth.currentUser}
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Case"}
          </button>
        </div>
      </Modal>
    </div>
  );
}