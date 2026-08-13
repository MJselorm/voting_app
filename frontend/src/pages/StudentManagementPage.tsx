import { useState } from "react";
import { confirmStudentImport, listAdminStudents, previewStudentImport, type ImportPreview, type StudentProfile } from "../services/api";

export function StudentManagementPage() {
  const [preview, setPreview] = useState<ImportPreview | null>(null); const [students, setStudents] = useState<StudentProfile[]>([]);
  const [message, setMessage] = useState(""); const [mode, setMode] = useState<"update" | "skip">("update");
  const upload = async (file?: File) => { if (!file) return; try { setPreview(await previewStudentImport(file)); setMessage(""); } catch (e: any) { setMessage(e.detail || "Could not read upload."); } };
  const confirm = async () => { if (!preview) return; try { const result = await confirmStudentImport(preview.preview_id, mode); setMessage(`Import complete — Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}.`); setPreview(null); } catch (e: any) { setMessage(e.detail || "Import failed."); } };
  const search = async (value: string) => { try { setStudents(await listAdminStudents(value)); } catch (e: any) { setMessage(e.detail || "Could not load students."); } };
  return <div className="student-management-content"><p>Upload an official roster, review validation results, then confirm the import.</p>
    <section className="auth-card-container" style={{ maxWidth: 1100 }}><h2>Upload Students</h2><input type="file" accept=".csv,.xlsx" onChange={(e) => upload(e.target.files?.[0])} /> <a href="data:text/csv;charset=utf-8,Student ID,Full Name,Email,Department,Level,Class,Status%0ACSE2024001,John Mensah,john%40university.edu,Computer Science and Engineering,200,CSE-A,ACTIVE" download="student-import-template.csv">Download CSV template</a>
    {message && <p className="alert alert-info">{message}</p>}
    {preview && <><h2>Preview</h2><p>Total: {preview.total_rows} · Valid: {preview.valid_rows} · New: {preview.new_students} · Existing: {preview.existing_records} · Invalid: {preview.invalid_rows}</p>
      {preview.errors.length > 0 && <details><summary>Import errors ({preview.errors.length})</summary><ul>{preview.errors.map((e, i) => <li key={i}>Row {e.row}{e.student_id ? ` (${e.student_id})` : ""}: {e.reason}</li>)}</ul></details>}
      <table><thead><tr>{["Student ID", "Full Name", "Email", "Department", "Level", "Class", "Status", "Validation"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{preview.records.slice(0, 100).map((r, i) => <tr key={i}><td>{r.student_id}</td><td>{r.full_name}</td><td>{r.email}</td><td>{r.department}</td><td>{r.level}</td><td>{r.class}</td><td>{r.status}</td><td>{r.validation_status}</td></tr>)}</tbody></table>
      <p><label><input type="radio" checked={mode === "update"} onChange={() => setMode("update")} /> Update existing records</label> <label><input type="radio" checked={mode === "skip"} onChange={() => setMode("skip")} /> Skip existing records</label></p><button className="btn btn-primary" onClick={confirm}>Confirm Import</button></>}
    </section><section className="auth-card-container" style={{ maxWidth: 1100 }}><h2>Search Students</h2><input className="form-input" placeholder="Student ID, name, or email" onChange={(e) => search(e.target.value)} /><table><tbody>{students.map(s => <tr key={s.id}><td>{s.student_id}</td><td>{s.full_name}</td><td>{s.email}</td><td>{s.department}</td><td>{s.level}</td><td>{s.status}</td></tr>)}</tbody></table></section></div>;
}
