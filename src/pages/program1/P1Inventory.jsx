import { useEffect, useMemo, useState, useCallback } from "react";
import "../../styles/p1Inventory.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Boxes,
  Plus,
  X,
  Pencil,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  Download,
  Package,
  Truck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  FileText,
  Printer,
  History,
  Building,
  Users,
  Landmark,
} from "lucide-react";

import { auth, db } from "../../services/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";

// Helper functions
function makeId(prefix = "INV") {
  return `${prefix}-${Math.random().toString(16).slice(2, 7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

function fmtMaybe(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

// Round to 2 decimal places for display
const roundToTwo = (num) => {
  if (num === null || num === undefined) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Round to whole number for doses/animals
const roundToWhole = (num) => {
  if (num === null || num === undefined) return 0;
  return Math.floor(num);
};

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return "—";
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
}

// ========== CATEGORIES ==========
const ITEM_CATEGORIES = [
  "Vaccine",
  "Medicine",
  "Supply",
  "Disinfectant",
  "Dewormer",
  "Vitamin Supplement",
  "Antibiotic",
  "Equipment",
  "Other"
];

// ========== UNIT TYPES ==========
const UNIT_TYPES = [
  "vials",
  "bottles",
  "pcs",
  "sachets",
  "tubes",
  "tablets",
  "capsules"
];

// ========== LOCATIONS ==========
const STORAGE_LOCATIONS = [
  "Main Storage",
  "Clinic Room",
  "Cold Storage",
  "Field Kit",
  "Mobile Unit",
  "Pharmacy",
  "Other"
];

// ========== PROCUREMENT SOURCES ==========
const PROCUREMENT_SOURCES = [
  { value: "LGU", label: "LGU (Local Government Unit)", icon: Building },
  { value: "PROVET", label: "PROVET (Provincial Veterinarian)", icon: Users },
  { value: "BAI", label: "BAI (Bureau of Animal Industry)", icon: Landmark },
  { value: "DA", label: "DA (Department of Agriculture)", icon: Landmark },
  { value: "NGO", label: "NGO (Non-Government Organization)", icon: Users },
  { value: "Private", label: "Private Donation", icon: Package },
  { value: "Purchased", label: "Purchased (LGU Fund)", icon: Package },
  { value: "Other", label: "Other Source", icon: Package },
];

// ========== MOVEMENT TYPES ==========
const MOVEMENT_TYPES = [
  { value: "IN", label: "Stock In", icon: ArrowDownCircle, color: "#10b981" },
  { value: "OUT", label: "Stock Out", icon: ArrowUpCircle, color: "#ef4444" },
  { value: "ADJUST", label: "Adjustment", icon: ShieldAlert, color: "#f59e0b" },
  { value: "TRANSFER", label: "Transfer", icon: Truck, color: "#3b82f6" },
  { value: "RETURN", label: "Return", icon: Package, color: "#8b5cf6" },
  { value: "EXPIRED", label: "Expired", icon: AlertTriangle, color: "#6b7280" },
  { value: "DAMAGED", label: "Damaged", icon: X, color: "#dc2626" },
];

// ========== EXPORT FORMATS ==========
const EXPORT_FORMATS = [
  { value: "csv", label: "CSV (Excel)" },
  { value: "pdf", label: "PDF Report" },
  { value: "json", label: "JSON (Backup)" },
];

/* ===== Toast ===== */
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`p1t ${toast.type || "ok"}`} role="status" aria-live="polite">
      <div className="p1t-ico">
        {toast.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      </div>
      <div className="p1t-text">
        <div className="p1t-title">{toast.title}</div>
        {toast.sub ? <div className="p1t-sub">{toast.sub}</div> : null}
      </div>
      <button className="p1t-x" onClick={onClose} type="button" aria-label="Close toast">
        <X size={16} />
      </button>
    </div>
  );
}

/* ===== Confirm ===== */
function ConfirmModal({ open, title, message, dangerText = "Delete", onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="p1c-wrap" role="dialog" aria-modal="true">
      <button className="p1c-overlay" onClick={onCancel} aria-label="Close confirm" />
      <div className="p1c-card">
        <div className="p1c-head">
          <div className="p1c-titleRow">
            <AlertTriangle size={18} />
            <div className="p1c-title">{title}</div>
          </div>
          <button className="p1c-x" onClick={onCancel} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p1c-body">
          <div className="p1c-msg">{message}</div>
          <div className="p1c-actions">
            <button className="p1c-btn ghost" onClick={onCancel} type="button">
              Cancel
            </button>
            <button className="p1c-btn danger" onClick={onConfirm} type="button">
              {dangerText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Modal wrapper ===== */
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="p1m-wrap" role="dialog" aria-modal="true">
      <button className="p1m-overlay" onClick={onClose} aria-label="Close modal" />
      <div className="p1m-card">{children}</div>
    </div>
  );
}

/* ===== Export Modal ===== */
function ExportModal({ open, onClose, onExport }) {
  const [exportFormat, setExportFormat] = useState("csv");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [includeDetails, setIncludeDetails] = useState({
    items: true,
    batches: true,
    movements: true,
    usageHistory: true,
    procurement: true,
    summary: true,
  });
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      await onExport({
        format: exportFormat,
        dateRange,
        includeDetails,
      });
      onClose();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p1m-wrap" role="dialog" aria-modal="true">
      <div className="p1m-overlay" onClick={onClose} />
      <div className="p1m-card p1m-export">
        <div className="p1m2-head">
          <div>
            <div className="p1m2-title">Export Inventory Data</div>
            <div className="p1m2-sub">Download complete inventory report with procurement sources</div>
          </div>
          <button className="p1m2-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="p1m2-body">
          <div className="p1m2-card">
            <div className="p1m2-fields">
              <div className="p1m2-row">
                <label>Export Format</label>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                  {EXPORT_FORMATS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="p1m2-2">
                <div className="p1m2-row">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(d => ({ ...d, start: e.target.value }))}
                  />
                </div>
                <div className="p1m2-row">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(d => ({ ...d, end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="p1m2-row">
                <label>Include in Export</label>
                <div className="p1m2-checkbox-group">
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.items}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, items: e.target.checked }))}
                    />
                    <span>Items Master List</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.batches}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, batches: e.target.checked }))}
                    />
                    <span>Batches/Lots</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.movements}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, movements: e.target.checked }))}
                    />
                    <span>Stock Movements</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.usageHistory}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, usageHistory: e.target.checked }))}
                    />
                    <span>Usage History (Animals/Services)</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.procurement}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, procurement: e.target.checked }))}
                    />
                    <span>Procurement Sources (LGU, PROVET, BAI, etc.)</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.summary}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, summary: e.target.checked }))}
                    />
                    <span>Summary Report</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p1m2-foot">
          <div className="p1m2-footNote">
            <FileText size={16} />
            <span>Data will be exported based on selected options</span>
          </div>
          <div className="p1m2-actions">
            <button className="p1m2-btn ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="p1m2-btn" onClick={handleExport} disabled={busy}>
              {busy ? "Exporting..." : "Export Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function P1Inventory() {
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [moves, setMoves] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("items");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [procurementFilter, setProcurementFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [editing, setEditing] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState(null);

  // Form states
  const [itemForm, setItemForm] = useState({ 
    name: "", 
    unit: "vials", 
    category: "Vaccine",
    description: "",
    reorderPoint: 10,
    manufacturer: "",
  });
  
  const [batchForm, setBatchForm] = useState({ 
    batchNo: "", 
    expiryDate: "", 
    qtyOnHand: 0, 
    location: "Main Storage",
    manufacturingDate: "",
    receivedDate: "",
    supplier: "",
    lotNumber: "",
    unitCost: 0,
    procurementSource: "LGU",
    procurementReference: "",
    donor: "",
    remarks: "",
  });
  
  const [moveForm, setMoveForm] = useState({ 
    type: "IN", 
    qty: 0, 
    reference: "", 
    movedAt: new Date().toISOString().slice(0, 10),
    reason: "",
    destination: "",
    performedBy: "",
  });

  const showToast = (t) => {
    setToast(t);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  };

  // =========================
  // FIREBASE COLLECTIONS
  // =========================
  const itemsCol = collection(db, "p1_inventory_items");
  const batchesCol = collection(db, "p1_inventory_batches");
  const movesCol = collection(db, "p1_inventory_movements");
  const servicesCol = collection(db, "program1_routine_services");

  // =========================
  // LOAD ITEMS
  // =========================
  useEffect(() => {
    setErr("");
    setLoading(true);
    
    const qItems = query(itemsCol, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qItems,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(rows);
        setLoading(false);

        setSelectedItem((prev) => {
          if (prev && rows.some((r) => r.id === prev.id)) return prev;
          return null;
        });
      },
      (e) => {
        console.error(e);
        setErr("Failed to load inventory items.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // =========================
  // LOAD BATCHES
  // =========================
  useEffect(() => {
    if (!selectedItem?.id) {
      setBatches([]);
      setSelectedBatch(null);
      return;
    }

    const qBatches = query(
      batchesCol,
      where("itemId", "==", selectedItem.id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qBatches,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBatches(rows);

        setSelectedBatch((prev) => {
          if (prev && rows.some((r) => r.id === prev.id)) return prev;
          return null;
        });
      },
      (e) => {
        console.error(e);
        setErr("Failed to load batches.");
      }
    );

    return () => unsub();
  }, [selectedItem?.id]);

  // =========================
  // LOAD MOVEMENTS
  // =========================
  useEffect(() => {
    if (!selectedBatch?.id) {
      setMoves([]);
      return;
    }

    const qMoves = query(
      movesCol,
      where("batchId", "==", selectedBatch.id),
      orderBy("movedAt", "desc")
    );

    const unsub = onSnapshot(
      qMoves,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMoves(rows);
      },
      (e) => {
        console.error(e);
        setErr("Failed to load movements.");
      }
    );

    return () => unsub();
  }, [selectedBatch?.id]);

  // =========================
  // LOAD USAGE HISTORY
  // =========================
  useEffect(() => {
    const loadUsageHistory = async () => {
      try {
        const qServices = query(
          servicesCol,
          where("trackInventory", "==", true),
          orderBy("date", "desc")
        );
        
        const snapshot = await getDocs(qServices);
        const services = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const usage = [];
        services.forEach(service => {
          if (service.usedItems && service.usedItems.length > 0) {
            service.usedItems.forEach(item => {
              usage.push({
                id: `${service.id}-${item.batchId}`,
                date: service.date,
                serviceId: service.id,
                animalId: service.animalId,
                animalName: `${service.firstName || ''} ${service.lastName || ''}`.trim(),
                species: service.species,
                activity: service.activity,
                batchId: item.batchId,
                batchNo: item.batchNo,
                itemName: item.itemName,
                quantity: roundToTwo(item.quantity),
                unit: item.unit,
                headsCovered: item.headsCovered || 1,
                performedBy: service.performedBy,
                remarks: service.remarks,
              });
            });
          }
        });
        
        setUsageHistory(usage);
      } catch (e) {
        console.error("Error loading usage history:", e);
      }
    };

    loadUsageHistory();
  }, []);

  // =========================
  // FILTERS
  // =========================
  const filteredItems = useMemo(() => {
    let filtered = [...items];
    
    if (q) {
      const n = q.toLowerCase();
      filtered = filtered.filter(it => 
        (it.name || "").toLowerCase().includes(n) || 
        (it.category || "").toLowerCase().includes(n) ||
        (it.manufacturer || "").toLowerCase().includes(n)
      );
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(it => it.category === categoryFilter);
    }
    
    return filtered;
  }, [items, q, categoryFilter]);

  const filteredBatches = useMemo(() => {
    let filtered = [...batches];
    
    if (q) {
      const n = q.toLowerCase();
      filtered = filtered.filter(b => 
        (b.batchNo || "").toLowerCase().includes(n) || 
        (b.location || "").toLowerCase().includes(n) ||
        (b.supplier || "").toLowerCase().includes(n) ||
        (b.procurementSource || "").toLowerCase().includes(n)
      );
    }
    
    if (locationFilter) {
      filtered = filtered.filter(b => b.location === locationFilter);
    }
    
    if (procurementFilter) {
      filtered = filtered.filter(b => b.procurementSource === procurementFilter);
    }
    
    if (statusFilter) {
      const now = new Date();
      const threeMonths = new Date(now.setMonth(now.getMonth() + 3));
      
      filtered = filtered.filter(b => {
        const isLow = b.qtyOnHand <= (b.reorderPoint || 10);
        const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
        const isExpiring = b.expiryDate && new Date(b.expiryDate) <= threeMonths;
        
        if (statusFilter === "low") return isLow && !isExpired;
        if (statusFilter === "expired") return isExpired;
        if (statusFilter === "expiring") return isExpiring && !isExpired;
        return true;
      });
    }
    
    return filtered;
  }, [batches, q, locationFilter, procurementFilter, statusFilter]);

  const filteredMoves = useMemo(() => {
    let filtered = [...moves];
    
    if (q) {
      const n = q.toLowerCase();
      filtered = filtered.filter(m => 
        (m.reference || "").toLowerCase().includes(n) || 
        (m.type || "").toLowerCase().includes(n) ||
        (m.reason || "").toLowerCase().includes(n)
      );
    }
    
    return filtered;
  }, [moves, q]);

  const filteredUsage = useMemo(() => {
    let filtered = [...usageHistory];
    
    if (selectedBatch?.id) {
      filtered = filtered.filter(u => u.batchId === selectedBatch.id);
    }
    
    if (q) {
      const n = q.toLowerCase();
      filtered = filtered.filter(u => 
        (u.animalName || "").toLowerCase().includes(n) ||
        (u.activity || "").toLowerCase().includes(n) ||
        (u.batchNo || "").toLowerCase().includes(n)
      );
    }
    
    return filtered;
  }, [usageHistory, selectedBatch, q]);

  // =========================
  // STATS (with procurement breakdown) - ROUNDED
  // =========================
  const stats = useMemo(() => {
    const itemCount = items.length;
    
    const allBatches = selectedItem?.id 
      ? batches.filter(b => b.itemId === selectedItem.id)
      : batches;
    
    const batchCount = allBatches.length;
    const onHand = roundToTwo(allBatches.reduce((a, b) => a + Number(b.qtyOnHand || 0), 0));
    const lowStock = allBatches.filter((b) => Number(b.qtyOnHand || 0) <= (b.reorderPoint || 10)).length;
    
    const totalValue = allBatches.reduce((sum, b) => sum + ((b.qtyOnHand || 0) * (b.unitCost || 0)), 0);
    
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    const expiringSoon = allBatches.filter((b) => {
      if (!b.expiryDate) return false;
      const expiry = new Date(b.expiryDate);
      return expiry <= threeMonthsFromNow && expiry > new Date();
    }).length;
    
    const expired = allBatches.filter((b) => {
      if (!b.expiryDate) return false;
      return new Date(b.expiryDate) < new Date();
    }).length;

    // Procurement breakdown
    const byProcurement = {};
    allBatches.forEach(b => {
      const source = b.procurementSource || "Unknown";
      byProcurement[source] = (byProcurement[source] || 0) + (b.qtyOnHand || 0);
    });

    // Round procurement quantities
    Object.keys(byProcurement).forEach(key => {
      byProcurement[key] = roundToTwo(byProcurement[key]);
    });

    // Usage stats
    const totalUsed = roundToTwo(usageHistory.reduce((sum, u) => sum + u.quantity, 0));
    const totalAnimals = roundToWhole(usageHistory.reduce((sum, u) => sum + (u.headsCovered || 0), 0));
    
    return { 
      itemCount, 
      batchCount, 
      onHand, 
      lowStock, 
      expiringSoon, 
      expired,
      totalValue,
      totalUsed,
      totalAnimals,
      byProcurement
    };
  }, [items, batches, selectedItem, usageHistory]);

  // =========================
  // NAVIGATION
  // =========================
  const openItem = (it) => {
    setSelectedItem(it);
    setSelectedBatch(null);
    setTab("batches");
    setErr("");
    setQ("");
  };

  const openBatch = (b) => {
    setSelectedBatch(b);
    setTab("movements");
    setErr("");
    setQ("");
  };

  // =========================
  // OPEN CREATE/EDIT MODALS
  // =========================
  const openCreateItem = () => {
    setMode("item");
    setEditing(null);
    setItemForm({ 
      name: "", 
      unit: "vials", 
      category: "Vaccine",
      description: "",
      reorderPoint: 10,
      manufacturer: "",
    });
    setModalOpen(true);
  };

  const openEditItem = (it) => {
    setMode("item");
    setEditing(it);
    setItemForm({ 
      name: it.name || "", 
      unit: it.unit || "vials", 
      category: it.category || "Vaccine",
      description: it.description || "",
      reorderPoint: it.reorderPoint || 10,
      manufacturer: it.manufacturer || "",
    });
    setModalOpen(true);
  };

  const openCreateBatch = () => {
    setErr("");
    if (!selectedItem) return setErr("Select an item first.");
    setMode("batch");
    setEditing(null);
    setBatchForm({ 
      batchNo: "", 
      expiryDate: "", 
      qtyOnHand: 0, 
      location: "Main Storage",
      manufacturingDate: "",
      receivedDate: new Date().toISOString().slice(0, 10),
      supplier: "",
      lotNumber: "",
      unitCost: 0,
      procurementSource: "LGU",
      procurementReference: "",
      donor: "",
      remarks: "",
    });
    setModalOpen(true);
  };

  const openEditBatch = (b) => {
    setMode("batch");
    setEditing(b);
    setBatchForm({
      batchNo: b.batchNo || "",
      expiryDate: b.expiryDate || "",
      qtyOnHand: roundToTwo(b.qtyOnHand ?? 0),
      location: b.location || "Main Storage",
      manufacturingDate: b.manufacturingDate || "",
      receivedDate: b.receivedDate || "",
      supplier: b.supplier || "",
      lotNumber: b.lotNumber || "",
      unitCost: b.unitCost || 0,
      procurementSource: b.procurementSource || "LGU",
      procurementReference: b.procurementReference || "",
      donor: b.donor || "",
      remarks: b.remarks || "",
    });
    setModalOpen(true);
  };

  const openCreateMove = () => {
    setErr("");
    if (!selectedBatch) return setErr("Select a batch first.");
    setMode("move");
    setEditing(null);
    setMoveForm({ 
      type: "IN", 
      qty: 0, 
      reference: "", 
      movedAt: new Date().toISOString().slice(0, 10),
      reason: "",
      destination: "",
      performedBy: auth.currentUser?.displayName || "",
    });
    setModalOpen(true);
  };

  const openEditMove = (m) => {
    setMode("move");
    setEditing(m);
    setMoveForm({
      type: m.type || "IN",
      qty: roundToTwo(m.qty || 0),
      reference: m.reference || "",
      movedAt: m.movedAt || "",
      reason: m.reason || "",
      destination: m.destination || "",
      performedBy: m.performedBy || "",
    });
    setModalOpen(true);
  };

  // =========================
  // VALIDATION
  // =========================
  const validate = () => {
    if (mode === "item") {
      if (!itemForm.name.trim()) return "Item name is required.";
      return "";
    }
    if (mode === "batch") {
      if (!selectedItem?.id) return "Select an item first.";
      if (!batchForm.batchNo.trim()) return "Batch No is required.";
      if (!batchForm.expiryDate) return "Expiry date is required.";
      if (new Date(batchForm.expiryDate) < new Date()) return "Expiry date cannot be in the past.";
      if (!batchForm.receivedDate) return "Received date is required.";
      if (batchForm.qtyOnHand < 0) return "Quantity cannot be negative.";
      if (!batchForm.procurementSource) return "Procurement source is required.";
      return "";
    }
    if (mode === "move") {
      if (!selectedBatch?.id) return "Select a batch first.";
      const qty = Number(moveForm.qty || 0);
      if (!qty) return "Quantity is required.";
      if (!moveForm.movedAt) return "Date is required.";
      
      if (moveForm.type === "OUT" && qty > (selectedBatch.qtyOnHand || 0)) {
        return `Insufficient stock. Available: ${roundToTwo(selectedBatch.qtyOnHand)}`;
      }
      return "";
    }
    return "";
  };

  // =========================
  // SAVE TO FIREBASE (with rounding)
  // =========================
  const save = async () => {
    const m = validate();
    if (m) return setErr(m);

    const user = auth.currentUser;
    if (!user) return setErr("No active session. Please sign in again.");

    setBusy(true);
    setErr("");

    try {
      // ITEM
      if (mode === "item") {
        const payload = {
          name: itemForm.name.trim(),
          category: itemForm.category,
          unit: itemForm.unit.trim(),
          description: itemForm.description.trim(),
          reorderPoint: Number(itemForm.reorderPoint) || 10,
          manufacturer: itemForm.manufacturer.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        };

        if (editing?.id) {
          await updateDoc(doc(db, "p1_inventory_items", editing.id), payload);
          showToast({ title: "Item updated", sub: payload.name, type: "ok" });
        } else {
          await addDoc(itemsCol, {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
          });
          showToast({ title: "Item added", sub: payload.name, type: "ok" });
        }
      }

      // BATCH with procurement info
      if (mode === "batch") {
        const payload = {
          itemId: selectedItem.id,
          itemName: selectedItem.name || "",
          batchNo: batchForm.batchNo.trim(),
          expiryDate: batchForm.expiryDate,
          qtyOnHand: roundToTwo(Number(batchForm.qtyOnHand) || 0),
          location: batchForm.location.trim() || "Main Storage",
          manufacturingDate: batchForm.manufacturingDate || "",
          receivedDate: batchForm.receivedDate,
          supplier: batchForm.supplier.trim(),
          lotNumber: batchForm.lotNumber.trim(),
          unitCost: Number(batchForm.unitCost) || 0,
          procurementSource: batchForm.procurementSource,
          procurementReference: batchForm.procurementReference.trim(),
          donor: batchForm.donor.trim(),
          remarks: batchForm.remarks.trim(),
          reorderPoint: selectedItem.reorderPoint || 10,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        };

        if (editing?.id) {
          await updateDoc(doc(db, "p1_inventory_batches", editing.id), payload);
          showToast({ title: "Batch updated", sub: payload.batchNo, type: "ok" });
        } else {
          await addDoc(batchesCol, {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
          });
          showToast({ title: "Batch added", sub: payload.batchNo, type: "ok" });
        }
      }

      // MOVEMENT
      if (mode === "move") {
        const qty = Number(moveForm.qty || 0);
        const newOnHand = roundToTwo(calculateNewQuantity(selectedBatch.qtyOnHand || 0, moveForm.type, qty));

        const movementPayload = {
          batchId: selectedBatch.id,
          batchNo: selectedBatch.batchNo,
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          type: moveForm.type,
          qty: roundToTwo(qty),
          newBalance: newOnHand,
          reference: moveForm.reference.trim(),
          movedAt: moveForm.movedAt,
          reason: moveForm.reason.trim(),
          destination: moveForm.destination.trim(),
          performedBy: moveForm.performedBy || user.displayName || user.email,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        };

        if (editing?.id) {
          await updateDoc(doc(db, "p1_inventory_movements", editing.id), movementPayload);
          showToast({ title: "Movement updated", sub: `${movementPayload.type} • ${movementPayload.qty}`, type: "ok" });
        } else {
          await addDoc(movesCol, {
            ...movementPayload,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
          });

          await updateDoc(doc(db, "p1_inventory_batches", selectedBatch.id), {
            qtyOnHand: newOnHand,
            lastMovementDate: movementPayload.movedAt,
            lastMovementType: moveForm.type,
            updatedAt: serverTimestamp(),
          });

          showToast({
            title: "Movement saved",
            sub: `${movementPayload.type} • ${movementPayload.qty}`,
            type: "ok",
          });
        }
      }

      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      setErr("Failed to save. Check Firestore rules.");
    } finally {
      setBusy(false);
    }
  };

  const calculateNewQuantity = (current, type, qty) => {
    switch(type) {
      case "IN": return current + qty;
      case "OUT": return current - qty;
      case "RETURN": return current + qty;
      case "EXPIRED":
      case "DAMAGED": return current - qty;
      case "TRANSFER": return current - qty;
      case "ADJUST": return qty;
      default: return current;
    }
  };

  // =========================
  // FIXED: DELETE with proper quantity reversion
  // =========================
  const requestDelete = (kind, data) => {
    setToDelete({ kind, data });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;

    setBusy(true);
    setErr("");

    try {
      if (toDelete.kind === "item") {
        await deleteDoc(doc(db, "p1_inventory_items", toDelete.data.id));
        
        if (selectedItem?.id === toDelete.data.id) {
          setSelectedItem(null);
          setSelectedBatch(null);
          setTab("items");
        }
        showToast({ title: "Item deleted", sub: toDelete.data.name, type: "warn" });
      }

      else if (toDelete.kind === "batch") {
        await deleteDoc(doc(db, "p1_inventory_batches", toDelete.data.id));
        
        if (selectedBatch?.id === toDelete.data.id) {
          setSelectedBatch(null);
          setTab("batches");
        }
        showToast({ title: "Batch deleted", sub: toDelete.data.batchNo, type: "warn" });
      }

      else if (toDelete.kind === "move") {
        const move = toDelete.data;
        console.log("Deleting movement:", move);
        
        // Step 1: Revert the batch quantity FIRST
        if (move.batchId) {
          const batchRef = doc(db, "p1_inventory_batches", move.batchId);
          const batchSnap = await getDoc(batchRef);
          
          if (batchSnap.exists()) {
            const batch = batchSnap.data();
            const currentQty = batch.qtyOnHand || 0;
            
            // Calculate the quantity to revert based on movement type
            let revertQty;
            if (move.type === "OUT" || move.type === "EXPIRED" || move.type === "DAMAGED" || move.type === "TRANSFER") {
              // For OUT movements, ADD back the quantity
              revertQty = roundToTwo(currentQty + move.qty);
            } else if (move.type === "IN" || move.type === "RETURN") {
              // For IN movements, SUBTRACT the quantity
              revertQty = roundToTwo(currentQty - move.qty);
            } else {
              // For ADJUST or other types, keep as is
              revertQty = currentQty;
            }
            
            console.log(`Reverting quantity: ${currentQty} → ${revertQty} (${move.type} movement)`);
            
            // Update the batch quantity
            await updateDoc(batchRef, {
              qtyOnHand: revertQty,
              updatedAt: serverTimestamp(),
            });
          }
        }
        
        // Step 2: Delete the movement record
        await deleteDoc(doc(db, "p1_inventory_movements", move.id));
        
        showToast({ 
          title: "Movement deleted", 
          sub: `${move.type} • ${move.qty} • Stock reverted`, 
          type: "warn" 
        });
      }

      setConfirmOpen(false);
      setToDelete(null);
    } catch (e) {
      console.error("Delete error:", e);
      setErr(`Failed to delete: ${e.message}`);
      showToast({ 
        title: "Delete failed", 
        sub: e.message, 
        type: "error" 
      });
    } finally {
      setBusy(false);
    }
  };

  // =========================
  // EXPORT FUNCTION with Procurement (with rounded numbers)
  // =========================
  const handleExport = useCallback(async ({ format, dateRange, includeDetails }) => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: auth.currentUser?.email || "Unknown",
        dateRange,
        summary: {
          totalItems: items.length,
          totalBatches: batches.length,
          totalMovements: moves.length,
          totalValue: roundToTwo(stats.totalValue),
          lowStock: stats.lowStock,
          expiringSoon: stats.expiringSoon,
          expired: stats.expired,
          totalItemsUsed: roundToTwo(stats.totalUsed),
          totalAnimalsTreated: roundToWhole(stats.totalAnimals),
          byProcurement: stats.byProcurement,
        },
      };

      if (includeDetails.items) {
        exportData.items = items.map(item => ({
          ...item,
          createdAt: item.createdAt?.toDate(),
          updatedAt: item.updatedAt?.toDate(),
        }));
      }

      if (includeDetails.batches) {
        exportData.batches = batches.map(batch => ({
          ...batch,
          qtyOnHand: roundToTwo(batch.qtyOnHand),
          unitCost: roundToTwo(batch.unitCost),
          createdAt: batch.createdAt?.toDate(),
          updatedAt: batch.updatedAt?.toDate(),
          expiryDate: batch.expiryDate,
        }));
      }

      if (includeDetails.movements) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59);

        const filteredMoves = moves.filter(m => {
          const moveDate = new Date(m.movedAt);
          return moveDate >= startDate && moveDate <= endDate;
        });

        exportData.movements = filteredMoves.map(move => ({
          ...move,
          qty: roundToTwo(move.qty),
          newBalance: roundToTwo(move.newBalance),
          createdAt: move.createdAt?.toDate(),
          updatedAt: move.updatedAt?.toDate(),
        }));
      }

      if (includeDetails.usageHistory) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59);

        const filteredUsage = usageHistory.filter(u => {
          const useDate = new Date(u.date);
          return useDate >= startDate && useDate <= endDate;
        });

        exportData.usageHistory = filteredUsage.map(usage => ({
          ...usage,
          quantity: roundToTwo(usage.quantity),
          headsCovered: roundToWhole(usage.headsCovered),
          date: usage.date,
        }));
      }

      if (format === "csv") {
        // Generate CSV with rounded numbers
        let csv = "INVENTORY EXPORT REPORT\n";
        csv += `Exported: ${new Date().toLocaleString()}\n`;
        csv += `Exported By: ${auth.currentUser?.email || 'Unknown'}\n`;
        csv += `Date Range: ${dateRange.start} to ${dateRange.end}\n\n`;
        
        if (includeDetails.summary) {
          csv += "SUMMARY\n";
          csv += `Total Items,${exportData.summary.totalItems}\n`;
          csv += `Total Value,${exportData.summary.totalValue}\n`;
          csv += `Low Stock Items,${exportData.summary.lowStock}\n`;
          csv += `Expiring Soon,${exportData.summary.expiringSoon}\n`;
          csv += `Expired,${exportData.summary.expired}\n`;
          csv += `Total Items Used,${exportData.summary.totalItemsUsed}\n`;
          csv += `Total Animals Treated,${exportData.summary.totalAnimalsTreated}\n\n`;
          
          csv += "BREAKDOWN BY PROCUREMENT SOURCE\n";
          csv += "Source,Quantity\n";
          Object.entries(exportData.summary.byProcurement).forEach(([source, qty]) => {
            csv += `${source},${roundToTwo(qty)}\n`;
          });
          csv += "\n";
        }

        if (includeDetails.items && exportData.items) {
          csv += "ITEMS MASTER LIST\n";
          csv += "Name,Category,Unit,Manufacturer,Reorder Point,Description\n";
          exportData.items.forEach(item => {
            csv += `"${item.name}",${item.category},${item.unit},"${item.manufacturer || ''}",${item.reorderPoint},"${item.description || ''}"\n`;
          });
          csv += "\n";
        }

        if (includeDetails.batches && exportData.batches) {
          csv += "BATCHES/LOTS (with Procurement Info)\n";
          csv += "Item,Batch No,Lot Number,Expiry,Qty,Location,Supplier,Unit Cost,Total Value,Procurement Source,Reference/PO,Donor,Remarks\n";
          exportData.batches.forEach(b => {
            const totalValue = roundToTwo((b.qtyOnHand || 0) * (b.unitCost || 0));
            csv += `"${b.itemName}",${b.batchNo},${b.lotNumber || ''},${b.expiryDate},${b.qtyOnHand},${b.location},"${b.supplier || ''}",${b.unitCost || 0},${totalValue},${b.procurementSource || ''},"${b.procurementReference || ''}","${b.donor || ''}","${b.remarks || ''}"\n`;
          });
          csv += "\n";
        }

        if (includeDetails.movements && exportData.movements) {
          csv += "STOCK MOVEMENTS\n";
          csv += "Date,Type,Batch,Item,Quantity,New Balance,Reference,Reason,Destination,Performed By\n";
          exportData.movements.forEach(m => {
            csv += `${m.movedAt},${m.type},${m.batchNo},"${m.itemName}",${m.qty},${m.newBalance || ''},"${m.reference || ''}","${m.reason || ''}","${m.destination || ''}",${m.performedBy || ''}\n`;
          });
          csv += "\n";
        }

        if (includeDetails.usageHistory && exportData.usageHistory) {
          csv += "USAGE HISTORY (Where items were used)\n";
          csv += "Date,Animal,Species,Activity,Batch No,Item,Quantity Used,Heads Treated,Performed By,Remarks\n";
          exportData.usageHistory.forEach(u => {
            csv += `${u.date},"${u.animalName || 'Unknown'}",${u.species || ''},${u.activity},${u.batchNo},"${u.itemName}",${u.quantity},${u.headsCovered || 1},${u.performedBy || ''},"${u.remarks || ''}"\n`;
          });
          csv += "\n";
        }

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }       else if (format === "pdf") {
        // Landscape recommended for wide tables
        const doc = new jsPDF({ orientation: "landscape" });
        const fileName = `inventory_report_${new Date().toISOString().split("T")[0]}.pdf`;

        // ===== HEADER =====
        doc.setFontSize(14);
        doc.text("VACCINE & SUPPLY INVENTORY REPORT", 14, 14);

        doc.setFontSize(10);
        const metaLines = [
          `Exported: ${new Date().toLocaleString("en-PH")}`,
          `Exported By: ${auth.currentUser?.email || "Unknown"}`,
          `Date Range: ${dateRange.start} to ${dateRange.end}`,
          `Selected Item: ${selectedItem?.name || "All"}`,
          `Selected Batch: ${selectedBatch?.batchNo || "All"}`,
          `Search: ${q || "None"}`,
          `Filters: Category=${categoryFilter || "All"} | Location=${locationFilter || "All"} | Source=${procurementFilter || "All"} | Status=${statusFilter || "All"}`,
        ];

        let y = 22;
        metaLines.forEach((line) => {
          doc.text(line, 14, y);
          y += 5;
        });

        // ===== SUMMARY =====
        if (includeDetails.summary) {
          autoTable(doc, {
            startY: y + 2,
            head: [["Summary", "Value"]],
            body: [
              ["Total Items", String(exportData.summary.totalItems)],
              ["Total Batches", String(exportData.summary.totalBatches)],
              ["Total Movements", String(exportData.summary.totalMovements)],
              ["Total Value", String(exportData.summary.totalValue)],
              ["Low Stock", String(exportData.summary.lowStock)],
              ["Expiring Soon", String(exportData.summary.expiringSoon)],
              ["Expired", String(exportData.summary.expired)],
              ["Total Items Used", String(exportData.summary.totalItemsUsed)],
              ["Total Animals Treated", String(exportData.summary.totalAnimalsTreated)],
            ],
            styles: { fontSize: 9 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });

          // Procurement breakdown
          const byProcRows = Object.entries(exportData.summary.byProcurement || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([src, qty]) => [src, String(roundToTwo(qty))]);

          if (byProcRows.length) {
            autoTable(doc, {
              startY: doc.lastAutoTable.finalY + 6,
              head: [["Breakdown by Procurement Source", "Quantity"]],
              body: byProcRows,
              styles: { fontSize: 9 },
              headStyles: { fontStyle: "bold" },
              theme: "grid",
              margin: { left: 14, right: 14 },
            });
          }

          y = doc.lastAutoTable.finalY + 10;
        } else {
          y += 6;
        }

        // Helper: safe new page if near bottom
        const ensureSpace = (need = 25) => {
          const pageH = doc.internal.pageSize.getHeight();
          if (y + need > pageH - 10) {
            doc.addPage();
            y = 14;
          }
        };

        // ===== ITEMS TABLE =====
        if (includeDetails.items && exportData.items?.length) {
          ensureSpace(30);
          doc.setFontSize(12);
          doc.text("Items Master List", 14, y);
          y += 4;

          autoTable(doc, {
            startY: y,
            head: [["Name", "Category", "Unit", "Manufacturer", "Reorder Point", "Description"]],
            body: exportData.items.map((it) => [
              it.name || "",
              it.category || "",
              it.unit || "",
              it.manufacturer || "",
              String(it.reorderPoint ?? 10),
              it.description || "",
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });

          y = doc.lastAutoTable.finalY + 10;
        }

        // ===== BATCHES TABLE =====
        if (includeDetails.batches && exportData.batches?.length) {
          ensureSpace(30);
          doc.setFontSize(12);
          doc.text("Batches / Lots (with Procurement)", 14, y);
          y += 4;

          autoTable(doc, {
            startY: y,
            head: [[
              "Item",
              "Batch No",
              "Lot No",
              "Expiry",
              "Qty On Hand",
              "Location",
              "Supplier",
              "Unit Cost",
              "Total Value",
              "Source",
              "Reference",
              "Donor",
              "Remarks"
            ]],
            body: exportData.batches.map((b) => {
              const totalVal = roundToTwo((b.qtyOnHand || 0) * (b.unitCost || 0));
              return [
                b.itemName || "",
                b.batchNo || "",
                b.lotNumber || "",
                b.expiryDate ? formatDate(b.expiryDate) : "",
                String(roundToTwo(b.qtyOnHand)),
                b.location || "",
                b.supplier || "",
                String(roundToTwo(b.unitCost || 0)),
                String(totalVal),
                b.procurementSource || "",
                b.procurementReference || "",
                b.donor || "",
                b.remarks || "",
              ];
            }),
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 10, right: 10 },
          });

          y = doc.lastAutoTable.finalY + 10;
        }

        // ===== MOVEMENTS TABLE (date range filtered already) =====
        if (includeDetails.movements && exportData.movements?.length) {
          ensureSpace(30);
          doc.setFontSize(12);
          doc.text("Stock Movements", 14, y);
          y += 4;

          autoTable(doc, {
            startY: y,
            head: [["Date", "Type", "Batch", "Item", "Qty", "New Balance", "Reference", "Reason", "Destination", "Performed By"]],
            body: exportData.movements.map((m) => [
              m.movedAt ? formatDate(m.movedAt) : "",
              m.type || "",
              m.batchNo || "",
              m.itemName || "",
              String(roundToTwo(m.qty)),
              m.newBalance !== undefined ? String(roundToTwo(m.newBalance)) : "",
              m.reference || "",
              m.reason || "",
              m.destination || "",
              m.performedBy || "",
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 10, right: 10 },
          });

          y = doc.lastAutoTable.finalY + 10;
        }

        // ===== USAGE HISTORY TABLE =====
        if (includeDetails.usageHistory && exportData.usageHistory?.length) {
          ensureSpace(30);
          doc.setFontSize(12);
          doc.text("Usage History (Animals/Services)", 14, y);
          y += 4;

          autoTable(doc, {
            startY: y,
            head: [["Date", "Animal", "Species", "Activity", "Batch No", "Item", "Qty Used", "Heads", "Performed By", "Remarks"]],
            body: exportData.usageHistory.map((u) => [
              u.date ? formatDate(u.date) : "",
              u.animalName || "Unknown",
              u.species || "",
              u.activity || "",
              u.batchNo || "",
              u.itemName || "",
              `${roundToTwo(u.quantity)} ${u.unit || ""}`.trim(),
              String(roundToWhole(u.headsCovered || 0)),
              u.performedBy || "",
              u.remarks || "",
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 10, right: 10 },
          });

          y = doc.lastAutoTable.finalY + 10;
        }

        // Footer page numbers
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 8);
        }

        doc.save(fileName);
      }
      else if (format === "json") {
        // Download JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      showToast({ title: "Export successful", sub: `Data exported as ${format.toUpperCase()} with rounded numbers`, type: "ok" });
    } catch (e) {
      console.error("Export failed:", e);
      showToast({ title: "Export failed", sub: e.message, type: "error" });
    }
  }, [items, batches, moves, usageHistory, stats]);

  // =========================
  // HEADER RIGHT BUTTON
  // =========================
  const headerRight = useMemo(() => {
    if (tab === "items")
      return (
        <button className="p1i-primary" onClick={openCreateItem} type="button" disabled={busy}>
          <Plus size={18} /> Add Item
        </button>
      );
    if (tab === "batches")
      return (
        <button className="p1i-primary" onClick={openCreateBatch} type="button" disabled={busy || !selectedItem}>
          <Plus size={18} /> Add Batch
        </button>
      );
    return (
      <button className="p1i-primary" onClick={openCreateMove} type="button" disabled={busy || !selectedBatch}>
        <Plus size={18} /> Add Movement
      </button>
    );
  }, [tab, selectedItem, selectedBatch, busy]);

  // =========================
  // RENDER
  // =========================
  if (loading) {
    return (
      <div className="p1i-page p1-fontPro">
        <div className="p1i-loading">
          Loading inventory...
        </div>
      </div>
    );
  }

  return (
    <div className="p1i-page p1-fontPro">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="p1i-shell">
        <div className="p1i-top">
          <div>
            <div className="p1i-h1">Vaccine & Supply Inventory</div>
            <div className="p1i-sub">Complete tracking with rounded numbers for clean display</div>
          </div>

          <div className="p1i-topActions">
            <button
              className="p1i-iconBtn"
              title="Export Data with Procurement Info"
              type="button"
              onClick={() => setExportModalOpen(true)}
            >
              <Download size={18} />
            </button>
            <button
              className="p1i-iconBtn"
              title="Print Report"
              type="button"
              onClick={() => window.print()}
            >
              <Printer size={18} />
            </button>
            {headerRight}
          </div>
        </div>

        {err ? <div className="p1i-error">{err}</div> : null}

        <div className="p1i-toolbar">
          <div className="p1i-search">
            <Search size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "items"
                  ? "Search items by name/category/manufacturer…"
                  : tab === "batches"
                  ? "Search batches by no/location/supplier/procurement…"
                  : "Search movements by type/reference/reason…"
              }
            />
            {q ? (
              <button className="p1i-clear" onClick={() => setQ("")} type="button" aria-label="Clear search">
                <X size={16} />
              </button>
            ) : null}
          </div>

          {tab === "items" && (
            <div className="p1i-filter">
              <Filter size={16} />
              <select 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p1i-filter-select"
              >
                <option value="">All Categories</option>
                {ITEM_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {tab === "batches" && (
            <>
              <div className="p1i-filter">
                <Filter size={16} />
                <select 
                  value={locationFilter} 
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="p1i-filter-select"
                >
                  <option value="">All Locations</option>
                  {STORAGE_LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="p1i-filter">
                <Filter size={16} />
                <select 
                  value={procurementFilter} 
                  onChange={(e) => setProcurementFilter(e.target.value)}
                  className="p1i-filter-select"
                >
                  <option value="">All Sources</option>
                  {PROCUREMENT_SOURCES.map(source => (
                    <option key={source.value} value={source.value}>{source.label}</option>
                  ))}
                </select>
              </div>
              <div className="p1i-filter">
                <Filter size={16} />
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p1i-filter-select"
                >
                  <option value="">All Status</option>
                  <option value="good">Good</option>
                  <option value="low">Low Stock</option>
                  <option value="expiring">Expiring Soon</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </>
          )}

          <div className="p1i-tabs">
            <button 
              className={tab === "items" ? "active" : ""} 
              onClick={() => setTab("items")} 
              type="button"
            >
              <Boxes size={16} /> Items
            </button>

            <button
              className={tab === "batches" ? "active" : ""}
              onClick={() => setTab("batches")}
              type="button"
              disabled={!selectedItem}
              title={!selectedItem ? "Select an item first" : ""}
            >
              <SlidersHorizontal size={16} /> Batches
            </button>

            <button
              className={tab === "movements" ? "active" : ""}
              onClick={() => setTab("movements")}
              type="button"
              disabled={!selectedBatch}
              title={!selectedBatch ? "Select a batch first" : ""}
            >
              <History size={16} /> Movements
            </button>
          </div>
        </div>

        <div className="p1i-stats">
          <div className="p1i-statCard">
            <div className="p1i-statLabel">Items</div>
            <div className="p1i-statValue">{stats.itemCount}</div>
            <div className="p1i-statMeta">Total inventory items</div>
          </div>

          <div className="p1i-statCard">
            <div className="p1i-statLabel">Batches</div>
            <div className="p1i-statValue">{stats.batchCount}</div>
            <div className="p1i-statMeta">
              {selectedItem ? `For ${selectedItem.name}` : "Select an item"}
            </div>
          </div>

          <div className="p1i-statCard">
            <div className="p1i-statLabel">On Hand</div>
            <div className="p1i-statValue">{stats.onHand}</div>
            <div className="p1i-statMeta">Total quantity</div>
          </div>

          <div className="p1i-statCard">
            <div className="p1i-statLabel">Value</div>
            <div className="p1i-statValue">{formatCurrency(stats.totalValue)}</div>
            <div className="p1i-statMeta">Total value</div>
          </div>
        </div>

        {/* Procurement Stats */}
        <div className="p1i-stats">
          <div className="p1i-statCard">
            <div className="p1i-statLabel">LGU</div>
            <div className="p1i-statValue">{stats.byProcurement?.LGU || 0}</div>
            <div className="p1i-statMeta">Local Government</div>
          </div>
          <div className="p1i-statCard">
            <div className="p1i-statLabel">PROVET</div>
            <div className="p1i-statValue">{stats.byProcurement?.PROVET || 0}</div>
            <div className="p1i-statMeta">Provincial Vet</div>
          </div>
          <div className="p1i-statCard">
            <div className="p1i-statLabel">BAI</div>
            <div className="p1i-statValue">{stats.byProcurement?.BAI || 0}</div>
            <div className="p1i-statMeta">Bureau of Animal Industry</div>
          </div>
          <div className="p1i-statCard">
            <div className="p1i-statLabel">Items Used</div>
            <div className="p1i-statValue">{stats.totalUsed}</div>
            <div className="p1i-statMeta">Total quantity used</div>
          </div>
        </div>

        {/* Status Alerts */}
        {(stats.lowStock > 0 || stats.expiringSoon > 0 || stats.expired > 0) && (
          <div className="p1i-alerts">
            {stats.lowStock > 0 && (
              <div className="p1i-alert warning">
                <AlertTriangle size={16} />
                <span>{stats.lowStock} item(s) are low on stock.</span>
              </div>
            )}
            {stats.expiringSoon > 0 && (
              <div className="p1i-alert info">
                <Calendar size={16} />
                <span>{stats.expiringSoon} batch(es) expiring soon.</span>
              </div>
            )}
            {stats.expired > 0 && (
              <div className="p1i-alert error">
                <X size={16} />
                <span>{stats.expired} batch(es) have expired.</span>
              </div>
            )}
          </div>
        )}

        {/* ITEMS */}
        {tab === "items" ? (
          <div className="p1i-card">
            <table className="p1i-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Manufacturer</th>
                  <th>Reorder Point</th>
                  <th>Batches</th>
                  <th className="act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => {
                  const itemBatches = batches.filter(b => b.itemId === it.id);
                  const totalStock = roundToTwo(itemBatches.reduce((sum, b) => sum + (b.qtyOnHand || 0), 0));
                  
                  return (
                    <tr key={it.id} className="p1i-row" onClick={() => openItem(it)}>
                      <td>
                        <div className="p1i-cellMain">
                          <Package size={16} />
                          <b>{it.name}</b>
                        </div>
                        {it.description && (
                          <div className="p1i-cellSub">{it.description}</div>
                        )}
                      </td>
                      <td>{fmtMaybe(it.category)}</td>
                      <td>{fmtMaybe(it.unit)}</td>
                      <td>{fmtMaybe(it.manufacturer)}</td>
                      <td>{it.reorderPoint || 10}</td>
                      <td>{itemBatches.length} ({totalStock} {it.unit})</td>
                      <td className="p1i-acts" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="p1i-icoBtn" 
                          onClick={() => openEditItem(it)} 
                          disabled={busy} 
                          type="button"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="p1i-icoBtn danger"
                          onClick={() => requestDelete("item", it)}
                          disabled={busy}
                          type="button"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p1i-empty">
                      No items found. Click "Add Item" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* BATCHES with Procurement Info */}
        {tab === "batches" ? (
          <div className="p1i-card">
            <div className="p1i-hint">
              <Package size={16} />
              <span>
                <b>{selectedItem?.name || "—"}</b>
                {selectedItem?.description && ` • ${selectedItem.description}`}
              </span>
            </div>

            <table className="p1i-table">
              <thead>
                <tr>
                  <th>Batch No</th>
                  <th>Lot Number</th>
                  <th>Expiry</th>
                  <th>On Hand</th>
                  <th>Location</th>
                  <th>Procurement Source</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th className="act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((b) => {
                  const isLow = Number(b.qtyOnHand || 0) <= (b.reorderPoint || 10);
                  const isExpiring = b.expiryDate && new Date(b.expiryDate) <= new Date(Date.now() + 90*24*60*60*1000);
                  const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
                  
                  let statusClass = "ok";
                  let statusText = "Good";
                  if (isExpired) {
                    statusClass = "expired";
                    statusText = "Expired";
                  } else if (isLow) {
                    statusClass = "low";
                    statusText = "Low Stock";
                  } else if (isExpiring) {
                    statusClass = "expiring";
                    statusText = "Expiring Soon";
                  }

                  // Get procurement icon
                  const ProcurementIcon = PROCUREMENT_SOURCES.find(s => s.value === b.procurementSource)?.icon || Package;
                  
                  return (
                    <tr key={b.id} className="p1i-row" onClick={() => openBatch(b)}>
                      <td>
                        <div className="p1i-cellMain">
                          <Truck size={16} />
                          <b>{b.batchNo}</b>
                        </div>
                      </td>
                      <td>{b.lotNumber || "—"}</td>
                      <td>
                        {b.expiryDate ? (
                          <span className={isExpired ? "p1i-expired" : ""}>
                            {formatDate(b.expiryDate)}
                            {isExpired && " ⚠️"}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className={`p1i-pill ${statusClass}`}>
                          {roundToTwo(b.qtyOnHand ?? 0)} {selectedItem?.unit}
                        </span>
                      </td>
                      <td>{fmtMaybe(b.location)}</td>
                      <td>
                        <div className="p1i-cellMain">
                          <ProcurementIcon size={14} />
                          <span>{b.procurementSource || "—"}</span>
                        </div>
                        {b.donor && <div className="p1i-cellSub">Donor: {b.donor}</div>}
                      </td>
                      <td>
                        {b.procurementReference || "—"}
                        {b.supplier && <div className="p1i-cellSub">Supplier: {b.supplier}</div>}
                      </td>
                      <td>
                        <span className={`p1i-pill ${statusClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="p1i-acts" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="p1i-icoBtn" 
                          onClick={() => openEditBatch(b)} 
                          disabled={busy} 
                          type="button"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="p1i-icoBtn danger"
                          onClick={() => requestDelete("batch", b)}
                          disabled={busy}
                          type="button"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p1i-empty">
                      No batches for this item. Click "Add Batch" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* MOVEMENTS */}
        {tab === "movements" ? (
          <div className="p1i-card">
            <div className="p1i-hint">
              <Package size={16} />
              <span>
                <b>{selectedItem?.name}</b> • Batch: <b>{selectedBatch?.batchNo}</b> • 
                On hand: <b>{roundToTwo(selectedBatch?.qtyOnHand ?? 0)} {selectedItem?.unit}</b> •
                Source: <b>{selectedBatch?.procurementSource || "—"}</b>
              </span>
            </div>

            <table className="p1i-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>New Balance</th>
                  <th>Reference</th>
                  <th>Performed By</th>
                  <th className="act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMoves.map((m) => {
                  const MoveIcon = MOVEMENT_TYPES.find(t => t.value === m.type)?.icon || ArrowDownCircle;
                  
                  return (
                    <tr key={m.id} className="p1i-row">
                      <td>{formatDate(m.movedAt)}</td>
                      <td>
                        <span className={`p1i-pill ${m.type.toLowerCase()}`}>
                          <MoveIcon size={14} />
                          {m.type}
                        </span>
                      </td>
                      <td>
                        <b>{roundToTwo(m.qty)}</b>
                      </td>
                      <td>{roundToTwo(m.newBalance) ?? "—"}</td>
                      <td>
                        {fmtMaybe(m.reference)}
                        {m.reason && <div className="p1i-cellSub">{m.reason}</div>}
                      </td>
                      <td>{fmtMaybe(m.performedBy)}</td>
                      <td className="p1i-acts">
                        <button
                          className="p1i-icoBtn danger"
                          onClick={() => requestDelete("move", m)}
                          disabled={busy}
                          type="button"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredMoves.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p1i-empty">
                      No movements for this batch. Click "Add Movement" to record stock movement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Usage History for this Batch */}
            {filteredUsage.length > 0 && (
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--p1-border)' }}>
                <div className="p1i-hint">
                  <History size={16} />
                  <span>Usage History (Where this batch was used)</span>
                </div>
                <table className="p1i-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Animal</th>
                      <th>Species</th>
                      <th>Activity</th>
                      <th>Quantity</th>
                      <th>Heads</th>
                      <th>Performed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsage.slice(0, 10).map((u, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(u.date)}</td>
                        <td>{u.animalName || "—"}</td>
                        <td>{u.species || "—"}</td>
                        <td>{u.activity}</td>
                        <td>{roundToTwo(u.quantity)} {u.unit}</td>
                        <td>{roundToWhole(u.headsCovered)}</td>
                        <td>{u.performedBy || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {/* MODALS */}
        <Modal open={modalOpen} onClose={() => (busy ? null : setModalOpen(false))}>
          <div className="p1m2">
            <div className="p1m2-head">
              <div>
                <div className="p1m2-title">
                  {mode === "item"
                    ? editing
                      ? "Edit Item"
                      : "Add New Item"
                    : mode === "batch"
                    ? editing
                      ? "Edit Batch"
                      : "Add New Batch"
                    : editing
                    ? "Edit Movement"
                    : "Add New Movement"}
                </div>
                <div className="p1m2-sub">
                  {mode === "item" && "Create or edit inventory items"}
                  {mode === "batch" && `For item: ${selectedItem?.name || ""}`}
                  {mode === "move" && `For batch: ${selectedBatch?.batchNo || ""}`}
                </div>
              </div>

              <button className="p1m2-close" onClick={() => setModalOpen(false)} type="button" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p1m2-body">
              {err ? <div className="p1m2-inlineErr">{err}</div> : null}

              <div className="p1m2-card">
                <div className="p1m2-fields">
                  {/* ITEM FORM */}
                  {mode === "item" ? (
                    <>
                      <div className="p1m2-row">
                        <label>Item name <span className="p1m2-req">*</span></label>
                        <input 
                          value={itemForm.name} 
                          onChange={(e) => setItemForm((s) => ({ ...s, name: e.target.value }))}
                          placeholder="e.g., Anti-rabies Vaccine"
                        />
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Category</label>
                          <select 
                            value={itemForm.category} 
                            onChange={(e) => setItemForm((s) => ({ ...s, category: e.target.value }))}
                          >
                            {ITEM_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="p1m2-row">
                          <label>Unit</label>
                          <select 
                            value={itemForm.unit} 
                            onChange={(e) => setItemForm((s) => ({ ...s, unit: e.target.value }))}
                          >
                            {UNIT_TYPES.map(unit => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Manufacturer</label>
                          <input 
                            value={itemForm.manufacturer} 
                            onChange={(e) => setItemForm((s) => ({ ...s, manufacturer: e.target.value }))}
                            placeholder="e.g., Zoetis"
                          />
                        </div>
                        <div className="p1m2-row">
                          <label>Reorder Point</label>
                          <input 
                            type="number"
                            min="0"
                            value={itemForm.reorderPoint} 
                            onChange={(e) => setItemForm((s) => ({ ...s, reorderPoint: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="p1m2-row">
                        <label>Description</label>
                        <textarea
                          rows={2}
                          value={itemForm.description}
                          onChange={(e) => setItemForm((s) => ({ ...s, description: e.target.value }))}
                          placeholder="Additional details about this item"
                        />
                      </div>
                    </>
                  ) : null}

                  {/* BATCH FORM with Procurement */}
                  {mode === "batch" ? (
                    <>
                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Batch No <span className="p1m2-req">*</span></label>
                          <input 
                            value={batchForm.batchNo} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, batchNo: e.target.value }))}
                            placeholder="e.g., ARV-2409"
                          />
                        </div>
                        <div className="p1m2-row">
                          <label>Lot Number</label>
                          <input 
                            value={batchForm.lotNumber} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, lotNumber: e.target.value }))}
                            placeholder="Manufacturer lot #"
                          />
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Expiry Date <span className="p1m2-req">*</span></label>
                          <input 
                            type="date" 
                            value={batchForm.expiryDate} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, expiryDate: e.target.value }))}
                          />
                        </div>
                        <div className="p1m2-row">
                          <label>Manufacturing Date</label>
                          <input 
                            type="date" 
                            value={batchForm.manufacturingDate} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, manufacturingDate: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Received Date <span className="p1m2-req">*</span></label>
                          <input 
                            type="date" 
                            value={batchForm.receivedDate} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, receivedDate: e.target.value }))}
                          />
                        </div>
                        <div className="p1m2-row">
                          <label>Initial Quantity</label>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={batchForm.qtyOnHand} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, qtyOnHand: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Unit Cost (₱)</label>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={batchForm.unitCost} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, unitCost: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="p1m2-row">
                          <label>Location</label>
                          <select 
                            value={batchForm.location} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, location: e.target.value }))}
                          >
                            {STORAGE_LOCATIONS.map(loc => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Supplier</label>
                          <input 
                            value={batchForm.supplier} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, supplier: e.target.value }))}
                            placeholder="e.g., PharmaCorp"
                          />
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Procurement Source <span className="p1m2-req">*</span></label>
                          <select 
                            value={batchForm.procurementSource} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, procurementSource: e.target.value }))}
                          >
                            {PROCUREMENT_SOURCES.map(source => (
                              <option key={source.value} value={source.value}>{source.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="p1m2-row">
                          <label>Reference/PO No.</label>
                          <input 
                            value={batchForm.procurementReference} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, procurementReference: e.target.value }))}
                            placeholder="e.g., PO-2024-001"
                          />
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Donor (if applicable)</label>
                          <input 
                            value={batchForm.donor} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, donor: e.target.value }))}
                            placeholder="Name of donor organization"
                          />
                        </div>
                        <div className="p1m2-row">
                          <label>Remarks</label>
                          <input 
                            value={batchForm.remarks} 
                            onChange={(e) => setBatchForm((s) => ({ ...s, remarks: e.target.value }))}
                            placeholder="Additional notes"
                          />
                        </div>
                      </div>
                    </>
                  ) : null}

                  {/* MOVEMENT FORM */}
                  {mode === "move" ? (
                    <>
                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Type</label>
                          <select 
                            value={moveForm.type} 
                            onChange={(e) => setMoveForm((s) => ({ ...s, type: e.target.value }))}
                          >
                            {MOVEMENT_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="p1m2-row">
                          <label>Date <span className="p1m2-req">*</span></label>
                          <input 
                            type="date" 
                            value={moveForm.movedAt} 
                            onChange={(e) => setMoveForm((s) => ({ ...s, movedAt: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="p1m2-2">
                        <div className="p1m2-row">
                          <label>Quantity <span className="p1m2-req">*</span></label>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={moveForm.qty} 
                            onChange={(e) => setMoveForm((s) => ({ ...s, qty: e.target.value }))}
                          />
                        </div>
                        <div className="p1m2-row">
                          <label>Reference</label>
                          <input 
                            value={moveForm.reference} 
                            onChange={(e) => setMoveForm((s) => ({ ...s, reference: e.target.value }))}
                            placeholder="e.g., PO-12345"
                          />
                        </div>
                      </div>

                      <div className="p1m2-row">
                        <label>Reason / Notes</label>
                        <input 
                          value={moveForm.reason} 
                          onChange={(e) => setMoveForm((s) => ({ ...s, reason: e.target.value }))}
                          placeholder="e.g., Vaccination day, Expired stock"
                        />
                      </div>

                      {(moveForm.type === "TRANSFER" || moveForm.type === "OUT") && (
                        <div className="p1m2-row">
                          <label>Destination</label>
                          <input 
                            value={moveForm.destination} 
                            onChange={(e) => setMoveForm((s) => ({ ...s, destination: e.target.value }))}
                            placeholder="e.g., Barangay Health Center"
                          />
                        </div>
                      )}

                      <div className="p1m2-row">
                        <label>Performed By</label>
                        <input 
                          value={moveForm.performedBy} 
                          onChange={(e) => setMoveForm((s) => ({ ...s, performedBy: e.target.value }))}
                          placeholder="Name of person"
                        />
                      </div>

                      <div className="p1m2-help">
                        {moveForm.type === "ADJUST" && "ADJUST will set the quantity to the exact value entered."}
                        {moveForm.type === "IN" && "IN will add quantity to current stock."}
                        {moveForm.type === "OUT" && `OUT will subtract quantity from current stock. Available: ${roundToTwo(selectedBatch?.qtyOnHand || 0)}`}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p1m2-foot">
              <div className="p1m2-footNote">
                <CheckCircle2 size={16} />
                <span>{busy ? "Saving…" : "Changes saved to Firebase"}</span>
              </div>

              <div className="p1m2-actions">
                <button 
                  className="p1m2-btn ghost" 
                  onClick={() => setModalOpen(false)} 
                  disabled={busy} 
                  type="button"
                >
                  Cancel
                </button>
                <button 
                  className="p1m2-btn" 
                  onClick={save} 
                  disabled={busy} 
                  type="button"
                >
                  {busy ? "Saving…" : editing ? "Save Changes" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* EXPORT MODAL */}
        <ExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExport}
        />

        {/* CONFIRM DELETE MODAL */}
        <ConfirmModal
          open={confirmOpen}
          title="Delete record?"
          message={
            toDelete?.kind === "item"
              ? `Delete item "${toDelete?.data?.name}"? This will also remove all its batches and movement history.`
              : toDelete?.kind === "batch"
              ? `Delete batch "${toDelete?.data?.batchNo}"? This will remove all its movement history.`
              : "Delete this movement record? This will revert the quantity change."
          }
          dangerText="Delete"
          onCancel={() => {
            setConfirmOpen(false);
            setToDelete(null);
          }}
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
}