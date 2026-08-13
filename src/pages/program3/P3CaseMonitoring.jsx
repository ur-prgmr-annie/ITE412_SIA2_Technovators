// src/pages/program3/P3CaseMonitoring.jsx
import { useMemo, useState, useEffect } from "react";
import "../../styles/p3CaseMonitoring.css";
import {
  Search,
  Filter,
  ClipboardList,
  X,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
} from "lucide-react";
import { auth, db } from "../../services/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { subscribeToCases, updateCaseInFirestore } from "../../services/program3CaseService";

function Drawer({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="p3cm-dWrap" role="dialog" aria-modal="true">
      <button className="p3cm-dBackdrop" onClick={onClose} aria-label="Close details" />
      <aside className="p3cm-drawer">
        <div className="p3cm-dHead">
          <div className="p3cm-dTitle">{title}</div>
          <button className="p3cm-iconBtn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p3cm-dBody">{children}</div>
      </aside>
    </div>
  );
}

// Toast component
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`p3cm-toast ${toast.type || "ok"}`} role="status" aria-live="polite">
      <div className="p3cm-toast-icon">
        {toast.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      </div>
      <div className="p3cm-toast-content">
        <div className="p3cm-toast-title">{toast.title}</div>
        {toast.message && <div className="p3cm-toast-message">{toast.message}</div>}
      </div>
      <button className="p3cm-toast-close" onClick={onClose} type="button" aria-label="Close toast">
        <X size={16} />
      </button>
    </div>
  );
}

