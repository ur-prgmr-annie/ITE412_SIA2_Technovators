// src/pages/program1/P1Services.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import "../../styles/p1Services.css";
import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ClipboardList,
  Stethoscope,
  Download,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  User,
  PawPrint,
  Package,
  BarChart3,
  TrendingDown,
  AlertCircle,
  Info,
  CreditCard,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

// Helper function to round to 2 decimal places for display
const roundToTwo = (num) => {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

// Helper function to get whole numbers for doses/animals
const roundToWhole = (num) => {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return 0;
  return Math.floor(Number(num));
};

// ========== ENHANCED ACTIVITY TYPES (Fallback if no services in Firestore) ==========
const ACTIVITY_TYPES = [
  "Anti-rabies Vaccination",
  "Deworming",
  "Vitamin Supplementation",
  "Animal Treatment",
  "Iron Supplementation",
  "Antibiotic administration",
  "Mange Treatment",
  "Castration",
  "Consultation",
  "Animal Inspection",
  "Farm Biosecurity Evaluation",
  "Issued Disinfectant",
  "Issued Nets",
  "Issued Foot Baths",
  "Vaccination",
  "Treatment",
  "Other",
];

// ========== DEFAULT SERVICES FOR PRICE LOOKUP ==========
const DEFAULT_SERVICES = [
  { id: 'antiRabies', label: 'Anti-rabies Vaccination', defaultPrice: 30, unit: 'per head', category: 'Vaccine' },
  { id: 'dewormingLarge', label: 'Deworming - Large Ruminant', defaultPrice: 50, unit: 'per head', category: 'Dewormer' },
  { id: 'dewormingSmall', label: 'Deworming - Small Ruminant', defaultPrice: 30, unit: 'per head', category: 'Dewormer' },
  { id: 'vitaminSupplement', label: 'Vitamin Supplementation', defaultPrice: 20, unit: 'per head', category: 'Supplement' },
  { id: 'antibioticAdmin', label: 'Antibiotic Administration', defaultPrice: 35, unit: 'per head', category: 'Medicine' },
  { id: 'mangeTreatment', label: 'Mange Treatment', defaultPrice: 40, unit: 'per head', category: 'Medicine' },
  { id: 'ironSupplement', label: 'Iron Supplementation', defaultPrice: 25, unit: 'per head', category: 'Supplement' },
  { id: 'consultation', label: 'Consultation', defaultPrice: 50, unit: 'per session', category: 'Service' },
  { id: 'castration', label: 'Castration', defaultPrice: 150, unit: 'per animal', category: 'Surgery' },
  { id: 'treatment', label: 'Treatment', defaultPrice: 45, unit: 'per head', category: 'Medicine' },
  { id: 'other', label: 'Other Services', defaultPrice: 50, unit: 'per service', category: 'Service' },
];

// ========== SERVICE PRICING (Fallback if no billing prices exist) ==========
const SERVICE_PRICING = {
  antiRabies: 30,
  deworming: {
    large: 50,
    small: 30,
  },
};

const DEWORMING_TYPES = [
  { value: "large", label: "Large Ruminant (₱50/head)" },
  { value: "small", label: "Small Ruminant (₱30/head)" },
];

// ========== ACTIVITY TO INVENTORY MAPPING ==========
const ACTIVITY_ITEM_MAPPING = {
  "Anti-rabies Vaccination": {
    keywords: ["vaccine", "rabies", "nobivac", "defensor", "rabisin", "anti-rabies"],
    category: "Vaccine",
    allowedCategories: ["Vaccine"],
    defaultDose: 1,
    unit: ["vials", "doses"],
    dosePerUnit: 10,
  },
  Vaccination: {
    keywords: ["vaccine", "rabies", "nobivac", "defensor", "rabisin", "fmd", "newcastle", "anti-rabies"],
    category: "Vaccine",
    allowedCategories: ["Vaccine"],
    defaultDose: 1,
    unit: ["vials", "doses"],
    dosePerUnit: 10,
  },
  Deworming: {
    keywords: ["deworm", "ivermectin", "albendazole", "fenbendazole", "dewormer", "canine"],
    category: "Dewormer",
    allowedCategories: ["Dewormer", "Medicine"],
    defaultDose: 1,
    unit: ["tablets", "bottles", "ml"],
    dosePerUnit: {
      tablets: 1,
      bottles: 100,
      ml: 1,
    },
  },
  "Vitamin Supplementation": {
    keywords: ["vitamin", "b-complex", "multivitamin", "vit", "b12", "iron"],
    category: "Vitamin Supplement",
    allowedCategories: ["Vitamin Supplement", "Medicine"],
    defaultDose: 1,
    unit: ["bottles", "ml", "tablets"],
    dosePerUnit: {
      bottles: 100,
      ml: 1,
      tablets: 1,
    },
    excludeKeywords: ["vaccine", "rabies", "deworm"],
  },
  "Antibiotic administration": {
    keywords: ["antibiotic", "amoxicillin", "penicillin", "oxytetracycline", "doxycycline"],
    category: "Antibiotic",
    allowedCategories: ["Antibiotic", "Medicine"],
    defaultDose: 1,
    unit: ["bottles", "ml", "tablets"],
    dosePerUnit: {
      bottles: 100,
      ml: 1,
      tablets: 1,
    },
  },
  "Mange Treatment": {
    keywords: ["mange", "ivermectin", "acaricide", "scabies"],
    category: "Medicine",
    allowedCategories: ["Medicine", "Dewormer"],
    defaultDose: 1,
    dosePerUnit: {
      bottles: 100,
      ml: 1,
      tablets: 1,
    },
  },
  "Iron Supplementation": {
    keywords: ["iron", "ferrous", "hematinic", "ferrous sulfate"],
    category: "Vitamin Supplement",
    allowedCategories: ["Vitamin Supplement", "Medicine"],
    defaultDose: 1,
    dosePerUnit: {
      bottles: 100,
      ml: 1,
      tablets: 1,
    },
    excludeKeywords: ["vaccine", "rabies", "deworm"],
  },
  "Issued Disinfectant": {
    keywords: ["disinfectant", "chlorine", "iodine", "bleach", "povidone"],
    category: "Disinfectant",
    allowedCategories: ["Disinfectant", "Supply"],
    defaultDose: 1,
    unit: ["liters", "bottles"],
    dosePerUnit: {
      liters: 1000,
      bottles: 100,
    },
  },
};

// ========== HEALTH STATUS/REMARKS ==========
const HEALTH_STATUS = [
  { value: "apparently_healthy", label: "Apparently healthy" },
  { value: "need_followup", label: "Need follow-up" },
  { value: "lethargic_depressed", label: "Lethargic/Depressed" },
  { value: "emaciated_underweight", label: "Emaciated/Underweight" },
  { value: "stunted_growth", label: "Stunted Growth" },
  { value: "unkempt_rough_coat", label: "Unkempt/Rough Coat" },
  { value: "dehydrated", label: "Dehydrated" },
  { value: "nasal_ocular_discharge", label: "Nasa/Ocular Discharge" },
  { value: "anorexic", label: "Anorexic" },
  { value: "diarrheic", label: "Diarrheic" },
  { value: "moribund", label: "Moribund" },
  { value: "guarded_prognosis", label: "Guarded Prognosis" },
  { value: "bright_alert_responsive", label: "Bright, alert, responsive" },
  { value: "good_hydration", label: "Good hydration" },
  { value: "clear_eyes_no_discharge", label: "Clear eyes/no nasal discharge" },
  { value: "dewormed", label: "Dewormed" },
  { value: "up_to_date_vaccinations", label: "Up-to-date vaccinations" },
];

// ========== SPECIES TYPES ==========
const SPECIES_OPTIONS = [
  { species: "Dog", type: "Canine" },
  { species: "Cat", type: "Feline" },
  { species: "cattle", type: "Bovine" },
  { species: "kabayo", type: "Equine" },
  { species: "Swine", type: "Porcine" },
  { species: "Goat", type: "Caprine" },
  { species: "Sheep", type: "Ovine" },
  { species: "Poultry", type: "Avian" },
  { species: "Carabao", type: "Bubaline" },
  { species: "Other", type: "Other" },
];

const SEX_OPTIONS = ["Male", "Female"];
const YESNO_OPTIONS = ["Yes", "No"];

const STATUS = [
  { value: "done", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "missed", label: "Missed" },
];

// Helper to format optional values
function fmt(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [includeDetails, setIncludeDetails] = useState({
    summary: true,
    records: true,
    animals: false,
    inventorySummary: true,
    inventoryBatches: false,
  });
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      await onExport({ format: exportFormat, dateRange, includeDetails });
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
            <div className="p1m2-title">Export Routine Services</div>
            <div className="p1m2-sub">Download report (CSV / PDF / JSON)</div>
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
                  {EXPORT_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p1m2-2">
                <div className="p1m2-row">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
                  />
                </div>
                <div className="p1m2-row">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="p1m2-row">
                <label>Include in Export</label>
                <div className="p1m2-checkbox-group">
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.summary}
                      onChange={(e) => setIncludeDetails((d) => ({ ...d, summary: e.target.checked }))}
                    />
                    <span>Summary</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.records}
                      onChange={(e) => setIncludeDetails((d) => ({ ...d, records: e.target.checked }))}
                    />
                    <span>Service Records</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.animals}
                      onChange={(e) => setIncludeDetails((d) => ({ ...d, animals: e.target.checked }))}
                    />
                    <span>Animals List (optional)</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.inventorySummary}
                      onChange={(e) => setIncludeDetails((d) => ({ ...d, inventorySummary: e.target.checked }))}
                    />
                    <span>Inventory Summary by Category</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.inventoryBatches}
                      onChange={(e) => setIncludeDetails((d) => ({ ...d, inventoryBatches: e.target.checked }))}
                    />
                    <span>Inventory Batches (optional)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p1m2-foot">
          <div className="p1m2-footNote">
            <Info size={16} />
            <span>Export respects selected date range</span>
          </div>
          <div className="p1m2-actions">
            <button className="p1m2-btn ghost" onClick={onClose} disabled={busy} type="button">
              Cancel
            </button>
            <button className="p1m2-btn" onClick={handleExport} disabled={busy} type="button">
              {busy ? "Exporting..." : "Export Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function P1Services() {
  const [animals, setAnimals] = useState([]);
  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [inventorySummary, setInventorySummary] = useState({
    byCategory: {},
    totalItems: 0,
    lowStock: 0,
    expiringSoon: 0,
    totalDoses: {},
    remainingCapacity: {},
  });

  // ========== BILLING PRICES STATE ==========
  const [billingPrices, setBillingPrices] = useState({});
  const [isBillingLoaded, setIsBillingLoaded] = useState(false);
  const [servicePrices, setServicePrices] = useState({});

  // ========== DYNAMIC SERVICES STATE ==========
  const [availableServices, setAvailableServices] = useState([]);
  const [isServicesLoaded, setIsServicesLoaded] = useState(false);

  const [animalQ, setAnimalQ] = useState("");
  const [recordQ, setRecordQ] = useState("");

  const [selected, setSelected] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const [toast, setToast] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Auto-detected items for current activity
  const [matchedItems, setMatchedItems] = useState([]);
  const [matchingError, setMatchingError] = useState("");
  const [stockInfo, setStockInfo] = useState({
    totalDoses: 0,
    maxAnimals: 0,
    byBatch: [],
  });

  // ========== ANIMAL SEARCH COMBOBOX STATE ==========
  const [animalSearchQuery, setAnimalSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  const [form, setForm] = useState({
    animalId: "",

    // client snapshot
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    birthday: "",
    contactNo: "",

    // animal snapshot with species type
    species: "",
    speciesType: "",
    speciesOther: "",
    sex: "",
    age: "",
    animalRegistered: "",
    heads: 1,

    // service fields
    barangay: "",
    date: "",
    activity: "Anti-rabies Vaccination",
    remarks: "",

    // pricing
    dewormingType: "",
    serviceFee: 0,
    feeRate: 0,
    feeBasis: "",
    feeCategory: "",

    // health status
    healthStatus: "",
    healthStatusDetails: "",
    symptoms: [],
    prognosis: "",
    hydration: "",
    eyesCondition: "",
    coatCondition: "",
    behavior: "",
    appetite: "",
    weightCondition: "",
    dewormingStatus: "",
    vaccinationStatus: "",

    // inventory tracking
    trackInventory: false,
    usedItems: [],
    manualMode: false,

    performedBy: "",
    status: "done",
    followUpDate: "",
    
    // Billing fields
    hasInvoice: false,
    invoiceId: null,
    paymentStatus: "pending",
  });

  const showToast = (t) => {
    setToast(t);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  };

  // =========================
  // LOAD DYNAMIC SERVICES FROM FIRESTORE
  // =========================
  useEffect(() => {
    const loadServicesAndPrices = async () => {
      try {
        // Load services from billing_services collection
        const servicesRef = collection(db, 'billing_services');
        const servicesSnapshot = await getDocs(servicesRef);
        
        let servicesData = [];
        servicesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          servicesData.push({
            id: doc.id,
            ...data,
            serviceId: data.serviceId || data.id || doc.id,
          });
        });

        // If no services exist, use fallback
        if (servicesData.length === 0) {
          servicesData = ACTIVITY_TYPES.map(label => ({
            id: label.toLowerCase().replace(/\s+/g, '_'),
            serviceId: label.toLowerCase().replace(/\s+/g, '_'),
            label: label,
            defaultPrice: 50,
            unit: 'per head',
            category: 'Service',
            isCustom: false,
          }));
        }

        // Load prices
        const pricesRef = collection(db, 'billing_service_prices');
        const pricesSnapshot = await getDocs(pricesRef);
        const pricesData = {};
        pricesSnapshot.docs.forEach(doc => {
          pricesData[doc.id] = doc.data().price || 0;
        });

        console.log('📊 All prices from Firestore:', pricesData);

        // Merge services with prices - IMPROVED LOOKUP
        const servicesWithPrices = servicesData.map(service => {
          let price = null;
          
          // 1. Try using serviceId
          if (service.serviceId) {
            price = pricesData[service.serviceId];
          }
          
          // 2. Try using id
          if (!price && service.id) {
            price = pricesData[service.id];
          }
          
          // 3. Try using the original ID from DEFAULT_SERVICES
          if (!price) {
            const defaultService = DEFAULT_SERVICES.find(ds => ds.label === service.label);
            if (defaultService) {
              price = pricesData[defaultService.id];
            }
          }
          
          // 4. Try using label as key
          if (!price) {
            const labelKey = service.label.toLowerCase().replace(/\s+/g, '_');
            price = pricesData[labelKey];
          }
          
          // 5. Fallback to default
          if (!price) {
            price = service.defaultPrice || 50;
          }
          
          console.log(`🔍 Service: ${service.label}, Price: ${price}`);
          
          return {
            ...service,
            currentPrice: price,
            priceKey: service.serviceId || service.id,
          };
        });

        // Remove duplicates by label
        const seenLabels = new Set();
        const uniqueServices = servicesWithPrices.filter(service => {
          const label = service.label;
          if (seenLabels.has(label)) {
            return false;
          }
          seenLabels.add(label);
          return true;
        });

        setAvailableServices(uniqueServices);
        setServicePrices(pricesData);
        setIsServicesLoaded(true);

        console.log('✅ Loaded unique services:', uniqueServices.length);
        console.log('📊 Service prices:', uniqueServices.map(s => ({ label: s.label, price: s.currentPrice })));

      } catch (error) {
        console.error('Error loading services:', error);
        const fallbackServices = ACTIVITY_TYPES.map(label => ({
          id: label.toLowerCase().replace(/\s+/g, '_'),
          serviceId: label.toLowerCase().replace(/\s+/g, '_'),
          label: label,
          defaultPrice: 50,
          unit: 'per head',
          category: 'Service',
          isCustom: false,
          currentPrice: 50
        }));
        setAvailableServices(fallbackServices);
        setIsServicesLoaded(true);
      }
    };

    loadServicesAndPrices();
  }, []);

  // =========================
  // LOAD BILLING PRICES FROM FIRESTORE
  // =========================
  useEffect(() => {
    const loadBillingPrices = async () => {
      try {
        const pricesRef = collection(db, 'billing_service_prices');
        const pricesSnapshot = await getDocs(pricesRef);
        const pricesData = {};
        pricesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          pricesData[doc.id] = {
            price: data.price || 0,
            lastUpdated: data.updatedAt?.toDate?.() || data.updatedAt || null,
            updatedBy: data.updatedBy || null
          };
        });
        setBillingPrices(pricesData);
        setIsBillingLoaded(true);
      } catch (error) {
        console.error('Error loading billing prices:', error);
        setIsBillingLoaded(true);
      }
    };
    
    loadBillingPrices();
  }, []);

  // =========================
  // HANDLE ACTIVITY CHANGE - FIXED DEWORMING TYPE
  // =========================
  const handleActivityChange = (value) => {
    const isDeworming = value.includes('Deworming');
    
    let dewormingType = '';
    if (isDeworming) {
      if (value.includes('Large')) {
        dewormingType = 'large';
      } else if (value.includes('Small')) {
        dewormingType = 'small';
      }
    }
    
    setForm((prev) => ({
      ...prev,
      activity: value,
      dewormingType: dewormingType,
    }));
  };

  // =========================
  // AUTO-COMPUTE SERVICE FEE WITH DYNAMIC SERVICES
  // =========================
  useEffect(() => {
    let rate = 0;
    let basis = "";
    let category = "";

    const heads = Number(form.heads || 1);

    const selectedService = availableServices.find(s => s.label === form.activity);
    
    if (selectedService) {
      rate = selectedService.currentPrice || selectedService.defaultPrice || 50;
      const unit = selectedService.unit || 'head';
      basis = `₱${rate} per ${unit}`;
      category = selectedService.category || selectedService.label || 'Service';
    } else {
      const labelKey = form.activity.toLowerCase().replace(/\s+/g, '_');
      if (billingPrices[labelKey]) {
        rate = billingPrices[labelKey].price || 50;
        basis = `₱${rate} per head`;
        category = form.activity;
      } else {
        rate = 50;
        basis = `₱${rate} per service`;
        category = "General Service";
      }
    }

    setForm((prev) => {
      const newFee = rate * heads;
      if (
        Number(prev.feeRate || 0) === Number(rate) &&
        Number(prev.serviceFee || 0) === Number(newFee) &&
        String(prev.feeBasis || "") === String(basis) &&
        String(prev.feeCategory || "") === String(category)
      ) {
        return prev;
      }

      return {
        ...prev,
        feeRate: rate,
        serviceFee: newFee,
        feeBasis: basis,
        feeCategory: category,
      };
    });
  }, [form.activity, form.dewormingType, form.heads, billingPrices, availableServices]);

  // =========================
  // EXPORT HANDLER (CSV/PDF/JSON)
  // =========================
  const handleExport = async ({ format, dateRange, includeDetails }) => {
    try {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);

      const sourceRecords = selected?.id ? records : allRecords;

      const rangedRecords = sourceRecords.filter((r) => {
        const d = new Date(r.date);
        return d >= startDate && d <= endDate;
      });

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: auth.currentUser?.email || "Unknown",
        dateRange,
        selectedAnimal: selected
          ? {
              id: selected.id,
              tagId: selected.tagId || "",
              owner: `${selected.ownerFirstName || ""} ${selected.ownerLastName || ""}`.trim(),
              barangay: selected.farmBarangay || selected.barangay || "",
              species: selected.species || "",
            }
          : null,
      };

      if (includeDetails.summary) {
        const total = rangedRecords.length;
        const completed = rangedRecords.filter((r) => r.status === "done").length;
        const pending = rangedRecords.filter((r) => r.status === "pending").length;
        const missed = rangedRecords.filter((r) => r.status === "missed").length;
        const totalHeads = rangedRecords.reduce((sum, r) => sum + Number(r.heads || 0), 0);
        const totalFees = rangedRecords.reduce((sum, r) => sum + Number(r.serviceFee || 0), 0);

        const byActivity = {};
        rangedRecords.forEach((r) => {
          byActivity[r.activity] = (byActivity[r.activity] || 0) + 1;
        });

        exportData.summary = {
          total,
          completed,
          pending,
          missed,
          totalHeads: roundToWhole(totalHeads),
          totalFees: roundToTwo(totalFees),
          byActivity,
        };
      }

      if (includeDetails.records) {
        exportData.records = rangedRecords.map((r) => ({
          ...r,
          heads: roundToWhole(Number(r.heads || 1)),
          serviceFee: roundToTwo(Number(r.serviceFee || 0)),
          createdAt: r.createdAt?.toDate?.() || r.createdAt || null,
          updatedAt: r.updatedAt?.toDate?.() || r.updatedAt || null,
        }));
      }

      if (includeDetails.animals) {
        exportData.animals = animals.map((a) => ({
          id: a.id,
          tagId: a.tagId || "",
          species: a.species || "",
          breed: a.breed || "",
          sex: a.sex || "",
          barangay: a.farmBarangay || a.barangay || "",
          owner: `${a.ownerFirstName || ""} ${a.ownerLastName || ""}`.trim(),
        }));
      }

      if (includeDetails.inventorySummary) {
        exportData.inventorySummary = inventorySummary;
      }

      if (includeDetails.inventoryBatches) {
        exportData.inventoryBatches = inventoryBatches.map((b) => ({
          ...b,
          qtyOnHand: roundToTwo(Number(b.qtyOnHand || 0)),
        }));
      }

      // CSV
      if (format === "csv") {
        let csv = "ROUTINE SERVICES EXPORT REPORT\n";
        csv += `Exported: ${new Date().toLocaleString("en-PH")}\n`;
        csv += `Exported By: ${auth.currentUser?.email || "Unknown"}\n`;
        csv += `Date Range: ${dateRange.start} to ${dateRange.end}\n`;
        csv += `Selected Animal: ${exportData.selectedAnimal?.tagId || "All"}\n\n`;

        if (includeDetails.summary && exportData.summary) {
          csv += "SUMMARY\n";
          csv += `Total Records,${exportData.summary.total}\n`;
          csv += `Completed,${exportData.summary.completed}\n`;
          csv += `Pending,${exportData.summary.pending}\n`;
          csv += `Missed,${exportData.summary.missed}\n`;
          csv += `Total Heads Treated,${exportData.summary.totalHeads}\n`;
          csv += `Total Fees,${exportData.summary.totalFees}\n\n`;

          csv += "ACTIVITY BREAKDOWN\n";
          csv += "Activity,Count\n";
          Object.entries(exportData.summary.byActivity || {}).forEach(([act, cnt]) => {
            csv += `"${act}",${cnt}\n`;
          });
          csv += "\n";
        }

        if (includeDetails.records && exportData.records) {
          csv += "SERVICE RECORDS\n";
          csv +=
            "Date,Activity,Deworming Type,Species,Species Type,Heads,Fee,Barangay,Health Status,Performed By,Status,Payment Status,Items Used\n";
          exportData.records.forEach((r) => {
            const itemsUsed =
              r.trackInventory && r.usedItems?.length
                ? r.usedItems.map((it) => `${it.itemName}(${it.batchNo}) x${it.quantity}`).join(" | ")
                : r.manualMode
                ? "Manual"
                : "";
            csv += `${r.date},"${r.activity}","${r.dewormingType || ""}","${r.species || ""}","${
              r.speciesType || ""
            }",${r.heads},${roundToTwo(r.serviceFee || 0)},"${r.barangay || ""}","${r.healthStatus || ""}","${
              r.performedBy || ""
        },${r.status || ""},"${r.paymentStatus || "pending"}","${itemsUsed}"\n`;
          });
          csv += "\n";
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `routine_services_export_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        showToast({ title: "Export successful", sub: "CSV downloaded", type: "ok" });
        return;
      }

      // PDF
      if (format === "pdf") {
        const pdf = new jsPDF({ orientation: "landscape" });
        const fileName = `routine_services_report_${new Date().toISOString().split("T")[0]}.pdf`;

        pdf.setFontSize(14);
        pdf.text("ROUTINE SERVICES MONITORING REPORT", 14, 14);

        pdf.setFontSize(10);
        const meta = [
          `Exported: ${formatDateTime(new Date())}`,
          `Exported By: ${auth.currentUser?.email || "Unknown"}`,
          `Date Range: ${dateRange.start} to ${dateRange.end}`,
          `Selected Animal: ${exportData.selectedAnimal?.tagId || "All"}`,
          `Owner: ${exportData.selectedAnimal?.owner || "—"}`,
          `Barangay: ${exportData.selectedAnimal?.barangay || "—"}`,
        ];

        let y = 22;
        meta.forEach((line) => {
          pdf.text(line, 14, y);
          y += 5;
        });

        if (includeDetails.summary && exportData.summary) {
          autoTable(pdf, {
            startY: y + 2,
            head: [["Summary", "Value"]],
            body: [
              ["Total Records", String(exportData.summary.total)],
              ["Completed", String(exportData.summary.completed)],
              ["Pending", String(exportData.summary.pending)],
              ["Missed", String(exportData.summary.missed)],
              ["Total Heads Treated", String(exportData.summary.totalHeads)],
              ["Total Fees", `₱${roundToTwo(exportData.summary.totalFees)}`],
            ],
            styles: { fontSize: 9 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });

          const activityRows = Object.entries(exportData.summary.byActivity || {})
            .sort((a, b) => b[1] - a[1])
            .map(([act, cnt]) => [act, String(cnt)]);

          if (activityRows.length) {
            autoTable(pdf, {
              startY: pdf.lastAutoTable.finalY + 6,
              head: [["Activity Breakdown", "Count"]],
              body: activityRows,
              styles: { fontSize: 9 },
              headStyles: { fontStyle: "bold" },
              theme: "grid",
              margin: { left: 14, right: 14 },
            });
          }

          y = pdf.lastAutoTable.finalY + 10;
        } else {
          y += 6;
        }

        const ensureSpace = (need = 25) => {
          const pageH = pdf.internal.pageSize.getHeight();
          if (y + need > pageH - 10) {
            pdf.addPage();
            y = 14;
          }
        };

        if (includeDetails.inventorySummary && inventorySummary?.byCategory) {
          ensureSpace(30);
          pdf.setFontSize(12);
          pdf.text("Inventory Summary by Category", 14, y);
          y += 4;

          const rows = Object.entries(inventorySummary.byCategory).map(([cat, data]) => [
            cat,
            String(roundToTwo(data.count || 0)),
            String(roundToWhole(data.totalDoses || 0)),
            String(roundToWhole(data.maxAnimals || 0)),
          ]);

          autoTable(pdf, {
            startY: y,
            head: [["Category", "Units", "Total Doses", "Max Animals"]],
            body: rows,
            styles: { fontSize: 9 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });

          y = pdf.lastAutoTable.finalY + 10;
        }

        if (includeDetails.records && exportData.records?.length) {
          ensureSpace(30);
          pdf.setFontSize(12);
          pdf.text("Service Records", 14, y);
          y += 4;

          autoTable(pdf, {
            startY: y,
            head: [[
              "Date",
              "Activity",
              "Deworming Type",
              "Species",
              "Heads",
              "Fee",
              "Barangay",
              "Health",
              "Performed By",
              "Status",
              "Payment Status",
              "Items Used",
            ]],
            body: exportData.records.map((r) => {
              const itemsUsed =
                r.trackInventory && r.usedItems?.length
                  ? r.usedItems.map((it) => `${it.itemName}(${it.batchNo}) x${it.quantity}`).join(" | ")
                  : r.manualMode
                  ? "Manual"
                  : "";
              return [
                r.date ? formatDate(r.date) : "",
                r.activity || "",
                r.dewormingType === "large" ? "Large Ruminant" : r.dewormingType === "small" ? "Small Ruminant" : "",
                r.species ? `${r.species}${r.speciesType ? ` (${r.speciesType})` : ""}` : "",
                String(r.heads || 1),
                `₱${roundToTwo(r.serviceFee || 0)}`,
                r.barangay || "",
                r.healthStatus || "",
                r.performedBy || "",
                r.status || "",
                r.paymentStatus || "pending",
                itemsUsed,
              ];
            }),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 10, right: 10 },
          });

          y = pdf.lastAutoTable.finalY + 10;
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
        showToast({ title: "Export successful", sub: "PDF downloaded", type: "ok" });
        return;
      }

      // JSON
      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `routine_services_backup_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        showToast({ title: "Export successful", sub: "JSON downloaded", type: "ok" });
        return;
      }
    } catch (e) {
      console.error("Export failed:", e);
      showToast({ title: "Export failed", sub: e.message, type: "error" });
    }
  };

  // =========================
  // LOAD ANIMALS
  // =========================
  useEffect(() => {
    setErr("");
    const qAnimals = query(collection(db, "program1_animals"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qAnimals,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAnimals(rows);
      },
      (e) => {
        console.error(e);
        setErr("Failed to load animals from database.");
      }
    );

    return () => unsub();
  }, []);

  // =========================
  // LOAD ALL ROUTINE SERVICES (OVERALL)
  // =========================
  useEffect(() => {
    const qAll = query(collection(db, "program1_routine_services"), orderBy("date", "desc"));

    const unsub = onSnapshot(
      qAll,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllRecords(rows);
      },
      (e) => {
        console.error(e);
      }
    );

    return () => unsub();
  }, []);

  // =========================
  // LOAD INVENTORY BATCHES
  // =========================
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const batchesQuery = query(
          collection(db, "p1_inventory_batches"),
          where("qtyOnHand", ">", 0),
          orderBy("expiryDate", "asc"),
          orderBy("createdAt", "asc")
        );

        const snapshot = await getDocs(batchesQuery);

        const batches = snapshot.docs.map((d) => {
          const data = d.data();
          const rawName = data.itemName || data.name || data.productName || data.item?.name || data.itemTitle || "";
          const itemNameLower = String(rawName).toLowerCase();

          let category = data.category;
          if (!category) {
            if (
              itemNameLower.includes("vaccine") ||
              itemNameLower.includes("rabisin") ||
              itemNameLower.includes("anti-rabies")
            ) {
              category = "Vaccine";
            } else if (
              itemNameLower.includes("deworm") ||
              itemNameLower.includes("ivermectin") ||
              itemNameLower.includes("albendazole")
            ) {
              category = "Dewormer";
            } else if (
              itemNameLower.includes("vitamin") ||
              itemNameLower.includes("b-complex") ||
              itemNameLower.includes("multivitamin")
            ) {
              category = "Vitamin Supplement";
            } else if (
              itemNameLower.includes("antibiotic") ||
              itemNameLower.includes("amoxicillin") ||
              itemNameLower.includes("penicillin")
            ) {
              category = "Antibiotic";
            } else if (
              itemNameLower.includes("disinfect") ||
              itemNameLower.includes("chlorine") ||
              itemNameLower.includes("iodine")
            ) {
              category = "Disinfectant";
            } else if (itemNameLower.includes("mange") || itemNameLower.includes("acaricide")) {
              category = "Medicine";
            } else {
              category = "Other";
            }
          }

          return {
            id: d.id,
            ...data,
            itemName: data.itemName || data.name || "Unknown",
            category,
            unit: data.unit || "vials",
          };
        });

        const today = new Date().toISOString().split("T")[0];
        const validBatches = batches.filter((b) => {
          if (!b.expiryDate) return true;
          return b.expiryDate >= today;
        });

        setInventoryBatches(validBatches);

        const byCategory = {};
        const totalDoses = {};
        const remainingCapacity = {};
        let totalItems = 0;
        let lowStock = 0;

        validBatches.forEach((batch) => {
          const category = batch.category || "Other";
          if (!byCategory[category]) {
            byCategory[category] = {
              count: 0,
              items: [],
              totalDoses: 0,
              maxAnimals: 0,
            };
          }

          const qty = Number(batch.qtyOnHand || 0);
          byCategory[category].count += qty;
          byCategory[category].items.push(batch);
          totalItems += qty;

          let doses = qty;
          let animals = qty;

          switch (batch.unit) {
            case "vials":
              doses = qty * 10;
              animals = doses;
              break;
            case "bottles":
              doses = qty * 100;
              animals = doses;
              break;
            case "liters":
              doses = qty * 1000;
              animals = doses;
              break;
            case "tablets":
            case "capsules":
              doses = qty;
              animals = qty;
              break;
            default:
              doses = qty;
              animals = qty;
          }

          byCategory[category].totalDoses += doses;
          byCategory[category].maxAnimals += animals;
          totalDoses[category] = (totalDoses[category] || 0) + doses;
          remainingCapacity[category] = (remainingCapacity[category] || 0) + animals;

          if (qty <= (batch.reorderPoint || 10)) {
            lowStock++;
          }
        });

        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
        const expiringSoon = validBatches.filter((b) => {
          const expiry = new Date(b.expiryDate);
          return expiry <= threeMonthsFromNow;
        }).length;

        setInventorySummary({
          byCategory,
          totalItems: roundToTwo(totalItems),
          lowStock,
          expiringSoon,
          totalDoses,
          remainingCapacity,
        });
      } catch (e) {
        console.error("Error loading inventory:", e);
      }
    };

    loadInventory();
  }, [modalOpen, records]);

  // =========================
  // CALCULATE STOCK INFO
  // =========================
  useEffect(() => {
    if (!form.activity || matchedItems.length === 0) {
      setStockInfo({
        totalDoses: 0,
        maxAnimals: 0,
        canServe: 0,
        byBatch: [],
        recommended: "ok",
      });
      return;
    }

    const heads = Number(form.heads) || 1;

    let totalDoses = 0;
    let totalAnimals = 0;
    const byBatch = [];

    matchedItems.forEach((batch) => {
      const qty = Number(batch.qtyOnHand || 0);
      let doses = qty;
      let animals = qty;

      switch (batch.unit) {
        case "vials":
          doses = qty * 10;
          animals = doses;
          break;
        case "bottles":
          doses = qty * 100;
          animals = doses;
          break;
        case "liters":
          doses = qty * 1000;
          animals = doses;
          break;
        case "tablets":
        case "capsules":
          doses = qty;
          animals = qty;
          break;
        default:
          doses = qty;
          animals = qty;
      }

      totalDoses += doses;
      totalAnimals += animals;

      byBatch.push({
        batchNo: batch.batchNo,
        itemName: batch.itemName,
        qtyOnHand: qty,
        unit: batch.unit,
        doses: roundToWhole(doses),
        animals: roundToWhole(animals),
        expiryDate: batch.expiryDate,
      });
    });

    const canServe = Math.min(totalAnimals, Math.floor(totalDoses / heads));

    setStockInfo({
      totalDoses: roundToWhole(totalDoses),
      maxAnimals: roundToWhole(totalAnimals),
      canServe: roundToWhole(canServe),
      byBatch: byBatch.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)),
      recommended: canServe >= heads ? "sufficient" : "insufficient",
    });
  }, [form.activity, matchedItems, form.heads]);

  // =========================
  // AUTO-DETECT ITEMS BASED ON ACTIVITY
  // =========================
  useEffect(() => {
    if (!form.activity) {
      setMatchedItems([]);
      setMatchingError("");
      return;
    }

    if (inventoryBatches.length === 0) {
      setMatchedItems([]);
      setMatchingError("No inventory items available.");
      return;
    }

    const mapping = ACTIVITY_ITEM_MAPPING[form.activity];
    if (!mapping) {
      setMatchedItems([]);
      setMatchingError("");
      return;
    }

    const matched = inventoryBatches.filter((batch) => {
      const itemName = (batch.itemName || "").toLowerCase();
      const itemCategory = (batch.category || "").toLowerCase();

      if (form.activity === "Vaccination" || form.activity === "Anti-rabies Vaccination") {
        return (
          itemName.includes("vaccine") ||
          itemName.includes("rabies") ||
          itemName.includes("anti-rabies") ||
          itemCategory.includes("vaccine")
        );
      }

      const allowedCategories = mapping.allowedCategories?.map((c) => c.toLowerCase()) || [];
      const categoryMatch = allowedCategories.some((cat) => itemCategory.includes(cat) || cat.includes(itemCategory));
      const keywordMatch = (mapping.keywords || []).some((keyword) => itemName.includes(String(keyword).toLowerCase()));

      if (mapping.excludeKeywords) {
        const hasExcluded = mapping.excludeKeywords.some((excluded) =>
          itemName.includes(String(excluded).toLowerCase())
        );
        if (hasExcluded) return false;
      }

      return categoryMatch || keywordMatch;
    });

    setMatchedItems(matched);

    if (matched.length === 0) {
      setMatchingError(`No matching items found for ${form.activity} in inventory.`);
    } else {
      setMatchingError("");
    }
  }, [form.activity, inventoryBatches]);

  // =========================
  // LOAD ROUTINE SERVICES FOR SELECTED ANIMAL
  // =========================
  useEffect(() => {
    setErr("");

    if (!selected?.id) {
      setRecords([]);
      return;
    }

    const qRecs = query(
      collection(db, "program1_routine_services"),
      where("animalId", "==", selected.id),
      orderBy("date", "desc")
    );

    const unsub = onSnapshot(
      qRecs,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecords(rows);
      },
      (e) => {
        console.error(e);
        setErr("Failed to load service records.");
      }
    );

    return () => unsub();
  }, [selected?.id]);

  // =========================
  // FILTERS
  // =========================
  const filteredAnimals = useMemo(() => {
    const n = animalQ.trim().toLowerCase();
    if (!n) return animals;
    return animals.filter((a) =>
      [a.tagId, a.species, a.breed, a.farmBarangay, a.ownerFirstName, a.ownerLastName].some(
        (f) => f && String(f).toLowerCase().includes(n)
      )
    );
  }, [animals, animalQ]);

  const filteredRecords = useMemo(() => {
    const source = selected?.id ? records : allRecords;
    const n = recordQ.trim().toLowerCase();

    if (!n) return source;

    return source.filter((r) =>
      [
        r.activity,
        r.dewormingType,
        r.performedBy,
        r.remarks,
        r.status,
        r.healthStatus,
        r.feeCategory,
        r.species,
        r.speciesType,
        r.barangay,
        r.firstName,
        r.lastName,
        r.paymentStatus,
      ].some((f) => f && String(f).toLowerCase().includes(n))
    );
  }, [records, allRecords, recordQ, selected?.id]);

  const displayedRecords = useMemo(() => {
    if (selected?.id) return records;
    return allRecords;
  }, [selected?.id, records, allRecords]);

  // =========================
  // STATS
  // =========================
  const stats = useMemo(() => {
    const source = displayedRecords;

    const total = source.length;
    const completed = source.filter((r) => r.status === "done").length;
    const pending = source.filter((r) => r.status === "pending").length;
    const missed = source.filter((r) => r.status === "missed").length;
    const totalHeads = source.reduce((sum, r) => sum + Number(r.heads || 0), 0);
    const totalFees = source.reduce((sum, r) => sum + Number(r.serviceFee || 0), 0);
    const paidFees = source.filter((r) => r.paymentStatus === "paid")
      .reduce((sum, r) => sum + Number(r.serviceFee || 0), 0);

    const critical = source.filter((r) =>
      ["lethargic_depressed", "moribund", "guarded_prognosis"].includes(r.healthStatus)
    ).length;

    const byActivity = {};
    source.forEach((r) => {
      const key =
        r.activity === "Deworming" && r.dewormingType
          ? `${r.activity} (${r.dewormingType === "large" ? "Large" : "Small"})`
          : r.activity;
      byActivity[key] = (byActivity[key] || 0) + 1;
    });

    return {
      total,
      completed,
      pending,
      missed,
      totalHeads: roundToWhole(totalHeads),
      totalFees: roundToTwo(totalFees),
      paidFees: roundToTwo(paidFees),
      critical,
      byActivity,
    };
  }, [displayedRecords]);

  // =========================
  // MAP ANIMAL TO FORM
  // =========================
  const mapAnimalToForm = (animal) => {
    const speciesOption = SPECIES_OPTIONS.find((s) => s.species === animal?.species);

    return {
      animalId: animal?.id || "",
      firstName: animal?.ownerFirstName || "",
      middleName: animal?.ownerMI || "",
      lastName: animal?.ownerLastName || "",
      gender: animal?.ownerGender || "",
      birthday: animal?.ownerBirthday || "",
      contactNo: animal?.ownerContact || "",
      species: animal?.species || "",
      speciesType: speciesOption?.type || "",
      speciesOther: animal?.speciesOther || "",
      sex: animal?.sex || "",
      age: animal?.age || "",
      animalRegistered: animal?.animalRegistered || "",
      heads: animal?.noOfHeads || 1,
      barangay: animal?.farmBarangay || animal?.barangay || "",
    };
  };

  // =========================
  // OPEN CREATE
  // =========================
  const openCreate = () => {
    setErr("");
    setEditing(null);
    setMatchingError("");

    const today = new Date().toISOString().slice(0, 10);
    const baseAnimal = selected || null;
    const prefill = baseAnimal ? mapAnimalToForm(baseAnimal) : {};

    const defaultActivity = availableServices.length > 0 
      ? availableServices[0].label 
      : "Anti-rabies Vaccination";

    setForm({
      animalId: prefill.animalId || "",
      firstName: prefill.firstName || "",
      middleName: prefill.middleName || "",
      lastName: prefill.lastName || "",
      gender: prefill.gender || "",
      birthday: prefill.birthday || "",
      contactNo: prefill.contactNo || "",
      species: prefill.species || "",
      speciesType: prefill.speciesType || "",
      speciesOther: prefill.speciesOther || "",
      sex: prefill.sex || "",
      age: prefill.age || "",
      animalRegistered: prefill.animalRegistered || "",
      heads: prefill.heads || 1,
      barangay: prefill.barangay || "",
      date: today,
      activity: defaultActivity,
      remarks: "",

      dewormingType: "",
      serviceFee: 0,
      feeRate: 0,
      feeBasis: "",
      feeCategory: "",

      healthStatus: "",
      healthStatusDetails: "",
      symptoms: [],
      prognosis: "",
      hydration: "",
      eyesCondition: "",
      coatCondition: "",
      behavior: "",
      appetite: "",
      weightCondition: "",
      dewormingStatus: "",
      vaccinationStatus: "",
      trackInventory: false,
      usedItems: [],
      manualMode: false,
      performedBy: auth.currentUser?.displayName || "",
      status: "done",
      followUpDate: "",
      
      hasInvoice: false,
      invoiceId: null,
      paymentStatus: "pending",
    });

    // Reset search query
    if (baseAnimal) {
      const display = `${baseAnimal.tagId || "No Tag"} • ${baseAnimal.ownerFirstName || ""} ${baseAnimal.ownerLastName || ""}`.trim();
      setAnimalSearchQuery(display);
    } else {
      setAnimalSearchQuery("");
    }
    setShowSuggestions(false);

    setModalOpen(true);
  };

  // =========================
  // OPEN EDIT
  // =========================
  const openEdit = (record) => {
    setErr("");
    setEditing(record);
    setMatchingError("");

    setForm({
      animalId: record.animalId || "",
      firstName: record.firstName || "",
      middleName: record.middleName || "",
      lastName: record.lastName || "",
      gender: record.gender || "",
      birthday: record.birthday || "",
      contactNo: record.contactNo || "",
      species: record.species || "",
      speciesType: record.speciesType || "",
      speciesOther: record.speciesOther || "",
      sex: record.sex || "",
      age: record.age || "",
      animalRegistered: record.animalRegistered || "",
      heads: record.heads ?? 1,
      barangay: record.barangay || "",
      date: record.date || "",
      activity: record.activity || "Anti-rabies Vaccination",
      remarks: record.remarks || "",

      dewormingType: record.dewormingType || "",
      serviceFee: record.serviceFee || 0,
      feeRate: record.feeRate || 0,
      feeBasis: record.feeBasis || "",
      feeCategory: record.feeCategory || "",

      healthStatus: record.healthStatus || "",
      healthStatusDetails: record.healthStatusDetails || "",
      symptoms: record.symptoms || [],
      prognosis: record.prognosis || "",
      hydration: record.hydration || "",
      eyesCondition: record.eyesCondition || "",
      coatCondition: record.coatCondition || "",
      behavior: record.behavior || "",
      appetite: record.appetite || "",
      weightCondition: record.weightCondition || "",
      dewormingStatus: record.dewormingStatus || "",
      vaccinationStatus: record.vaccinationStatus || "",
      trackInventory: record.trackInventory || false,
      usedItems: record.usedItems || [],
      manualMode: record.manualMode || false,
      performedBy: record.performedBy || "",
      status: record.status || "done",
      followUpDate: record.followUpDate || "",
      
      hasInvoice: record.hasInvoice || false,
      invoiceId: record.invoiceId || null,
      paymentStatus: record.paymentStatus || "pending",
    });

    // Set search query from the animal
    const animal = animals.find(a => a.id === record.animalId);
    if (animal) {
      const display = `${animal.tagId || "No Tag"} • ${animal.ownerFirstName || ""} ${animal.ownerLastName || ""}`.trim();
      setAnimalSearchQuery(display);
    } else {
      setAnimalSearchQuery("");
    }
    setShowSuggestions(false);

    setModalOpen(true);
  };

  // =========================
  // ANIMAL SEARCH HANDLERS
  // =========================
  // Filter animals for search dropdown
  const searchedAnimals = useMemo(() => {
    const q = animalSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return animals.filter(a =>
      [a.tagId, a.ownerFirstName, a.ownerLastName, a.species, a.breed, a.farmBarangay, a.barangay]
        .some(f => f && String(f).toLowerCase().includes(q))
    ).slice(0, 10);
  }, [animals, animalSearchQuery]);

  // When animalId changes (from edit or selection), update the search input
  useEffect(() => {
    if (form.animalId) {
      const animal = animals.find(a => a.id === form.animalId);
      if (animal) {
        const display = `${animal.tagId || "No Tag"} • ${animal.ownerFirstName || ""} ${animal.ownerLastName || ""}`.trim();
        setAnimalSearchQuery(display);
      }
    }
  }, [form.animalId, animals]);

  // Select animal from search
  const selectAnimal = (animal) => {
    const snap = mapAnimalToForm(animal);
    setForm(prev => ({ ...prev, ...snap }));
    const display = `${animal.tagId || "No Tag"} • ${animal.ownerFirstName || ""} ${animal.ownerLastName || ""}`.trim();
    setAnimalSearchQuery(display);
    setShowSuggestions(false);
  };

  // Clear animal selection
  const clearAnimal = () => {
    setForm(prev => ({
      ...prev,
      animalId: "",
      firstName: "",
      middleName: "",
      lastName: "",
      gender: "",
      birthday: "",
      contactNo: "",
      species: "",
      speciesType: "",
      speciesOther: "",
      sex: "",
      age: "",
      animalRegistered: "",
      heads: 1,
      barangay: "",
    }));
    setAnimalSearchQuery("");
    setShowSuggestions(false);
  };

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const validate = () => {
    if (!form.animalId) return "Please choose an animal in the dropdown.";
    if (!form.date) return "Date is required.";
    if (!form.activity) return "Activity is required.";
    if (form.species === "Other" && !form.speciesOther.trim()) return "Please specify species.";
    if (form.activity === "Deworming" && !form.dewormingType) {
      return "Please select deworming type.";
    }

    const mapping = ACTIVITY_ITEM_MAPPING[form.activity];

    if (mapping && !form.manualMode && matchedItems.length === 0 && inventoryBatches.length > 0) {
      return `No matching items found for ${form.activity}. Either add inventory or enable manual mode.`;
    }

    if (mapping && !form.manualMode && matchedItems.length > 0) {
      const heads = Number(form.heads) || 1;
      if ((stockInfo.canServe || 0) < heads) {
        return `Insufficient stock. Only enough for ${stockInfo.canServe} animal(s) out of ${heads}.`;
      }
    }

    return "";
  };

  // =========================
  // CALCULATE QUANTITY TO DEDUCT
  // =========================
  const calculateQuantityToDeduct = (batch, activity, heads = 1) => {
    const unit = batch.unit || "vials";
    const mapping = ACTIVITY_ITEM_MAPPING[activity];
    const defaultDose = mapping?.defaultDose || 1;

    const perAnimalQty = defaultDose;
    let deduction;

    switch (unit) {
      case "vials":
        deduction = (perAnimalQty * heads) / 10;
        break;
      case "bottles":
        deduction = (perAnimalQty * heads) / 100;
        break;
      case "tablets":
      case "capsules":
        deduction = perAnimalQty * heads;
        break;
      case "liters":
        deduction = (perAnimalQty * heads) / 1000;
        break;
      default:
        deduction = perAnimalQty * heads;
    }

    return roundToTwo(deduction);
  };

  // =========================
  // UPDATE INVENTORY
  // =========================
  const updateInventoryFromService = async (isDeleting = false, oldRecord = null) => {
    try {
      if (form.manualMode && !isDeleting) return true;

      const mapping = ACTIVITY_ITEM_MAPPING[form.activity];
      if (!mapping || matchedItems.length === 0) return true;

      const heads = Number(form.heads) || 1;
      const usedItems = [];

      if (isDeleting && oldRecord) {
        for (const item of oldRecord.usedItems || []) {
          const batchRef = doc(db, "p1_inventory_batches", item.batchId);
          const batchSnap = await getDoc(batchRef);

          if (batchSnap.exists()) {
            const batch = batchSnap.data();
            const newQty = (batch.qtyOnHand || 0) + item.quantity;

            await updateDoc(batchRef, {
              qtyOnHand: roundToTwo(newQty),
              updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, "p1_inventory_movements"), {
              batchId: item.batchId,
              batchNo: item.batchNo,
              itemId: batch.itemId,
              itemName: item.itemName,
              type: "RETURN",
              qty: item.quantity,
              newBalance: roundToTwo(newQty),
              reference: `Service Deleted: ${oldRecord.activity}`,
              movedAt: new Date().toISOString().split("T")[0],
              reason: "Service record deleted",
              performedBy: auth.currentUser?.displayName || "System",
              createdAt: serverTimestamp(),
              createdBy: auth.currentUser?.uid,
            });
          }
        }
        return true;
      }

      let remainingHeads = heads;

      const sortedBatches = [...matchedItems].sort((a, b) => {
        if (a.expiryDate !== b.expiryDate) return new Date(a.expiryDate) - new Date(b.expiryDate);
        return new Date(a.receivedDate || a.createdAt) - new Date(b.receivedDate || b.createdAt);
      });

      for (const batch of sortedBatches) {
        if (remainingHeads <= 0) break;

        const qtyToDeduct = calculateQuantityToDeduct(batch, form.activity, 1);
        const availableQty = Number(batch.qtyOnHand || 0);

        if (availableQty <= 0) continue;

        const headsCovered = Math.min(Math.floor(availableQty / qtyToDeduct), remainingHeads);

        if (headsCovered > 0) {
          const actualDeduction = roundToTwo(qtyToDeduct * headsCovered);
          const newQty = roundToTwo(availableQty - actualDeduction);

          const batchRef = doc(db, "p1_inventory_batches", batch.id);
          await updateDoc(batchRef, {
            qtyOnHand: newQty,
            updatedAt: serverTimestamp(),
            lastUsed: new Date().toISOString(),
          });

          await addDoc(collection(db, "p1_inventory_movements"), {
            batchId: batch.id,
            batchNo: batch.batchNo,
            itemId: batch.itemId,
            itemName: batch.itemName,
            type: "OUT",
            qty: actualDeduction,
            newBalance: newQty,
            reference: `${form.activity}-${form.animalId}`,
            movedAt: form.date,
            reason: `${form.activity} for ${headsCovered} animal(s)`,
            headsCovered,
            performedBy: form.performedBy || auth.currentUser?.displayName,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser?.uid,
          });

          usedItems.push({
            batchId: batch.id,
            batchNo: batch.batchNo,
            itemName: batch.itemName,
            quantity: actualDeduction,
            unit: batch.unit,
            headsCovered,
          });

          remainingHeads -= headsCovered;
        }
      }

      if (remainingHeads > 0 && !form.manualMode) {
        throw new Error(`Insufficient inventory. Only covered ${heads - remainingHeads} out of ${heads} animals.`);
      }

      return usedItems;
    } catch (e) {
      console.error("Error updating inventory:", e);
      throw e;
    }
  };

  // =========================
  // SAVE
  // =========================
  const save = async () => {
    const m = validate();
    if (m) return setErr(m);

    const user = auth.currentUser;
    if (!user) return setErr("No active session. Please sign in again.");

    setBusy(true);
    setErr("");

    try {
      const needsInventory = Boolean(ACTIVITY_ITEM_MAPPING[form.activity] && matchedItems.length > 0);
      let usedItems = form.usedItems;

      if (!editing?.id && needsInventory && !form.manualMode) {
        usedItems = await updateInventoryFromService(false);
      }

      const payload = {
        animalId: form.animalId,
        firstName: form.firstName || "",
        middleName: form.middleName || "",
        lastName: form.lastName || "",
        gender: form.gender || "",
        birthday: form.birthday || "",
        contactNo: form.contactNo || "",
        species: form.species || "",
        speciesType: form.speciesType || "",
        speciesOther: form.speciesOther || "",
        sex: form.sex || "",
        age: form.age || "",
        animalRegistered: form.animalRegistered || "",
        heads: Number(form.heads) || 1,
        barangay: form.barangay || "",
        date: form.date,
        activity: form.activity,
        remarks: form.remarks || "",

        dewormingType: form.dewormingType || "",
        serviceFee: Number(form.serviceFee || 0),
        feeRate: Number(form.feeRate || 0),
        feeBasis: form.feeBasis || "",
        feeCategory: form.feeCategory || "",

        healthStatus: form.healthStatus || "",
        healthStatusDetails: form.healthStatusDetails || "",
        symptoms: form.symptoms || [],
        prognosis: form.prognosis || "",
        hydration: form.hydration || "",
        eyesCondition: form.eyesCondition || "",
        coatCondition: form.coatCondition || "",
        behavior: form.behavior || "",
        appetite: form.appetite || "",
        weightCondition: form.weightCondition || "",
        dewormingStatus: form.dewormingStatus || "",
        vaccinationStatus: form.vaccinationStatus || "",
        trackInventory: needsInventory && !form.manualMode,
        usedItems: form.manualMode ? [] : usedItems,
        manualMode: form.manualMode,
        performedBy: form.performedBy || "",
        status: form.status || "done",
        followUpDate: form.followUpDate || "",
        
        hasInvoice: form.hasInvoice || false,
        invoiceId: form.invoiceId || null,
        paymentStatus: form.paymentStatus || "pending",
        
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };

      if (editing?.id) {
        await updateDoc(doc(db, "program1_routine_services", editing.id), payload);
        showToast({ title: "Record updated", sub: `${payload.activity} • ${payload.date}`, type: "ok" });
      } else {
        await addDoc(collection(db, "program1_routine_services"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
        showToast({ title: "Record saved", sub: `${payload.activity} • ${payload.date}`, type: "ok" });
      }

      const usedAnimal = animals.find((a) => a.id === payload.animalId);
      if (usedAnimal) setSelected(usedAnimal);

      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to save. Check Firestore rules.");
    } finally {
      setBusy(false);
    }
  };

  // =========================
  // DELETE
  // =========================
  const requestDelete = (record) => {
    setToDelete(record);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete?.id) return;

    setBusy(true);
    setErr("");

    try {
      if (toDelete.trackInventory && toDelete.usedItems?.length > 0) {
        await updateInventoryFromService(true, toDelete);
      }

      await deleteDoc(doc(db, "program1_routine_services", toDelete.id));
      showToast({ title: "Record deleted", sub: `${toDelete.activity} • ${toDelete.date}`, type: "warn" });
    } catch (e) {
      console.error(e);
      setErr("Failed to delete. Check Firestore rules.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      setToDelete(null);
    }
  };

  const getHealthStatusLabel = (value) => {
    const status = HEALTH_STATUS.find((s) => s.value === value);
    return status ? status.label : value;
  };

  const getDewormingTypeLabel = (value) => {
    if (value === "large") return "Large Ruminant";
    if (value === "small") return "Small Ruminant";
    return "—";
  };

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      paid: { label: 'Paid', className: 'p1s-payment-paid' },
      pending: { label: 'Pending', className: 'p1s-payment-pending' },
      overdue: { label: 'Overdue', className: 'p1s-payment-overdue' },
      processing: { label: 'Processing', className: 'p1s-payment-processing' },
      cancelled: { label: 'Cancelled', className: 'p1s-payment-cancelled' },
      refunded: { label: 'Refunded', className: 'p1s-payment-refunded' },
    };
    const config = statusMap[status] || statusMap.pending;
    return <span className={`p1s-payment-badge ${config.className}`}>{config.label}</span>;
  };

  return (
    <div className="p1s-page p1-fontPro">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="p1s-shell">
        <div className="p1s-top">
          <div className="p1s-topLeft">
            <div className="p1s-h1">Routine Services Monitoring Report</div>
            <div className="p1s-sub">
              Encode routine activities with automatic inventory deduction and pricing.
              {isBillingLoaded && Object.keys(billingPrices).length > 0 && (
                <span className="p1s-billing-indicator">
                  <CreditCard size={14} />
                  Billing prices loaded
                </span>
              )}
              {!isServicesLoaded && (
                <span className="p1s-billing-indicator" style={{ background: '#fef3c7', color: '#92400e' }}>
                  <Info size={14} />
                  Loading services...
                </span>
              )}
            </div>
          </div>

          <div className="p1s-topActions">
            <button className="p1s-iconBtn" title="Export" type="button" onClick={() => setExportModalOpen(true)}>
              <Download size={18} />
            </button>

            <button className="p1s-primary p1-add-btn primary" onClick={openCreate} type="button">
              <Plus size={18} /> Add Record
            </button>
          </div>
        </div>

        {err ? <div className="p1s-error">{err}</div> : null}

        <div className="p1s-toolbar">
          <div className="p1s-search">
            <Search size={18} />
            <input value={animalQ} onChange={(e) => setAnimalQ(e.target.value)} placeholder="Search animals..." />
            {animalQ ? (
              <button className="p1s-clear" onClick={() => setAnimalQ("")} type="button">
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="p1s-search">
            <Search size={18} />
            <input value={recordQ} onChange={(e) => setRecordQ(e.target.value)} placeholder="Search records..." />
            {recordQ ? (
              <button className="p1s-clear" onClick={() => setRecordQ("")} type="button">
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="p1s-stats">
          <div className="p1s-statCard">
            <div className="p1s-statLabel">Total Records</div>
            <div className="p1s-statValue">{stats.total}</div>
            <div className="p1s-statMeta">{selected?.id ? "For selected animal" : "Overall records"}</div>
          </div>
          <div className="p1s-statCard">
            <div className="p1s-statLabel">Completed</div>
            <div className="p1s-statValue">{stats.completed}</div>
            <div className="p1s-statMeta">{selected?.id ? "Selected animal" : "Overall completed"}</div>
          </div>
          <div className="p1s-statCard">
            <div className="p1s-statLabel">Total Fees</div>
            <div className="p1s-statValue">₱{stats.totalFees}</div>
            <div className="p1s-statMeta">{selected?.id ? "Selected animal" : "Overall fees"}</div>
          </div>
          <div className="p1s-statCard">
            <div className="p1s-statLabel">Paid Fees</div>
            <div className="p1s-statValue" style={{ color: '#10b981' }}>₱{stats.paidFees}</div>
            <div className="p1s-statMeta">Total payments collected</div>
          </div>
          <div className="p1s-statCard">
            <div className="p1s-statLabel">Available Items</div>
            <div className="p1s-statValue">{inventorySummary.totalItems}</div>
            <div className="p1s-statMeta">Total stock</div>
          </div>
          <div className="p1s-statCard">
            <div className="p1s-statLabel">Low Stock</div>
            <div className="p1s-statValue">{inventorySummary.lowStock}</div>
            <div className="p1s-statMeta">Needs reorder</div>
          </div>
        </div>

        <div className="p1s-category-stats">
          <div className="p1s-category-header">
            <BarChart3 size={18} />
            <span>Inventory Status by Category</span>
          </div>
          <div className="p1s-category-grid">
            {Object.entries(inventorySummary.byCategory).map(([category, data]) => {
              const roundedCount = roundToTwo(data.count);
              const roundedDoses = roundToWhole(data.totalDoses || data.count * 10);
              const roundedAnimals = roundToWhole(data.maxAnimals || data.count * 10);

              return (
                <div key={category} className={`p1s-category-card ${data.count <= 10 ? "low" : ""}`}>
                  <div className="p1s-category-name">{category}</div>
                  <div className="p1s-category-stock">
                    <div className="p1s-stock-item">
                      <Package size={14} />
                      <span>{roundedCount} units</span>
                    </div>
                    <div className="p1s-stock-item">
                      <Info size={14} />
                      <span>{roundedDoses} doses</span>
                    </div>
                    <div className="p1s-stock-item">
                      <TrendingDown size={14} />
                      <span>Can serve {roundedAnimals} animals</span>
                    </div>
                  </div>
                  {data.count <= 10 && (
                    <div className="p1s-low-stock-badge">
                      <AlertCircle size={12} />
                      Low Stock
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {inventorySummary.expiringSoon > 0 && (
          <div className="p1s-alert">
            <AlertTriangle size={16} />
            <span>{inventorySummary.expiringSoon} item(s) expiring within 3 months.</span>
          </div>
        )}

        <div className="p1s-grid">
          <div className="p1s-card">
            <div className="p1s-cardTitle" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={18} /> Registered Animals
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  border: "1px solid #cbd5e1",
                  background: !selected?.id ? "#10b981" : "#fff",
                  color: !selected?.id ? "#fff" : "#334155",
                  borderRadius: "999px",
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Show Overall
              </button>
            </div>

            <div className="p1s-list">
              {filteredAnimals.map((a) => {
                const speciesType = SPECIES_OPTIONS.find((s) => s.species === a.species)?.type || "";
                return (
                  <button
                    key={a.id}
                    className={`p1s-item ${selected?.id === a.id ? "active" : ""}`}
                    onClick={() => setSelected(a)}
                    type="button"
                  >
                    <div className="p1s-itemTop">
                      <b>{a.tagId || "No Tag"}</b>
                      <span className="p1s-badge">{a.farmBarangay || a.barangay || "—"}</span>
                    </div>
                    <div className="p1s-itemSub">
                      {a.species || "—"} ({speciesType || "—"}) • {a.breed || "—"} • {a.sex || "—"}
                    </div>
                  </button>
                );
              })}

              {filteredAnimals.length === 0 && <div className="p1s-empty">No animals found.</div>}
            </div>
          </div>

          <div className="p1s-card">
            <div className="p1s-cardTitle">
              <Stethoscope size={18} /> Service Records for:{" "}
              <span className="p1s-strong">
                {selected
                  ? `${selected.ownerFirstName || ""} ${selected.ownerLastName || ""}`.trim() || "—"
                  : "All Animals"}
              </span>
            </div>

            <div className="p1s-tableWrap">
              <table className="p1s-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activity</th>
                    <th>Deworming Type</th>
                    <th>Animal</th>
                    <th>Heads</th>
                    <th>Fee</th>
                    <th>Items Used</th>
                    <th>Health Status</th>
                    <th>Performed by</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th className="p1s-actCol">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => (
                    <tr key={r.id}>
                      <td>{fmt(r.date)}</td>
                      <td>
                        <b>{fmt(r.activity)}</b>
                      </td>
                      <td>{getDewormingTypeLabel(r.dewormingType)}</td>
                      <td>
                        {r.species === "Other" ? r.speciesOther || "Other" : r.species || "—"}
                        {r.speciesType ? ` (${r.speciesType})` : ""}
                      </td>
                      <td>{Number(r.heads || 1)}</td>
                      <td>{r.serviceFee ? `₱${roundToTwo(r.serviceFee)}` : "—"}</td>
                      <td>
                        {r.trackInventory && r.usedItems?.length > 0 ? (
                          <div className="p1s-items">
                            {r.usedItems.map((item, idx) => (
                              <div key={idx} className="p1s-item-line">
                                <Package size={12} />
                                <span>
                                  {item.itemName} x{item.quantity}
                                </span>
                                <span className="p1s-batch">({item.batchNo})</span>
                              </div>
                            ))}
                          </div>
                        ) : r.manualMode ? (
                          "Manual (no deduction)"
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className={`p1s-health ${r.healthStatus || ""}`}>
                          {getHealthStatusLabel(r.healthStatus) || "—"}
                        </span>
                      </td>
                      <td>{fmt(r.performedBy)}</td>
                      <td>
                        <span className={`p1s-pill ${r.status || "done"}`}>{r.status || "done"}</span>
                      </td>
                      <td>{getPaymentStatusBadge(r.paymentStatus || "pending")}</td>
                      <td className="p1s-actions">
                        <button
                          className="p1s-icoBtn"
                          onClick={() => openEdit(r)}
                          disabled={busy}
                          type="button"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="p1s-icoBtn danger"
                          onClick={() => requestDelete(r)}
                          disabled={busy}
                          type="button"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p1s-emptyRow">
                        {selected?.id ? "No service records yet." : "No records found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Modal open={modalOpen} onClose={() => (busy ? null : setModalOpen(false))}>
          <div className="p1m2">
            <div className="p1m2-head">
              <div className="p1m2-titleBlock">
                <div className="p1m2-titleRow">
                  <div className="p1m2-title">{editing ? "Edit Service Record" : "Add Service Record"}</div>
                  <span className={`p1m2-chip ${form.status}`}>{String(form.status || "done").toUpperCase()}</span>
                </div>
                <div className="p1m2-sub">Fill in all fields - inventory will auto-deduct based on activity.</div>
              </div>
              <button className="p1m2-close" onClick={() => setModalOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="p1m2-body">
              {err ? <div className="p1m2-inlineErr">{err}</div> : null}
              {matchingError && !form.manualMode && (
                <div className="p1m2-warning">
                  <AlertTriangle size={16} />
                  <span>{matchingError}</span>
                </div>
              )}

              {matchedItems.length > 0 && !form.manualMode && (
                <div className={`p1m2-stock-bar ${stockInfo.recommended === "insufficient" ? "warning" : "ok"}`}>
                  <div className="p1m2-stock-info">
                    <Package size={16} />
                    <span>
                      <strong>Available Stock:</strong> {stockInfo.totalDoses} total doses | Can serve{" "}
                      <strong>{stockInfo.maxAnimals} animals</strong>
                    </span>
                  </div>
                  {stockInfo.recommended === "insufficient" && (
                    <div className="p1m2-stock-warning">
                      <AlertCircle size={14} />
                      <span>
                        Only enough for {stockInfo.canServe} of {form.heads} animals
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="p1m2-grid">
                <section className="p1m2-card">
                  <div className="p1m2-cardHead">
                    <div className="p1m2-cardTitle">
                      <User size={18} /> Client Information
                    </div>
                    <div className="p1m2-cardHint">Owner / Head of Family</div>
                  </div>

                  <div className="p1m2-fields">
                    {/* ========== SEARCHABLE ANIMAL COMBOBOX ========== */}
                    <div className="p1m2-row" ref={searchRef}>
                      <label>
                        Select Animal <span className="p1m2-req">*</span>
                      </label>
                      <div className="p1m2-combobox">
                        <input
                          type="text"
                          value={animalSearchQuery}
                          onChange={(e) => {
                            setAnimalSearchQuery(e.target.value);
                            setShowSuggestions(true);
                            // If the user clears the input, reset animal selection
                            if (!e.target.value) clearAnimal();
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          placeholder="Search by tag, owner, species, barangay..."
                          className="p1m2-combobox-input"
                        />
                        {animalSearchQuery && (
                          <button
                            className="p1m2-combobox-clear"
                            onClick={clearAnimal}
                            type="button"
                            aria-label="Clear selection"
                          >
                            <X size={16} />
                          </button>
                        )}
                        {showSuggestions && (
                          <div className="p1m2-combobox-dropdown">
                            {searchedAnimals.length > 0 ? (
                              searchedAnimals.map((a) => (
                                <div
                                  key={a.id}
                                  className="p1m2-combobox-item"
                                  onClick={() => selectAnimal(a)}
                                >
                                  <span className="p1m2-combobox-tag">{a.tagId || "No Tag"}</span>
                                  <span className="p1m2-combobox-name">
                                    {a.ownerFirstName || ""} {a.ownerLastName || ""}
                                  </span>
                                  <span className="p1m2-combobox-species">{a.species || "—"}</span>
                                  <span className="p1m2-combobox-barangay">{a.farmBarangay || a.barangay || ""}</span>
                                </div>
                              ))
                            ) : (
                              <div className="p1m2-combobox-empty">No matching animals</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>First Name</label>
                        <input value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
                      </div>
                      <div className="p1m2-row">
                        <label>M.I.</label>
                        <input value={form.middleName} onChange={(e) => setForm((p) => ({ ...p, middleName: e.target.value }))} />
                      </div>
                    </div>

                    <div className="p1m2-row">
                      <label>Last Name</label>
                      <input value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Gender</label>
                        <select value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}>
                          <option value="">—</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>Birthday</label>
                        <input type="date" value={form.birthday} onChange={(e) => setForm((p) => ({ ...p, birthday: e.target.value }))} />
                      </div>
                    </div>

                    <div className="p1m2-row">
                      <label>Contact No.</label>
                      <input value={form.contactNo} onChange={(e) => setForm((p) => ({ ...p, contactNo: e.target.value }))} />
                    </div>
                  </div>
                </section>

                <section className="p1m2-card">
                  <div className="p1m2-cardHead">
                    <div className="p1m2-cardTitle">
                      <PawPrint size={18} /> Animal & Service
                    </div>
                    <div className="p1m2-cardHint">Activity, Date, Remarks</div>
                  </div>

                  <div className="p1m2-fields">
                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Species</label>
                        <select
                          value={form.species}
                          onChange={(e) => {
                            const selectedSpecies = e.target.value;
                            const speciesOption = SPECIES_OPTIONS.find((s) => s.species === selectedSpecies);
                            setForm((p) => ({
                              ...p,
                              species: selectedSpecies,
                              speciesType: speciesOption?.type || "",
                            }));
                          }}
                        >
                          <option value="">—</option>
                          {SPECIES_OPTIONS.map((s) => (
                            <option key={s.species} value={s.species}>
                              {s.species} ({s.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p1m2-row">
                        <label>Species Type</label>
                        <input value={form.speciesType} readOnly className="p1m2-readonly" />
                      </div>
                    </div>

                    {form.species === "Other" && (
                      <div className="p1m2-row">
                        <label>Specify Species</label>
                        <input value={form.speciesOther} onChange={(e) => setForm((p) => ({ ...p, speciesOther: e.target.value }))} />
                      </div>
                    )}

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Sex</label>
                        <select value={form.sex} onChange={(e) => setForm((p) => ({ ...p, sex: e.target.value }))}>
                          <option value="">—</option>
                          {SEX_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>Age</label>
                        <input value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} />
                      </div>
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Animal Registered?</label>
                        <select value={form.animalRegistered} onChange={(e) => setForm((p) => ({ ...p, animalRegistered: e.target.value }))}>
                          <option value="">—</option>
                          {YESNO_OPTIONS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>No. of Heads</label>
                        <input
                          type="number"
                          min="1"
                          value={form.heads}
                          onChange={(e) => setForm((p) => ({ ...p, heads: e.target.value }))}
                        />
                        {matchedItems.length > 0 && !form.manualMode && (
                          <div className="p1m2-field-hint">Max possible: {stockInfo.maxAnimals} animals</div>
                        )}
                      </div>
                    </div>

                    <div className="p1m2-row">
                      <label>Barangay</label>
                      <input value={form.barangay} onChange={(e) => setForm((p) => ({ ...p, barangay: e.target.value }))} />
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>
                          Date <span className="p1m2-req">*</span>
                        </label>
                        <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                      </div>
                      <div className="p1m2-row">
                        <label>
                          Activity <span className="p1m2-req">*</span>
                        </label>
                        <select
                          value={form.activity}
                          onChange={(e) => handleActivityChange(e.target.value)}
                        >
                          <option value="">— Select Activity —</option>
                          {availableServices.map((service) => (
                            <option key={service.id} value={service.label}>
                              {service.label} (₱{service.currentPrice || service.defaultPrice || 0}/{service.unit || 'head'})
                            </option>
                          ))}
                          {availableServices.length === 0 && (
                            <option value="" disabled>No services available</option>
                          )}
                        </select>
                        {!isServicesLoaded && (
                          <div className="p1m2-field-hint">Loading services...</div>
                        )}
                      </div>
                    </div>

                    {form.activity === "Deworming" && (
                      <div className="p1m2-row">
                        <label>
                          Deworming Type <span className="p1m2-req">*</span>
                        </label>
                        <select
                          value={form.dewormingType}
                          onChange={(e) => setForm((p) => ({ ...p, dewormingType: e.target.value }))}
                        >
                          <option value="">— Select type —</option>
                          {DEWORMING_TYPES.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Rate</label>
                        <input value={form.feeBasis || "No pricing rule"} readOnly className="p1m2-readonly" />
                      </div>
                      <div className="p1m2-row">
                        <label>Total Fee</label>
                        <input value={`₱${roundToTwo(form.serviceFee || 0)}`} readOnly className="p1m2-readonly" />
                      </div>
                    </div>

                    {form.serviceFee > 0 && (
                      <div className="p1m2-field-hint">
                        {form.feeCategory} for {form.heads} head(s)
                      </div>
                    )}

                    <div className="p1m2-row">
                      <label>Remarks</label>
                      <textarea rows={2} value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
                    </div>

                    {ACTIVITY_ITEM_MAPPING[form.activity] && matchedItems.length === 0 && (
                      <div className="p1m2-row">
                        <label className="p1m2-checkbox">
                          <input
                            type="checkbox"
                            checked={form.manualMode}
                            onChange={(e) => setForm((p) => ({ ...p, manualMode: e.target.checked }))}
                          />
                          <span>Manual mode (skip inventory deduction)</span>
                        </label>
                      </div>
                    )}
                  </div>
                </section>

                {/* Payment Status Section */}
                <section className="p1m2-card p1m2-full-width">
                  <div className="p1m2-cardHead">
                    <div className="p1m2-cardTitle">
                      <CreditCard size={18} /> Payment & Billing
                    </div>
                    <div className="p1m2-cardHint">Track payment status</div>
                  </div>

                  <div className="p1m2-fields">
                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Payment Status</label>
                        <select
                          value={form.paymentStatus || "pending"}
                          onChange={(e) => setForm((p) => ({ ...p, paymentStatus: e.target.value }))}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>Amount Due</label>
                        <input value={`₱${roundToTwo(form.serviceFee || 0)}`} readOnly className="p1m2-readonly" />
                      </div>
                    </div>
                  </div>
                </section>

                {ACTIVITY_ITEM_MAPPING[form.activity] && matchedItems.length > 0 && !form.manualMode && (
                  <section className="p1m2-card p1m2-full-width">
                    <div className="p1m2-cardHead">
                      <div className="p1m2-cardTitle">
                        <Package size={18} /> Available Stock for {form.activity}
                      </div>
                      <div className="p1m2-cardHint">
                        Total: {stockInfo.totalDoses} doses | Can serve {stockInfo.maxAnimals} animals
                      </div>
                    </div>

                    <div className="p1m2-inventory-list">
                      {stockInfo.byBatch.map((batch, idx) => (
                        <div key={idx} className="p1m2-inventory-item">
                          <div className="p1m2-inventory-main">
                            <span className="p1m2-inventory-name">{batch.itemName}</span>
                            <span className="p1m2-inventory-batch">{batch.batchNo}</span>
                            <span className="p1m2-inventory-expiry">Exp: {batch.expiryDate}</span>
                          </div>
                          <div className="p1m2-inventory-stock">
                            <div>
                              {batch.qtyOnHand} {batch.unit}
                            </div>
                            <div className="p1m2-inventory-doses">
                              = {batch.doses} doses | {batch.animals} animals
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p1m2-capacity-indicator">
                      <div className="p1m2-capacity-label">
                        <span>Remaining capacity for this service:</span>
                        <strong>
                          {stockInfo.canServe} of {form.heads} animals
                        </strong>
                      </div>
                      <div className="p1m2-capacity-bar">
                        <div
                          className={`p1m2-capacity-fill ${stockInfo.recommended}`}
                          style={{ width: `${Math.min(100, ((stockInfo.canServe || 0) / Number(form.heads || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </section>
                )}

                <section className="p1m2-card p1m2-full-width">
                  <div className="p1m2-cardHead">
                    <div className="p1m2-cardTitle">
                      <AlertTriangle size={18} /> Health Status Assessment
                    </div>
                    <div className="p1m2-cardHint">From REMARKS column</div>
                  </div>

                  <div className="p1m2-fields">
                    <div className="p1m2-row">
                      <label>Overall Health Status</label>
                      <select value={form.healthStatus} onChange={(e) => setForm((p) => ({ ...p, healthStatus: e.target.value }))}>
                        <option value="">— Select health status —</option>
                        {HEALTH_STATUS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Behavior</label>
                        <select value={form.behavior} onChange={(e) => setForm((p) => ({ ...p, behavior: e.target.value }))}>
                          <option value="">—</option>
                          <option value="bright_alert">Bright, alert, responsive</option>
                          <option value="lethargic">Lethargic/Depressed</option>
                          <option value="moribund">Moribund</option>
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>Appetite</label>
                        <select value={form.appetite} onChange={(e) => setForm((p) => ({ ...p, appetite: e.target.value }))}>
                          <option value="">—</option>
                          <option value="normal">Normal</option>
                          <option value="anorexic">Anorexic</option>
                        </select>
                      </div>
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Hydration</label>
                        <select value={form.hydration} onChange={(e) => setForm((p) => ({ ...p, hydration: e.target.value }))}>
                          <option value="">—</option>
                          <option value="good">Good hydration</option>
                          <option value="dehydrated">Dehydrated</option>
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>Weight Condition</label>
                        <select value={form.weightCondition} onChange={(e) => setForm((p) => ({ ...p, weightCondition: e.target.value }))}>
                          <option value="">—</option>
                          <option value="normal">Normal</option>
                          <option value="underweight">Emaciated/Underweight</option>
                          <option value="stunted">Stunted Growth</option>
                        </select>
                      </div>
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Coat Condition</label>
                        <select value={form.coatCondition} onChange={(e) => setForm((p) => ({ ...p, coatCondition: e.target.value }))}>
                          <option value="">—</option>
                          <option value="healthy">Healthy</option>
                          <option value="unkempt">Unkempt/Rough Coat</option>
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>Eyes/Nose</label>
                        <select value={form.eyesCondition} onChange={(e) => setForm((p) => ({ ...p, eyesCondition: e.target.value }))}>
                          <option value="">—</option>
                          <option value="clear">Clear eyes/no discharge</option>
                          <option value="discharge">Nasa/Ocular Discharge</option>
                        </select>
                      </div>
                    </div>

                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Deworming Status</label>
                        <select value={form.dewormingStatus} onChange={(e) => setForm((p) => ({ ...p, dewormingStatus: e.target.value }))}>
                          <option value="">—</option>
                          <option value="dewormed">Dewormed</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                      <div className="p1m2-row">
                        <label>Vaccination Status</label>
                        <select value={form.vaccinationStatus} onChange={(e) => setForm((p) => ({ ...p, vaccinationStatus: e.target.value }))}>
                          <option value="">—</option>
                          <option value="up_to_date">Up-to-date</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                    </div>

                    <div className="p1m2-row">
                      <label>Prognosis</label>
                      <select value={form.prognosis} onChange={(e) => setForm((p) => ({ ...p, prognosis: e.target.value }))}>
                        <option value="">—</option>
                        <option value="good">Good</option>
                        <option value="guarded">Guarded Prognosis</option>
                        <option value="poor">Poor</option>
                      </select>
                    </div>

                    <div className="p1m2-row">
                      <label>Additional Notes</label>
                      <textarea
                        rows={2}
                        value={form.healthStatusDetails}
                        onChange={(e) => setForm((p) => ({ ...p, healthStatusDetails: e.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <section className="p1m2-card p1m2-full-width">
                  <div className="p1m2-fields">
                    <div className="p1m2-2">
                      <div className="p1m2-row">
                        <label>Performed by</label>
                        <input value={form.performedBy} onChange={(e) => setForm((p) => ({ ...p, performedBy: e.target.value }))} />
                      </div>
                      <div className="p1m2-row">
                        <label>Status</label>
                        <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                          {STATUS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="p1m2-row">
                      <label>Follow-up Date</label>
                      <input type="date" value={form.followUpDate} onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))} />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="p1m2-foot">
              <div className="p1m2-footNote">
                <CalendarClock size={16} />
                <span>
                  {matchedItems.length > 0 && !form.manualMode
                    ? `${stockInfo.totalDoses} doses available (${stockInfo.maxAnimals} animals) • Fee: ₱${roundToTwo(
                        form.serviceFee || 0
                      )} • Payment: ${form.paymentStatus || "pending"}`
                    : form.manualMode
                    ? `Manual mode • Fee: ₱${roundToTwo(form.serviceFee || 0)} • Payment: ${form.paymentStatus || "pending"}`
                    : `No items • Fee: ₱${roundToTwo(form.serviceFee || 0)} • Payment: ${form.paymentStatus || "pending"}`}
                </span>
              </div>
              <div className="p1m2-actions">
                <button className="p1m2-btn ghost" onClick={() => setModalOpen(false)} disabled={busy} type="button">
                  Cancel
                </button>
                <button className="p1m2-btn" onClick={save} disabled={busy} type="button">
                  {busy ? "Saving…" : editing ? "Save Changes" : "Save Record"}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} onExport={handleExport} />

        <ConfirmModal
          open={confirmOpen}
          title="Delete this record?"
          message={`Permanently remove "${toDelete?.activity || "—"} • ${toDelete?.date || "—"}"?`}
          dangerText="Delete Record"
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