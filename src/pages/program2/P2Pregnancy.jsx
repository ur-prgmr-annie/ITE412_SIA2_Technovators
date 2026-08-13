import { useEffect, useMemo, useState } from "react";
import "../../styles/p2Module.css";
import { Plus, Search, Baby, X } from "lucide-react";

import { db } from "../../services/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

function badgeClass(result) {
  const s = String(result || "").toLowerCase();
  if (s === "pregnant") return "ok";
  if (s === "open") return "bad";
  return "neutral";
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="m2-modalWrap" role="dialog" aria-modal="true">
      <button className="m2-backdrop" onClick={onClose} aria-label="Close" />
      <div className="m2-modal">
        <div className="m2-modalHead">
          <div className="m2-modalTitle">{title}</div>
          <button
            className="m2-iconBtn"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="m2-modalBody">{children}</div>
      </div>
    </div>
  );
}

const INITIAL_FORM = {
  aiId: "",
  reportMonth: "",
  animalId: "",
  animalTagId: "",
  species: "",
  breed: "",
  color: "",
  sex: "",
  barangay: "",
  farmerName: "",
  aiDate: "",
  noOfStrawUsed: "",
  estrus: "",
  sireBreed: "",
  sireCode: "",
  technician: "",
  checkDate: "",
  result: "pregnant",
  outcome: "pending",
  notes: "",
};