export default function P3CaseMonitoring() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");
  const [disease, setDisease] = useState("all");
  const [status, setStatus] = useState("all");

  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const selected = useMemo(() => cases.find((c) => c.id === selectedId) || null, [cases, selectedId]);

  // Local edit state for drawer
  const [edit, setEdit] = useState({ status: "", severity: "", notes: "" });

  const showToast = (type, title, message = "", ms = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToast({ id, type, title, message });
    setTimeout(() => {
      setToast(null);
    }, ms);
  };

  // Real-time Firestore subscription
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        setLoading(false);
        showToast("error", "Not Authenticated", "Please sign in to view cases.");
        return;
      }

      // Use the subscribeToCases function from the service
      unsubscribe = subscribeToCases((fetchedCases) => {
        if (isMounted) {
          setCases(fetchedCases || []);
          setLoading(false);
          setError(null);
        }
      });

      // If subscribeToCases returns null or undefined, fallback to manual query
      if (!unsubscribe) {
        // Fallback: Manual query
        const q = query(collection(db, "program3_cases"));
        const unsub = onSnapshot(q, (snapshot) => {
          if (isMounted) {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            // Sort client-side
            const sorted = data.sort((a, b) => {
              if (a.reportedDate > b.reportedDate) return -1;
              if (a.reportedDate < b.reportedDate) return 1;
              return 0;
            });
            setCases(sorted);
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
        showToast("error", "Connection Error", "Failed to load cases. Please refresh the page.");
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

  const openRow = (id) => {
    const row = cases.find((c) => c.id === id);
    setSelectedId(id);
    setDirty(false);
    setEdit({
      status: row?.status || "reported",
      severity: row?.severity || "medium",
      notes: row?.notes || "",
    });
  };

  const closeDrawer = () => {
    if (saving) return;
    setSelectedId(null);
    setDirty(false);
  };

  const saveChanges = async () => {
    if (!selected || saving) return;
    
    setSaving(true);
    try {
      // Update in Firestore
      await updateCaseInFirestore(selected.id, {
        status: edit.status,
        severity: edit.severity,
        notes: edit.notes,
      });

      // Update local state
      setCases((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, status: edit.status, severity: edit.severity, notes: edit.notes }
            : c
        )
      );
      setDirty(false);
      showToast("ok", "Case Updated", `Status: ${edit.status}, Severity: ${edit.severity}`);
    } catch (error) {
      console.error("Error updating case:", error);
      showToast("error", "Update Failed", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const quickSetStatus = (next) => {
    setEdit((e) => ({ ...e, status: next }));
    setDirty(true);
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return cases.filter((c) => {
      const passQ =
        !qq ||
        [c.id, c.disease, c.species, c.barangay, c.status, c.severity]
          .join(" ")
          .toLowerCase()
          .includes(qq);

      const passDisease = disease === "all" ? true : String(c.disease).toLowerCase() === disease.toLowerCase();
      const passStatus = status === "all" ? true : String(c.status).toLowerCase() === status.toLowerCase();

      return passQ && passDisease && passStatus;
    });
  }, [cases, q, disease, status]);

  const counts = useMemo(() => {
    const suspected = cases.filter((c) => c.status === "suspected").length;
    const confirmed = cases.filter((c) => c.status === "confirmed").length;
    const open = cases.filter((c) => c.status !== "closed").length;
    return { suspected, confirmed, open };
  }, [cases]);

  return (
    <div className="p3cm">
      {/* Toast */}
      {toast && (
        <Toast
          toast={toast}
          onClose={() => setToast(null)}
        />
      )}

      <div className="p3cm-head">
        <div>
          <div className="p3cm-h1">Case Monitoring</div>
          <div className="p3cm-sub">
            Filter suspected and confirmed cases, then open details for quick updates.
            {loading && <span className="p3cm-loading-indicator"> Loading...</span>}
            {error && <span className="p3cm-error-indicator"> ⚠️ Error loading</span>}
          </div>
        </div>
        <button 
          className="p3cm-refresh-btn"
          onClick={() => window.location.reload()}
          title="Refresh data"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="p3cm-kpis">
        <div className="p3cm-kpi">
          <div className="k-label">Open Cases</div>
          <div className="k-value">{counts.open}</div>
          <div className="k-meta"><span className="p3cm-badge neutral">neutral</span></div>
        </div>
        <div className="p3cm-kpi">
          <div className="k-label">Suspected</div>
          <div className="k-value">{counts.suspected}</div>
          <div className="k-meta"><span className="p3cm-badge warn">warn</span></div>
        </div>
        <div className="p3cm-kpi">
          <div className="k-label">Confirmed</div>
          <div className="k-value">{counts.confirmed}</div>
          <div className="k-meta"><span className="p3cm-badge bad">bad</span></div>
        </div>
      </div>

      <div className="p3cm-toolbar">
        <div className="p3cm-search">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, barangay, disease, status..."
          />
        </div>

        <div className="p3cm-filters">
          <div className="p3cm-filter">
            <Filter size={16} />
            <select value={disease} onChange={(e) => setDisease(e.target.value)}>
              <option value="all">All diseases</option>
              <option value="asf">ASF</option>
              <option value="bird flu">Bird Flu</option>
            </select>
          </div>

          <div className="p3cm-filter">
            <ClipboardList size={16} />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="reported">reported</option>
              <option value="suspected">suspected</option>
              <option value="investigated">investigated</option>
              <option value="confirmed">confirmed</option>
              <option value="closed">closed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p3cm-card">
        <div className="p3cm-cardHead">
          <div className="p3cm-cardTitle">Cases</div>
          <div className="p3cm-cardHint">
            {loading ? "Loading..." : `${filtered.length} result(s) — click row for details`}
          </div>
        </div>

        <div className="p3cm-tableWrap">
          {error ? (
            <div className="p3cm-error-state">
              <AlertTriangle size={24} />
              <p>Error loading cases: {error}</p>
              <button 
                className="p3cm-btn" 
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
            </div>
          ) : (
            <table className="p3cm-table">
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
                    <td colSpan={7} className="p3cm-emptyRow">
                      <div className="p3cm-loading-state">
                        <div className="p3cm-spinner"></div>
                        Loading cases...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p3cm-emptyRow">
                      <div className="p3cm-empty">
                        <AlertTriangle size={18} />
                        No matching cases.
                        <span className="muted">Try clearing filters or search.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="p3cm-row"
                      onClick={() => openRow(c.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          openRow(c.id);
                        }
                      }}
                    >
                      <td><b>{c.id.slice(0, 8)}</b></td>
                      <td>{c.disease}</td>
                      <td>{c.species}</td>
                      <td>{c.barangay}</td>
                      <td>{c.reportedDate}</td>
                      <td><span className={`p3cm-pill ${c.status}`}>{c.status}</span></td>
                      <td><span className={`p3cm-pill sev-${c.severity}`}>{c.severity}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Drawer
        open={!!selected && !loading}
        title={selected ? `${selected.id.slice(0, 8)} • ${selected.disease}` : "Case Details"}
        onClose={closeDrawer}
      >
        {selected ? (
          <>
            <div className="p3cm-dGrid">
              <div className="p3cm-dBox">
                <div className="lbl">Barangay</div>
                <div className="val">{selected.barangay}</div>
              </div>
              <div className="p3cm-dBox">
                <div className="lbl">Species</div>
                <div className="val">{selected.species}</div>
              </div>
              <div className="p3cm-dBox">
                <div className="lbl">Reported</div>
                <div className="val">{selected.reportedDate}</div>
              </div>
              <div className="p3cm-dBox">
                <div className="lbl">Reporter</div>
                <div className="val">{selected.reporter || "—"}</div>
              </div>
            </div>

            {selected.symptoms && selected.symptoms.length > 0 && (
              <div className="p3cm-dSection">
                <div className="secTitle">Symptoms</div>
                <div className="p3cm-symptoms">
                  {selected.symptoms.map((s, i) => (
                    <span key={i} className="p3cm-symptom-tag">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="p3cm-dSection">
              <div className="secTitle">Quick Status</div>
              <div className="p3cm-quick">
                {["reported", "suspected", "investigated", "confirmed", "closed"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`p3cm-qBtn ${edit.status === s ? "active" : ""}`}
                    onClick={() => quickSetStatus(s)}
                    disabled={saving}
                  >
                    {s} <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className="p3cm-dSection">
              <div className="secTitle">Update Details</div>

              <div className="p3cm-dForm">
                <label className="field">
                  <span>Status</span>
                  <select
                    value={edit.status}
                    onChange={(e) => {
                      setEdit((x) => ({ ...x, status: e.target.value }));
                      setDirty(true);
                    }}
                    disabled={saving}
                  >
                    <option value="reported">reported</option>
                    <option value="suspected">suspected</option>
                    <option value="investigated">investigated</option>
                    <option value="confirmed">confirmed</option>
                    <option value="closed">closed</option>
                  </select>
                </label>

                <label className="field">
                  <span>Severity</span>
                  <select
                    value={edit.severity}
                    onChange={(e) => {
                      setEdit((x) => ({ ...x, severity: e.target.value }));
                      setDirty(true);
                    }}
                    disabled={saving}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>

                <label className="field span2">
                  <span>Notes</span>
                  <textarea
                    rows={4}
                    value={edit.notes}
                    onChange={(e) => {
                      setEdit((x) => ({ ...x, notes: e.target.value }));
                      setDirty(true);
                    }}
                    disabled={saving}
                  />
                </label>
              </div>

              <div className="p3cm-dActions">
                <button 
                  className="p3cm-dBtn ghost" 
                  type="button" 
                  onClick={closeDrawer}
                  disabled={saving}
                >
                  Close
                </button>
                <button
                  className="p3cm-dBtn"
                  type="button"
                  onClick={saveChanges}
                  disabled={!dirty || saving}
                  title={!dirty ? "No changes to save" : saving ? "Saving..." : "Save changes"}
                >
                  <Save size={16} /> {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}