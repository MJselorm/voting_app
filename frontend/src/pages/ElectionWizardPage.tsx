import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuthContext } from "../auth/AuthContext";
import {
  createElection,
  updateElection,
  getElection,
  getEligibleOfficials,
  estimateEligibility,
  submitElectionForApproval,
  type EligibilityCriteria,
  type PositionItem,
  type OfficialUser,
  type ResultVisibility,
} from "../services/api";

const STEPS = [
  { id: 1, label: "Basic Info", icon: "info" },
  { id: 2, label: "Schedule", icon: "calendar_month" },
  { id: 3, label: "Voter Eligibility", icon: "how_to_reg" },
  { id: 4, label: "Positions", icon: "badge" },
  { id: 5, label: "Officials", icon: "group" },
  { id: 6, label: "Visibility", icon: "visibility" },
  { id: 7, label: "Review & Submit", icon: "task_alt" },
];

const CSE_PRESET_POSITIONS: PositionItem[] = [
  { name: "President", description: "Executive head of CSE Department Association", display_order: 1, number_of_winners: 1 },
  { name: "Vice President", description: "Assists the President and oversees departmental committees", display_order: 2, number_of_winners: 1 },
  { name: "General Secretary", description: "Oversees correspondence and official documentation", display_order: 3, number_of_winners: 1 },
  { name: "Financial Secretary", description: "Manages association budgeting and accounts", display_order: 4, number_of_winners: 1 },
  { name: "Organising Secretary", description: "Coordinates events and logistics", display_order: 5, number_of_winners: 1 },
  { name: "Public Relations Officer (PRO)", description: "Manages communications and media", display_order: 6, number_of_winners: 1 },
];