export default function P2Pregnancy() {
  const [rows, setRows] = useState([]);
  const [aiRows, setAiRows] = useState([]);
  const [q, setQ] = useState("");
  const [result, setResult] = useState("all");
  const [open, setOpen] = useState(false);
  const [loadingChecks, setLoadingChecks] = useState(true);
  const [loadingAI, setLoadingAI] = useState(true);
  const [checksError, setChecksError] = useState("");
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    const qPregnancy = query(
      collection(db, "program2_pregnancy"),
      orderBy("checkDate", "desc")
    );

    const unsubPregnancy = onSnapshot(
      qPregnancy,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setRows(list);
        setChecksError("");
        setLoadingChecks(false);
      },
      (error) => {
        console.error("Error loading pregnancy checks:", error);
        setRows([]);
        setChecksError(error?.message || "Failed to load pregnancy checks.");
        setLoadingChecks(false);
      }
    );

    const qAI = query(collection(db, "program2_ai"), orderBy("aiDate", "desc"));
    const unsubAI = onSnapshot(
      qAI,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAiRows(list);
        setAiError("");
        setLoadingAI(false);
      },
      (error) => {
        console.error("Error loading AI records:", error);
        setAiRows([]);
        setAiError(error?.message || "Failed to load AI records.");
        setLoadingAI(false);
      }
    );

    return () => {
      unsubPregnancy();
      unsubAI();
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const rOk = result === "all" ? true : r.result === result;
      const hay =
        `${r.animalTagId || ""} ${r.barangay || ""} ${r.result || ""} ${r.outcome || ""} ${r.notes || ""} ${r.farmerName || ""} ${r.sireCode || ""} ${r.technician || ""}`.toLowerCase();
      const qOk = !q.trim() ? true : hay.includes(q.toLowerCase());
      return rOk && qOk;
    });
  }, [rows, q, result]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const preg = rows.filter((x) => x.result === "pregnant").length;
    const openCount = rows.filter((x) => x.result === "open").length;
    const calved = rows.filter(
      (x) => String(x.outcome).toLowerCase() === "calved"
    ).length;
    return { total, preg, open: openCount, calved };
  }, [rows]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const handleAISelect = (aiId) => {
    const selected = aiRows.find((r) => r.id === aiId);

    if (!selected) {
      resetForm();
      return;
    }

    setForm((prev) => ({
      ...prev,
      aiId: selected.id,
      reportMonth: selected.reportMonth || "",
      animalId: selected.animalId || "",
      animalTagId: selected.animalTagId || "",
      species: selected.species || "",
      breed: selected.breed || "",
      color: selected.color || "",
      sex: selected.sex || "",
      barangay: selected.barangay || "",
      farmerName: selected.farmerName || "",
      aiDate: selected.aiDate || "",
      noOfStrawUsed: selected.noOfStrawUsed || "",
      estrus: selected.estrus || "",
      sireBreed: selected.sireBreed || "",
      sireCode: selected.sireCode || "",
      technician: selected.technician || "",
      checkDate: prev.checkDate,
      result: prev.result,
      outcome: prev.outcome,
      notes: prev.notes,
    }));
  };

  const validateForm = () => {
    if (!form.aiId) return "Please select an AI record.";
    if (!form.checkDate) return "Check Date is required.";
    if (!form.result) return "Result is required.";
    if (!form.outcome) return "Outcome is required.";
    return "";
  };

  const add = async (e) => {
    e.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "program2_pregnancy"), {
        aiId: form.aiId,
        animalId: form.animalId,
        reportMonth: form.reportMonth,
        animalTagId: form.animalTagId,
        species: form.species,
        breed: form.breed,
        color: form.color,
        sex: form.sex,
        barangay: form.barangay,
        farmerName: form.farmerName,

        aiDate: form.aiDate,
        noOfStrawUsed: Number(form.noOfStrawUsed || 0),
        estrus: form.estrus,
        sireBreed: form.sireBreed,
        sireCode: form.sireCode,
        technician: form.technician,

        checkDate: form.checkDate,
        result: form.result,
        outcome: form.outcome,
        notes: form.notes.trim(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Error saving pregnancy check:", error);
      alert(error?.message || "Failed to save pregnancy check.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="m2">
      <div className="m2-head">
        <div>
          <div className="m2-h1">
            <Baby size={18} /> Pregnancy Diagnosis
          </div>
          <div className="m2-sub">
            Select an artificial insemination record, then encode pregnancy diagnosis and outcome.
          </div>
        </div>

        <button className="m2-btn" onClick={() => setOpen(true)} type="button">
          <Plus size={16} /> Add Check
        </button>
      </div>

      <div className="m2-kpis">
        <div className="m2-kpi">
          <div className="k-label">Total Checks</div>
          <div className="k-value">{kpi.total}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Pregnant</div>
          <div className="k-value">{kpi.preg}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Open</div>
          <div className="k-value">{kpi.open}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Calved</div>
          <div className="k-value">{kpi.calved}</div>
        </div>
      </div>

      <div className="m2-toolbar">
        <div className="m2-search">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search animal, barangay, outcome..."
          />
        </div>

        <select
          className="m2-select"
          value={result}
          onChange={(e) => setResult(e.target.value)}
        >
          <option value="all">All results</option>
          <option value="pregnant">Pregnant</option>
          <option value="open">Open / Not Pregnant</option>
        </select>
      </div>

      {checksError && (
        <div className="m2-card" style={{ marginBottom: 12 }}>
          <div className="m2-emptyRow">Pregnancy checks error: {checksError}</div>
        </div>
      )}

      {aiError && (
        <div className="m2-card" style={{ marginBottom: 12 }}>
          <div className="m2-emptyRow">AI records error: {aiError}</div>
        </div>
      )}

      <div className="m2-card">
        <div className="m2-cardHead">
          <div className="m2-cardTitle">Pregnancy Diagnosis Records</div>
          <div className="m2-cardHint">
            {loadingChecks ? "Loading..." : `${filtered.length} result(s)`}
          </div>
        </div>

        <div className="m2-tableWrap">
          <table className="m2-table">
            <thead>
              <tr>
                <th>Report Month</th>
                <th>Animal Tag</th>
                <th>Species</th>
                <th>Breed</th>
                <th>Color</th>
                <th>BRGY</th>
                <th>Farmer</th>
                <th>Check Date</th>
                <th>Result</th>
                <th>Outcome</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.reportMonth || "-"}</td>
                  <td>
                    <b>{r.animalTagId}</b>
                  </td>
                  <td>{r.species}</td>
                  <td>{r.breed}</td>
                  <td>{r.color}</td>
                  <td>{r.barangay}</td>
                  <td>{r.farmerName}</td>
                  <td>{r.checkDate}</td>
                  <td>
                    <span className={`m2-badge ${badgeClass(r.result)}`}>
                      {r.result === "open" ? "open" : "pregnant"}
                    </span>
                  </td>
                  <td>
                    <span className="m2-pill">
                      {String(r.outcome || "—").replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="m2-trunc">{r.notes || "—"}</td>
                </tr>
              ))}
              {!loadingChecks && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="m2-emptyRow">
                    No checks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title="Add Pregnancy Diagnosis Record"
        onClose={() => setOpen(false)}
      >
        <form className="m2-form" onSubmit={add}>
          <div className="m2-grid">
            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginBottom: 4 }}>
              Select Existing Artificial Insemination Record
            </div>

            <label className="m2-field" style={{ gridColumn: "1 / -1" }}>
              <span>AI Record</span>
              <select
                value={form.aiId}
                onChange={(e) => handleAISelect(e.target.value)}
                required
                disabled={loadingAI || !!aiError}
              >
                <option value="">Select record</option>
                {aiRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reportMonth || "-"} | {r.animalTagId} | {r.species} | {r.breed} | {r.barangay} | {r.farmerName} | {r.aiDate}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>
              Animal Identification
            </div>

            <label className="m2-field">
              <span>Report Month</span>
              <input value={form.reportMonth} readOnly />
            </label>

            <label className="m2-field">
              <span>Animal ID No.</span>
              <input value={form.animalTagId} readOnly />
            </label>

            <label className="m2-field">
              <span>Species</span>
              <input value={form.species} readOnly />
            </label>

            <label className="m2-field">
              <span>Breed</span>
              <input value={form.breed} readOnly />
            </label>

            <label className="m2-field">
              <span>Color</span>
              <input value={form.color} readOnly />
            </label>

            <label className="m2-field">
              <span>BRGY</span>
              <input value={form.barangay} readOnly />
            </label>

            <label className="m2-field" style={{ gridColumn: "1 / -1" }}>
              <span>Name of Farmer</span>
              <input value={form.farmerName} readOnly />
            </label>

            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>
              Artificial Insemination
            </div>

            <label className="m2-field">
              <span>Date</span>
              <input value={form.aiDate} readOnly />
            </label>

            <label className="m2-field">
              <span>No. of AI Straw Used</span>
              <input value={form.noOfStrawUsed} readOnly />
            </label>

            <label className="m2-field">
              <span>Estrus</span>
              <input value={form.estrus} readOnly />
            </label>

            <label className="m2-field">
              <span>Sire Breed</span>
              <input value={form.sireBreed} readOnly />
            </label>

            <label className="m2-field">
              <span>Sire Code</span>
              <input value={form.sireCode} readOnly />
            </label>

            <label className="m2-field">
              <span>Technician</span>
              <input value={form.technician} readOnly />
            </label>

            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>
              Pregnancy Diagnosis
            </div>

            <label className="m2-field">
              <span>Check Date</span>
              <input
                type="date"
                value={form.checkDate}
                onChange={(e) => setField("checkDate", e.target.value)}
                required
              />
            </label>

            <label className="m2-field">
              <span>Result</span>
              <select
                value={form.result}
                onChange={(e) => setField("result", e.target.value)}
              >
                <option value="pregnant">Pregnant</option>
                <option value="open">Open / Not Pregnant</option>
              </select>
            </label>

            <label className="m2-field">
              <span>Outcome</span>
              <select
                value={form.outcome}
                onChange={(e) => setField("outcome", e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="calved">Calved</option>
                <option value="repeat_breeder">Repeat breeder</option>
                <option value="aborted">Aborted</option>
              </select>
            </label>

            <label className="m2-field m2-span2">
              <span>Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>
          </div>

          <div className="m2-formActions">
            <button
              className="m2-btn ghost"
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="m2-btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Check"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}