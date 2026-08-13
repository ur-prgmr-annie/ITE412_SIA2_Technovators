// src/pages/admin/AdminBilling.jsx
import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Save,
  X,
  Package,
  PlusCircle,
  Clock,
} from 'lucide-react';
import { auth, db } from '../../services/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import '../../styles/adminBilling.css';

// Default service categories (seed data)
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

// ========== Toast Component ==========
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`ab-toast ${toast.type || "ok"}`}>
      <div className="ab-toast-icon">
        {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
      </div>
      <div className="ab-toast-body">
        <div className="ab-toast-title">{toast.title}</div>
        {toast.sub && <div className="ab-toast-msg">{toast.sub}</div>}
      </div>
      <button className="ab-toast-close" onClick={onClose} type="button">
        <X size={16} />
      </button>
    </div>
  );
}

// ========== Confirm Modal ==========
function ConfirmModal({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="ab-confirm-overlay">
      <div className="ab-confirm-card">
        <div className="ab-confirm-head">
          <div className="ab-confirm-title">
            <AlertCircle size={18} />
            <span>{title}</span>
          </div>
          <button className="ab-confirm-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="ab-confirm-body">
          <p className="ab-confirm-msg">{message}</p>
          <div className="ab-confirm-actions">
            <button className="ab-btn ghost" onClick={onCancel}>Cancel</button>
            <button className="ab-btn danger" onClick={onConfirm}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBilling() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [priceHistory, setPriceHistory] = useState({});
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [selectedServiceHistory, setSelectedServiceHistory] = useState(null);
  const [showAddService, setShowAddService] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // New service form
  const [serviceForm, setServiceForm] = useState({
    id: '',
    label: '',
    defaultPrice: 0,
    unit: 'per head',
    category: 'Service',
    isCustom: true,
  });

  const showToast = (t) => {
    setToast(t);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3000);
  };

  // Load services from Firestore
  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        const servicesRef = collection(db, 'billing_services');
        const servicesSnapshot = await getDocs(servicesRef);
        let servicesData = [];
        let pricesData = {};
        let historyData = {};

        if (servicesSnapshot.empty) {
          // Seed default services
          for (const defaultService of DEFAULT_SERVICES) {
            const docRef = await addDoc(collection(db, 'billing_services'), {
              ...defaultService,
              serviceId: defaultService.id,
              createdAt: serverTimestamp(),
              createdBy: auth.currentUser?.uid || 'system',
            });
            await setDoc(doc(db, 'billing_service_prices', defaultService.id), {
              price: defaultService.defaultPrice,
              updatedAt: serverTimestamp(),
              updatedBy: auth.currentUser?.email || 'system',
              priceHistory: [],
            });
            servicesData.push({
              id: docRef.id,
              ...defaultService,
              serviceId: defaultService.id,
              currentPrice: defaultService.defaultPrice,
              lastUpdated: null,
              updatedBy: null,
            });
          }
        } else {
          servicesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            servicesData.push({
              id: doc.id,
              ...data,
              serviceId: data.serviceId || data.id || doc.id,
            });
          });

          const pricesRef = collection(db, 'billing_service_prices');
          const pricesSnapshot = await getDocs(pricesRef);
          pricesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            pricesData[doc.id] = {
              price: data.price || 0,
              lastUpdated: data.updatedAt?.toDate?.() || data.updatedAt || null,
              updatedBy: data.updatedBy || null,
              priceHistory: data.priceHistory || []
            };
            historyData[doc.id] = data.priceHistory || [];
          });
          setPriceHistory(historyData);

          servicesData = servicesData.map(service => {
            const priceKey = service.serviceId || service.id;
            const priceData = pricesData[priceKey];
            return {
              ...service,
              currentPrice: priceData?.price || service.defaultPrice || 0,
              lastUpdated: priceData?.lastUpdated || null,
              updatedBy: priceData?.updatedBy || null,
            };
          });
        }

        // Remove duplicates by label
        const seenLabels = new Set();
        const uniqueServices = servicesData.filter(service => {
          const label = service.label;
          if (seenLabels.has(label)) return false;
          seenLabels.add(label);
          return true;
        });

        setServices(uniqueServices);
      } catch (error) {
        console.error('Error loading services:', error);
        showToast({ title: 'Error loading services', sub: error.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, []);

  // Update service price
  const updateServicePrice = async (serviceId, newPriceValue) => {
    if (!newPriceValue || newPriceValue <= 0) {
      showToast({ title: 'Invalid price', sub: 'Price must be greater than 0', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const user = auth.currentUser;
      const service = services.find(s => s.id === serviceId);
      const priceKey = service?.serviceId || serviceId;
      const priceRef = doc(db, 'billing_service_prices', priceKey);
      const currentDoc = await getDoc(priceRef);
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      const currentPrice = currentData.price || 0;
      const historyEntry = {
        price: Number(newPriceValue),
        changedFrom: currentPrice,
        changedAt: new Date().toISOString(),
        changedBy: user?.email || 'admin',
        changedByUid: user?.uid || 'system'
      };
      const existingHistory = currentData.priceHistory || [];
      const updatedHistory = [...existingHistory, historyEntry];
      await setDoc(priceRef, {
        price: Number(newPriceValue),
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'admin',
        updatedByUid: user?.uid || 'system',
        priceHistory: updatedHistory
      }, { merge: true });

      setServices(prev => prev.map(s => 
        s.id === serviceId
          ? { ...s, currentPrice: Number(newPriceValue), lastUpdated: new Date().toISOString(), updatedBy: user?.email || 'admin' }
          : s
      ));
      setPriceHistory(prev => ({ ...prev, [priceKey]: updatedHistory }));
      setEditingPrice(false);
      setSelectedService(null);
      showToast({ title: 'Price updated!', sub: `₱${currentPrice} → ₱${Number(newPriceValue)}`, type: 'ok' });
    } catch (error) {
      console.error('Error updating price:', error);
      showToast({ title: 'Update failed', sub: error.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Add new service
  const addService = async () => {
    if (!serviceForm.label.trim()) {
      showToast({ title: 'Missing fields', sub: 'Service name is required', type: 'error' });
      return;
    }
    if (serviceForm.defaultPrice <= 0) {
      showToast({ title: 'Invalid price', sub: 'Price must be greater than 0', type: 'error' });
      return;
    }
    const existingService = services.find(s => s.label.toLowerCase() === serviceForm.label.toLowerCase());
    if (existingService) {
      showToast({ title: 'Service already exists', sub: `"${serviceForm.label}" is already in the list`, type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const user = auth.currentUser;
      const serviceId = serviceForm.label
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      const serviceData = {
        ...serviceForm,
        id: serviceId,
        serviceId: serviceId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'system',
        createdByEmail: user?.email || 'system',
        isCustom: true,
      };
      const docRef = await addDoc(collection(db, 'billing_services'), serviceData);
      await setDoc(doc(db, 'billing_service_prices', serviceId), {
        price: Number(serviceForm.defaultPrice),
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'system',
        updatedByUid: user?.uid || 'system',
        priceHistory: [{
          price: Number(serviceForm.defaultPrice),
          changedFrom: 0,
          changedAt: new Date().toISOString(),
          changedBy: user?.email || 'system',
          changedByUid: user?.uid || 'system'
        }],
      });
      const newService = {
        id: docRef.id,
        ...serviceData,
        currentPrice: Number(serviceForm.defaultPrice),
        lastUpdated: new Date().toISOString(),
        updatedBy: user?.email || 'system',
      };
      setServices(prev => [...prev, newService]);
      setShowAddService(false);
      setServiceForm({
        id: '',
        label: '',
        defaultPrice: 0,
        unit: 'per head',
        category: 'Service',
        isCustom: true,
      });
      showToast({ title: 'Service added!', sub: `${serviceForm.label} - ₱${serviceForm.defaultPrice}`, type: 'ok' });
    } catch (error) {
      console.error('Error adding service:', error);
      showToast({ title: 'Failed to add service', sub: error.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Delete service
  const deleteService = async () => {
    if (!itemToDelete) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'billing_services', itemToDelete));
      const serviceToDelete = services.find(s => s.id === itemToDelete);
      if (serviceToDelete) {
        await deleteDoc(doc(db, 'billing_service_prices', serviceToDelete.serviceId || serviceToDelete.id));
      }
      setServices(prev => prev.filter(s => s.id !== itemToDelete));
      showToast({ title: 'Service deleted', sub: 'Service removed successfully', type: 'warn' });
      setItemToDelete(null);
      setConfirmOpen(false);
    } catch (error) {
      console.error('Error deleting service:', error);
      showToast({ title: 'Delete failed', sub: error.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="ab-page">
        <div className="ab-loading">
          <div className="ab-spinner"></div>
          <span>Loading services…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ab-page">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* ===== HEADER ===== */}
      <div className="ab-header">
        <div className="ab-header-left">
          <div className="ab-header-icon">
            <CreditCard size={28} />
          </div>
          <div>
            <h1>Service Price Management</h1>
            <p>Add, edit, or remove services and set their prices – automatically applies to Routine Services</p>
          </div>
        </div>
        <div className="ab-header-right">
          <button
            className="ab-btn primary"
            onClick={() => setShowAddService(true)}
          >
            <Plus size={16} /> Add Service
          </button>
        </div>
      </div>

      {/* ===== STATS ===== */}
      <div className="ab-stats">
        <div className="ab-stat-card">
          <div className="ab-stat-header">
            <span className="ab-stat-label">Total Services</span>
            <div className="ab-stat-icon blue">
              <Package size={20} />
            </div>
          </div>
          <div className="ab-stat-value">{services.length}</div>
        </div>
        <div className="ab-stat-card">
          <div className="ab-stat-header">
            <span className="ab-stat-label">Custom Services</span>
            <div className="ab-stat-icon green">
              <PlusCircle size={20} />
            </div>
          </div>
          <div className="ab-stat-value">{services.filter(s => s.isCustom).length}</div>
        </div>
        <div className="ab-stat-card">
          <div className="ab-stat-header">
            <span className="ab-stat-label">Updated Prices</span>
            <div className="ab-stat-icon yellow">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="ab-stat-value">{services.filter(s => s.lastUpdated).length}</div>
        </div>
      </div>

      {/* ===== SEARCH & TABLE ===== */}
      <div className="ab-table-section">
        <div className="ab-table-head">
          <div className="ab-table-title">Services</div>
          <div className="ab-table-controls">
            <div className="ab-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search services…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="ab-search-clear">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="ab-table-wrap">
          <table className="ab-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Default Price</th>
                <th>Current Price</th>
                <th>Last Updated</th>
                <th>Updated By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.id}>
                  <td className="ab-service-name">
                    {service.label}
                    {service.isCustom && <span className="ab-custom-badge">Custom</span>}
                  </td>
                  <td>{service.category || 'Service'}</td>
                  <td>{service.unit}</td>
                  <td className="ab-default-price">₱{service.defaultPrice}</td>
                  <td>
                    {selectedService === service.id && editingPrice ? (
                      <div className="ab-price-edit">
                        <span>₱</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={newPrice[service.id] || service.currentPrice}
                          onChange={(e) => setNewPrice(prev => ({
                            ...prev,
                            [service.id]: parseFloat(e.target.value) || 0
                          }))}
                          className="ab-price-input"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="ab-current-price">₱{service.currentPrice}</span>
                    )}
                  </td>
                  <td className="ab-last-updated">
                    {service.lastUpdated ? new Date(service.lastUpdated).toLocaleDateString() : '—'}
                  </td>
                  <td className="ab-updated-by">{service.updatedBy || '—'}</td>
                  <td>
                    {selectedService === service.id && editingPrice ? (
                      <div className="ab-action-cell">
                        <button
                          className="ab-btn-icon save"
                          onClick={() => updateServicePrice(service.id, newPrice[service.id] || service.currentPrice)}
                          disabled={busy}
                        >
                          <Save size={16} /> Save
                        </button>
                        <button
                          className="ab-btn-icon cancel"
                          onClick={() => {
                            setEditingPrice(false);
                            setSelectedService(null);
                          }}
                        >
                          <X size={16} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="ab-action-cell">
                        <button
                          className="ab-btn-icon edit"
                          onClick={() => {
                            setSelectedService(service.id);
                            setEditingPrice(true);
                            setNewPrice(prev => ({
                              ...prev,
                              [service.id]: service.currentPrice
                            }));
                          }}
                          disabled={busy}
                        >
                          <Edit size={16} /> Price
                        </button>
                        {service.isCustom && (
                          <button
                            className="ab-btn-icon delete"
                            onClick={() => {
                              setItemToDelete(service.id);
                              setConfirmOpen(true);
                            }}
                            disabled={busy}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {priceHistory[service.serviceId || service.id]?.length > 0 && (
                          <button
                            className="ab-btn-icon history"
                            onClick={() => {
                              setSelectedServiceHistory(service);
                              setShowPriceHistory(true);
                            }}
                          >
                            <Clock size={16} /> History
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan="8" className="ab-empty-row">
                    <div className="ab-empty-state">
                      <Search size={48} />
                      <p>No services found</p>
                      <span>Click "Add Service" to create a new one</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== ADD SERVICE MODAL ===== */}
      {showAddService && (
        <div className="ab-modal-overlay" onClick={() => setShowAddService(false)}>
          <div className="ab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ab-modal-head">
              <div className="ab-modal-title">Add New Service</div>
              <button className="ab-modal-close" onClick={() => setShowAddService(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ab-modal-body">
              <div className="ab-form-group">
                <label className="ab-form-label">
                  Service Name <span className="ab-required">*</span>
                </label>
                <input
                  type="text"
                  value={serviceForm.label}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, label: e.target.value }))}
                  className="ab-form-input"
                  placeholder="e.g., Rabies Vaccination"
                />
              </div>
              <div className="ab-form-row">
                <div className="ab-form-group">
                  <label className="ab-form-label">
                    Price <span className="ab-required">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={serviceForm.defaultPrice}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, defaultPrice: parseFloat(e.target.value) || 0 }))}
                    className="ab-form-input"
                    placeholder="0"
                  />
                </div>
                <div className="ab-form-group">
                  <label className="ab-form-label">Unit</label>
                  <select
                    value={serviceForm.unit}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="ab-form-select"
                  >
                    <option value="per head">per head</option>
                    <option value="per session">per session</option>
                    <option value="per animal">per animal</option>
                    <option value="per farm">per farm</option>
                    <option value="per service">per service</option>
                    <option value="per vial">per vial</option>
                    <option value="per bottle">per bottle</option>
                  </select>
                </div>
              </div>
              <div className="ab-form-group">
                <label className="ab-form-label">Category</label>
                <select
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, category: e.target.value }))}
                  className="ab-form-select"
                >
                  <option value="Vaccine">Vaccine</option>
                  <option value="Dewormer">Dewormer</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Supplement">Supplement</option>
                  <option value="Surgery">Surgery</option>
                  <option value="Service">Service</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="ab-modal-foot">
              <button className="ab-btn ghost" onClick={() => setShowAddService(false)} disabled={busy}>
                Cancel
              </button>
              <button className="ab-btn primary" onClick={addService} disabled={busy}>
                {busy ? 'Adding…' : 'Add Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PRICE HISTORY MODAL ===== */}
      {showPriceHistory && selectedServiceHistory && (
        <div className="ab-modal-overlay" onClick={() => setShowPriceHistory(false)}>
          <div className="ab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ab-modal-head">
              <div className="ab-modal-title">Price History</div>
              <button className="ab-modal-close" onClick={() => setShowPriceHistory(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ab-modal-body">
              <div className="ab-history-header">
                <div className="ab-history-name">{selectedServiceHistory.label}</div>
                <div className="ab-history-current">
                  Current Price: <span>₱{selectedServiceHistory.currentPrice}</span>
                </div>
              </div>
              <div className="ab-history-list">
                {priceHistory[selectedServiceHistory.serviceId || selectedServiceHistory.id]?.map((entry, index) => (
                  <div key={index} className="ab-history-item">
                    <div>
                      <div className="ab-history-change">
                        ₱{entry.changedFrom} → <span>₱{entry.price}</span>
                      </div>
                      <div className="ab-history-by">Changed by: {entry.changedBy}</div>
                    </div>
                    <div className="ab-history-date">
                      {new Date(entry.changedAt).toLocaleDateString()} {new Date(entry.changedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {(!priceHistory[selectedServiceHistory.serviceId || selectedServiceHistory.id] ||
                  priceHistory[selectedServiceHistory.serviceId || selectedServiceHistory.id].length === 0) && (
                  <div className="ab-history-empty">No price history available</div>
                )}
              </div>
            </div>
            <div className="ab-modal-foot">
              <button className="ab-btn ghost" onClick={() => setShowPriceHistory(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONFIRM DELETE ===== */}
      <ConfirmModal
        open={confirmOpen}
        title="Delete Service?"
        message="This will permanently remove this service and its price history. Are you sure?"
        onCancel={() => {
          setConfirmOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={deleteService}
      />
    </div>
  );
}