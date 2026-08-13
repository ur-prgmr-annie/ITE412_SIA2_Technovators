// src/pages/program3/P3StatusTracking.jsx
import { useMemo, useState, useEffect } from "react";
import "../../styles/p3StatusTracking.css";
import { Workflow, ChevronRight, CheckCircle2, AlertTriangle, RefreshCw, Loader } from "lucide-react";
import { auth, db } from "../../services/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  where,
  orderBy,
} from "firebase/firestore";
import { subscribeToCases, updateCaseInFirestore } from "../../services/program3CaseService";

const COLS = [
  { key: "reported", title: "Reported" },
  { key: "suspected", title: "Suspected" },
  { key: "investigated", title: "Investigated" },
  { key: "confirmed", title: "Confirmed" },
  { key: "closed", title: "Closed" },
];

function toneFor(status) {
  if (status === "confirmed") return "bad";
  if (status === "suspected" || status === "reported") return "warn";
  if (status === "investigated" || status === "closed") return "ok";
  return "neutral";
}

// Toast component
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`p3st-toast ${toast.type || "ok"}`} role="status" aria-live="polite">
      <div className="p3st-toast-icon">
        {toast.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      </div>
      <div className="p3st-toast-content">
        <div className="p3st-toast-title">{toast.title}</div>
        {toast.message && <div className="p3st-toast-message">{toast.message}</div>}
      </div>
      <button className="p3st-toast-close" onClick={onClose} type="button" aria-label="Close toast">
        <X size={16} />
      </button>
    </div>
  );
}

// Import X icon for toast close
import { X } from "lucide-react";