export function ElectionWizardPage() {
  const { id: electionId } = useParams<{ id?: string }>();
  const isEditing = Boolean(electionId);
  const navigate = useNavigate();
  const { profile } = useAuthContext();
  const rolePrefix = profile?.role === "SUPER_ADMIN" ? "/admin" : "/official";

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("Computer Science and Engineering");
  const [electionType, setElectionType] = useState("Departmental Election");

  // Step 2: Schedule
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // Step 3: Eligibility
  const [eligibility, setEligibility] = useState<EligibilityCriteria>({
    departments: ["Computer Science and Engineering"],
    levels: ["100", "200", "300", "400"],
    classes: [],
    statuses: ["ACTIVE"],
  });
  const [estimatedVoters, setEstimatedVoters] = useState<number | null>(null);

  // Step 4: Positions
  const [positions, setPositions] = useState<PositionItem[]>([
    { name: "President", description: "", display_order: 1, number_of_winners: 1 },
    { name: "Vice President", description: "", display_order: 2, number_of_winners: 1 },
  ]);

  // Step 5: Officials
  const [availableOfficials, setAvailableOfficials] = useState<OfficialUser[]>([]);
  const [selectedOfficialIds, setSelectedOfficialIds] = useState<string[]>([]);

  // Step 6: Visibility
  const [resultVisibility, setResultVisibility] = useState<ResultVisibility>("HIDDEN_UNTIL_ENDED");

  // Load available officials & existing election if editing
  useEffect(() => {
    async function loadInitData() {
      try {
        const officials = await getEligibleOfficials();
        setAvailableOfficials(officials);

        if (electionId) {
          const e = await getElection(electionId);
          setName(e.name || "");
          setDescription(e.description || "");
          setDepartment(e.department || "Computer Science and Engineering");
          setElectionType(e.election_type || "Departmental Election");

          if (e.start_at) {
            setStartAt(new Date(e.start_at).toISOString().slice(0, 16));
          }
          if (e.end_at) {
            setEndAt(new Date(e.end_at).toISOString().slice(0, 16));
          }

          if (e.eligibility_criteria) {
            setEligibility({
              departments: e.eligibility_criteria.departments || ["Computer Science and Engineering"],
              levels: e.eligibility_criteria.levels || [],
              classes: e.eligibility_criteria.classes || [],
              statuses: e.eligibility_criteria.statuses || ["ACTIVE"],
            });
          }

          if (e.positions && e.positions.length > 0) {
            setPositions(e.positions);
          }

          if (e.official_assignments) {
            setSelectedOfficialIds(e.official_assignments.map((a) => a.user_id));
          }

          if (e.result_visibility) {
            setResultVisibility(e.result_visibility);
          }
        }
      } catch (err: any) {
        setErrorMsg(err?.detail || "Failed to load election information.");
      }
    }
    loadInitData();
  }, [electionId]);

  // Live estimate voter count when eligibility criteria change
  useEffect(() => {
    let active = true;
    async function fetchEstimate() {
      setIsEstimating(true);
      try {
        const res = await estimateEligibility(eligibility);
        if (active) {
          setEstimatedVoters(res.estimated_voters);
        }
      } catch (err) {
        if (active) setEstimatedVoters(null);
      } finally {
        if (active) setIsEstimating(false);
      }
    }
    fetchEstimate();
    return () => {
      active = false;
    };
  }, [eligibility]);

  const handleLevelToggle = (lvl: string) => {
    setEligibility((prev) => {
      const exists = prev.levels.includes(lvl);
      const newLevels = exists ? prev.levels.filter((l) => l !== lvl) : [...prev.levels, lvl];
      return { ...prev, levels: newLevels };
    });
  };

  const handleOfficialToggle = (uid: string) => {
    setSelectedOfficialIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // Position helpers
  const addPosition = () => {
    const nextOrder = positions.length + 1;
    setPositions((prev) => [
      ...prev,
      { name: `Position ${nextOrder}`, description: "", display_order: nextOrder, number_of_winners: 1 },
    ]);
  };

  const removePosition = (index: number) => {
    setPositions((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((p, idx) => ({ ...p, display_order: idx + 1 }));
    });
  };

  const movePosition = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === positions.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    setPositions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((p, idx) => ({ ...p, display_order: idx + 1 }));
    });
  };

  const updatePositionField = (index: number, field: keyof PositionItem, value: any) => {
    setPositions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const loadPresetPositions = () => {
    setPositions(CSE_PRESET_POSITIONS);
  };

  // Payload preparation
  const getPayload = () => {
    return {
      name,
      description: description || null,
      department,
      election_type: electionType,
      start_at: startAt ? new Date(startAt).toISOString() : null,
      end_at: endAt ? new Date(endAt).toISOString() : null,
      result_visibility: resultVisibility,
      eligibility_criteria: eligibility,
      positions: positions.map((p, idx) => ({
        name: p.name,
        description: p.description || null,
        display_order: idx + 1,
        number_of_winners: p.number_of_winners || 1,
      })),
      official_user_ids: selectedOfficialIds,
    };
  };

  // Save Draft (can save incomplete state at any time)
  const handleSaveDraft = async () => {
    if (!name.trim()) {
      setErrorMsg("Please provide an Election Name to save as draft.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setIsSaving(true);
    try {
      const payload = getPayload();
      let savedElection;
      if (electionId) {
        savedElection = await updateElection(electionId, payload);
      } else {
        savedElection = await createElection(payload);
      }
      setSuccessMsg("Election draft saved successfully!");
      if (!electionId) {
        navigate(`${rolePrefix}/elections/${savedElection.id}/edit`, { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err?.detail || "Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  };

  // Final Submit for Approval
  const handleSubmitForApproval = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setIsSaving(true);
    try {
      // 1. Ensure latest changes are saved first
      const payload = getPayload();
      let currentId = electionId;
      if (currentId) {
        await updateElection(currentId, payload);
      } else {
        const saved = await createElection(payload);
        currentId = saved.id;
      }

      // 2. Submit for approval
      await submitElectionForApproval(currentId!);
      navigate(`${rolePrefix}/elections/${currentId}`);
    } catch (err: any) {
      setErrorMsg(err?.detail || "Submission failed. Please check required fields.");
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !name.trim()) {
      setErrorMsg("Election Name is required.");
      return;
    }
    if (currentStep === 2 && startAt && endAt) {
      if (new Date(endAt) <= new Date(startAt)) {
        setErrorMsg("Election end time must be strictly after start time.");
        return;
      }
    }
    setErrorMsg("");
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const prevStep = () => {
    setErrorMsg("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
            <Link to={`${rolePrefix}/elections`} style={{ color: "#4f46e5", textDecoration: "none" }}>
              Elections
            </Link>
            <span>/</span>
            <span>{isEditing ? "Edit Election" : "New Election"}</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            {isEditing ? `Edit: ${name || "Draft Election"}` : "Create & Configure Election"}
          </h2>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>save</span>
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      {/* Wizard Progress Steps Indicator */}
      <div className="panel" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", alignItems: "center" }}>
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.35rem",
                  flex: 1,
                  padding: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isActive ? "#4f46e5" : isDone ? "#10b981" : "#f3f4f6",
                    color: isActive || isDone ? "#ffffff" : "#6b7280",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>
                    {isDone ? "check" : step.icon}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#4f46e5" : isDone ? "#10b981" : "#6b7280",
                    textAlign: "center",
                  }}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>
          {successMsg}
        </div>
      )}

      {/* Step Content Panels */}
      <div className="panel" style={{ padding: "1.75rem" }}>
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>Basic Election Details</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Define the primary name, scope, and description for this election.
            </p>

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Election Name <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Computer Science Departmental Executive Elections 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                  Department Scope
                </label>
                <select
                  className="form-input"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setEligibility((prev) => ({ ...prev, departments: [e.target.value] }));
                  }}
                  style={{ width: "100%" }}
                >
                  <option value="Computer Science and Engineering">Computer Science and Engineering</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="All University (Main SRC)">All University (Main SRC)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                  Election Type
                </label>
                <select
                  className="form-input"
                  value={electionType}
                  onChange={(e) => setElectionType(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="Departmental Election">Departmental Election</option>
                  <option value="Faculty Election">Faculty Election</option>
                  <option value="SRC General Election">SRC General Election</option>
                  <option value="Class Representative Election">Class Representative Election</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Description / Purpose
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Provide context, guidelines, and rules for this election..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}

        {/* Step 2: Schedule */}
        {currentStep === 2 && (
          <div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>Election Scheduling & Timeline</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Specify the exact start and end dates and times for active voting.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                  Voting Starts At
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                  Voting Ends At
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Visual Timeline Card */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9375rem", color: "#334155" }}>Timeline Preview</h4>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", color: "#475569", fontSize: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="material-symbols-outlined" style={{ color: "#10b981" }}>play_circle</span>
                  <span><strong>Start:</strong> {startAt ? new Date(startAt).toLocaleString() : "Not set"}</span>
                </div>
                <span>➔</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="material-symbols-outlined" style={{ color: "#dc2626" }}>stop_circle</span>
                  <span><strong>End:</strong> {endAt ? new Date(endAt).toLocaleString() : "Not set"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Voter Eligibility */}
        {currentStep === 3 && (
          <div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>Voter Eligibility Criteria</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Rules are evaluated dynamically against the student database without duplicating records.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
              <div>
                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.5rem", display: "block" }}>
                    Eligible Academic Levels
                  </label>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {["100", "200", "300", "400", "Postgraduate"].map((lvl) => {
                      const isSelected = eligibility.levels.includes(lvl);
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => handleLevelToggle(lvl)}
                          className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
                          style={{ borderRadius: "2rem", padding: "0.4rem 1rem" }}
                        >
                          Level {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.5rem", display: "block" }}>
                    Student Status Requirement
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                    <input
                      type="checkbox"
                      checked={eligibility.statuses.includes("ACTIVE")}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEligibility((prev) => ({
                          ...prev,
                          statuses: checked ? ["ACTIVE"] : [],
                        }));
                      }}
                    />
                    Must have ACTIVE student enrollment status
                  </label>
                </div>
              </div>

              {/* Live Estimate Card with Skeleton Loader */}
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", color: "#16a34a", marginBottom: "0.25rem" }}>
                  analytics
                </span>
                <span style={{ fontSize: "0.8125rem", color: "#166534", fontWeight: 600, textTransform: "uppercase" }}>
                  Live Eligible Voters
                </span>
                {isEstimating ? (
                  <div style={{ height: "40px", width: "80px", background: "#dcfce7", borderRadius: "4px", margin: "0.5rem 0", animation: "pulse 1.5s infinite" }} />
                ) : (
                  <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#15803d", margin: "0.25rem 0" }}>
                    {estimatedVoters !== null ? estimatedVoters : "—"}
                  </div>
                )}
                <span style={{ fontSize: "0.75rem", color: "#4ade80" }}>
                  Calculated against current database
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Positions Manager */}
        {currentStep === 4 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.25rem" }}>Election Positions</h3>
                <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
                  Configure positions on the ballot, display order, and allowed winners.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={loadPresetPositions}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>auto_awesome</span>
                  Load CSE Presets
                </button>
                <button
                  type="button"
                  onClick={addPosition}
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>add</span>
                  Add Position
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {positions.map((pos, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => movePosition(idx, "up")}
                      style={{ border: "none", background: "transparent", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#d1d5db" : "#4b5563" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      disabled={idx === positions.length - 1}
                      onClick={() => movePosition(idx, "down")}
                      style={{ border: "none", background: "transparent", cursor: idx === positions.length - 1 ? "default" : "pointer", color: idx === positions.length - 1 ? "#d1d5db" : "#4b5563" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>arrow_downward</span>
                    </button>
                  </div>

                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e0e7ff", color: "#3730a3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.875rem" }}>
                    {idx + 1}
                  </div>

                  <div style={{ flex: "2" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Position Title (e.g. President)"
                      value={pos.name}
                      onChange={(e) => updatePositionField(idx, "name", e.target.value)}
                      style={{ width: "100%", margin: 0 }}
                    />
                  </div>

                  <div style={{ flex: "2" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Short description (optional)"
                      value={pos.description || ""}
                      onChange={(e) => updatePositionField(idx, "description", e.target.value)}
                      style={{ width: "100%", margin: 0 }}
                    />
                  </div>

                  <div style={{ width: "110px" }}>
                    <label style={{ fontSize: "0.6875rem", color: "#6b7280", display: "block", marginBottom: "0.15rem" }}>Winners</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="form-input"
                      value={pos.number_of_winners}
                      onChange={(e) => updatePositionField(idx, "number_of_winners", parseInt(e.target.value, 10) || 1)}
                      style={{ width: "100%", margin: 0 }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removePosition(idx)}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", padding: "0.5rem" }}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Election Officials */}
        {currentStep === 5 && (
          <div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>Assign Election Officials</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Assigned officials are required to review and approve the election configuration before final approval.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {availableOfficials.map((off) => {
                const isSelected = selectedOfficialIds.includes(off.id);
                return (
                  <div
                    key={off.id}
                    onClick={() => handleOfficialToggle(off.id)}
                    style={{
                      border: isSelected ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                      backgroundColor: isSelected ? "#eef2ff" : "#ffffff",
                      borderRadius: "8px",
                      padding: "1rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>
                        {off.full_name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{off.email}</div>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "0.25rem",
                          fontSize: "0.6875rem",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          backgroundColor: off.role === "SUPER_ADMIN" ? "#ede9fe" : "#e0e7ff",
                          color: off.role === "SUPER_ADMIN" ? "#5b21b6" : "#3730a3",
                          fontWeight: 600,
                        }}
                      >
                        {off.role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 6: Result Visibility */}
        {currentStep === 6 && (
          <div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>Result Visibility Settings</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Control when and how ballot counts and election outcomes are disclosed.
            </p>

            <div style={{ display: "grid", gap: "1rem" }}>
              {[
                {
                  id: "HIDDEN_UNTIL_ENDED",
                  title: "Hidden Until Election Concludes (Standard)",
                  desc: "Votes remain sealed and hidden from everyone until the election officially ends. Recommended for fair departmental elections.",
                  icon: "visibility_off",
                },
                {
                  id: "OFFICIALS_DURING_VOTING",
                  title: "Officials Only During Voting",
                  desc: "Assigned Election Officials and Super Admins can monitor real-time vote totals while public voters see results only after election concludes.",
                  icon: "admin_panel_settings",
                },
                {
                  id: "PUBLIC_LIVE",
                  title: "Public Real-Time Live Results",
                  desc: "Live tally is visible to all students and voters throughout the active voting period.",
                  icon: "public",
                },
              ].map((card) => {
                const isSelected = resultVisibility === card.id;
                return (
                  <div
                    key={card.id}
                    onClick={() => setResultVisibility(card.id as ResultVisibility)}
                    style={{
                      border: isSelected ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                      backgroundColor: isSelected ? "#eef2ff" : "#ffffff",
                      borderRadius: "8px",
                      padding: "1.25rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ marginTop: "0.25rem", cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "1rem", color: "#111827" }}>
                        <span className="material-symbols-outlined" style={{ color: "#4f46e5" }}>{card.icon}</span>
                        {card.title}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#4b5563", marginTop: "0.25rem", lineHeight: 1.4 }}>
                        {card.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 7: Review & Submit */}
        {currentStep === 7 && (
          <div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>Review & Final Submission</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Please review all configuration details before submitting for multi-stage official review.
            </p>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>1. Election Summary</h4>
                <div style={{ fontSize: "0.875rem", color: "#475569", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div><strong>Name:</strong> {name || "Not set"}</div>
                  <div><strong>Department:</strong> {department}</div>
                  <div><strong>Type:</strong> {electionType}</div>
                  <div><strong>Visibility:</strong> {resultVisibility}</div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>2. Schedule & Eligibility</h4>
                <div style={{ fontSize: "0.875rem", color: "#475569", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div><strong>Start:</strong> {startAt ? new Date(startAt).toLocaleString() : "Not set"}</div>
                  <div><strong>End:</strong> {endAt ? new Date(endAt).toLocaleString() : "Not set"}</div>
                  <div><strong>Eligible Levels:</strong> {eligibility.levels.join(", ") || "None selected"}</div>
                  <div><strong>Estimated Voters:</strong> {estimatedVoters !== null ? estimatedVoters : "—"}</div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>3. Positions ({positions.length})</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {positions.map((p, i) => (
                    <span key={i} style={{ background: "#e0e7ff", color: "#3730a3", padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
                      {i + 1}. {p.name} ({p.number_of_winners} winner)
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>4. Assigned Reviewing Officials ({selectedOfficialIds.length})</h4>
                <div style={{ fontSize: "0.875rem", color: "#475569" }}>
                  {selectedOfficialIds.length === 0 ? (
                    <span style={{ color: "#dc2626" }}>No officials selected. At least one official is required before approval.</span>
                  ) : (
                    <span>{selectedOfficialIds.length} Election Official(s) will be notified to review and approve.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Navigation Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="btn btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_back</span>
                Previous
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="btn btn-secondary"
            >
              Save Draft
            </button>

            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                Next Step
                <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#10b981", borderColor: "#10b981" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>send</span>
                {isSaving ? "Submitting..." : "Submit for Approval"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