export default function P3StatusTracking() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [moving, setMoving] = useState({});

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
          setItems(fetchedCases || []);
          setLoading(false);
          setError(null);
        }
      });

      // If subscribeToCases returns null or undefined, fallback to manual query
      if (!unsubscribe) {
        const q = query(collection(db, "program3_cases"));
        const unsub = onSnapshot(q, (snapshot) => {
          if (isMounted) {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setItems(data);
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

  const byCol = useMemo(() => {
    const map = new Map(COLS.map((c) => [c.key, []]));
    items.forEach((it) => {
      const key = map.has(it.status) ? it.status : "reported";
      map.get(key).push(it);
    });
    return map;
  }, [items]);

  const move = async (id, dir) => {
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    
    const cur = items[idx];
    const colIndex = COLS.findIndex((c) => c.key === cur.status);
    const nextIndex = colIndex + dir;
    if (nextIndex < 0 || nextIndex >= COLS.length) return;

    const nextStatus = COLS[nextIndex].key;
    
    // Set moving state for this item
    setMoving(prev => ({ ...prev, [id]: true }));

    try {
      // Update in Firestore
      await updateCaseInFirestore(id, {
        status: nextStatus,
      });

      // Update local state optimistically
      setItems((prev) => {
        const copy = prev.slice();
        const idx2 = copy.findIndex((x) => x.id === id);
        if (idx2 !== -1) {
          copy[idx2] = { ...copy[idx2], status: nextStatus };
        }
        return copy;
      });

      showToast("ok", "Status Updated", `Moved to ${nextStatus}`);
    } catch (error) {
      console.error("Error moving case:", error);
      showToast("error", "Update Failed", error.message || "Please try again.");
      
      // Revert local state on error
      setItems((prev) => {
        const copy = prev.slice();
        const idx2 = copy.findIndex((x) => x.id === id);
        if (idx2 !== -1) {
          copy[idx2] = { ...copy[idx2], status: cur.status };
        }
        return copy;
      });
    } finally {
      setMoving(prev => ({ ...prev, [id]: false }));
    }
  };

  // Get status counts
  const statusCounts = useMemo(() => {
    const counts = {};
    COLS.forEach(col => {
      counts[col.key] = items.filter(item => item.status === col.key).length;
    });
    return counts;
  }, [items]);

  return (
    <div className="p3st">
      {/* Toast */}
      {toast && (
        <Toast
          toast={toast}
          onClose={() => setToast(null)}
        />
      )}

      <div className="p3st-head">
        <div>
          <div className="p3st-h1">Status Tracking</div>
          <div className="p3st-sub">
            Move cases through the workflow: <b>reported → suspected → investigated → confirmed → closed</b>.
            {loading && <span className="p3st-loading-indicator"> Loading...</span>}
            {error && <span className="p3st-error-indicator"> ⚠️ Error loading</span>}
          </div>
        </div>

        <div className="p3st-actions">
          <button 
            className="p3st-refresh-btn"
            onClick={() => window.location.reload()}
            title="Refresh data"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <div className="p3st-pill">
            <Workflow size={16} />
            Workflow Board
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="p3st-summary">
        <div className="p3st-summary-item">
          <span className="p3st-summary-label">Total Cases</span>
          <span className="p3st-summary-value">{items.length}</span>
        </div>
        {COLS.map(col => (
          <div key={col.key} className="p3st-summary-item">
            <span className="p3st-summary-label">{col.title}</span>
            <span className={`p3st-summary-value ${col.key}`}>{statusCounts[col.key] || 0}</span>
          </div>
        ))}
      </div>

      <div className="p3st-board">
        {COLS.map((col) => {
          const list = byCol.get(col.key) || [];
          return (
            <section key={col.key} className="p3st-col">
              <div className="p3st-colHead">
                <div className="p3st-colTitle">{col.title}</div>
                <div className="p3st-colCount">{list.length}</div>
              </div>

              <div className="p3st-colBody">
                {loading ? (
                  <div className="p3st-loading-state">
                    <Loader size={24} className="p3st-spinner" />
                    Loading...
                  </div>
                ) : error ? (
                  <div className="p3st-error-state">
                    <AlertTriangle size={20} />
                    <span>Error loading</span>
                  </div>
                ) : list.length === 0 ? (
                  <div className="p3st-empty">No cases in this stage.</div>
                ) : (
                  list.map((it) => {
                    const tone = toneFor(it.status);
                    const isMoving = moving[it.id];
                    return (
                      <div key={it.id} className={`p3st-card ${tone} ${isMoving ? 'moving' : ''}`}>
                        <div className="p3st-cardTop">
                          <div className="p3st-id">{it.id.slice(0, 8)}</div>
                          <span className={`p3st-badge sev-${it.severity}`}>{it.severity}</span>
                        </div>

                        <div className="p3st-main">
                          <div className="p3st-title">{it.disease}</div>
                          <div className="p3st-sub2">{it.barangay}</div>
                          <div className="p3st-meta">
                            <span className="p3st-meta-item">
                              Reported: {it.reportedDate}
                            </span>
                            {it.species && (
                              <span className="p3st-meta-item">
                                Species: {it.species}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p3st-actions">
                          <button
                            className="p3st-btn ghost"
                            onClick={() => move(it.id, -1)}
                            disabled={col.key === COLS[0].key || isMoving}
                            type="button"
                          >
                            {isMoving ? '...' : 'Back'}
                          </button>

                          <button
                            className="p3st-btn"
                            onClick={() => move(it.id, +1)}
                            disabled={col.key === COLS[COLS.length - 1].key || isMoving}
                            type="button"
                          >
                            {isMoving ? '...' : 'Next'} <ChevronRight size={16} />
                          </button>
                        </div>

                        <div className="p3st-hint">
                          {it.status === "confirmed" ? (
                            <span className="hintLine">
                              <AlertTriangle size={15} /> Confirmed: update GIS hotspots.
                            </span>
                          ) : it.status === "closed" ? (
                            <span className="hintLine">
                              <CheckCircle2 size={15} /> Closed: archived for reporting.
                            </span>
                          ) : (
                            <span className="hintLine">
                              <CheckCircle2 size={15} /> Keep status updated for accurate trends.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}