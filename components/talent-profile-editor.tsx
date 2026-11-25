"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Plus, Save, Sparkles, X } from "lucide-react"

export type SkillItem = {
  name: string
  level: number
  verified: boolean
}

export type WorkerProfile = {
  id: string
  full_name: string
  headline: string
  bio: string
  location: string
  hourly_rate: number
  availability_hours_per_week: number
  availability_status: "available" | "limited" | "unavailable"
  experience_years: number
  skills: SkillItem[]
  profile_completion: number
}

export function TalentProfileEditor({
  onBack,
  onSaved,
}: {
  onBack: () => void
  onSaved: (profile: WorkerProfile) => void
}) {
  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // New skill input state
  const [newSkillName, setNewSkillName] = useState("")
  const [newSkillLevel, setNewSkillLevel] = useState(85)

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile)
        else setError(data.error || "Could not load profile")
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false))
  }, [])

  function addSkill() {
    if (!profile || !newSkillName.trim()) return
    const exists = profile.skills.some(
      (s) => s.name.toLowerCase() === newSkillName.trim().toLowerCase()
    )
    if (exists) {
      setNewSkillName("")
      return
    }
    setProfile({
      ...profile,
      skills: [
        ...profile.skills,
        { name: newSkillName.trim(), level: newSkillLevel, verified: false },
      ],
    })
    setNewSkillName("")
    setNewSkillLevel(85)
  }

  function removeSkill(name: string) {
    if (!profile) return
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s.name !== name),
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not save profile")
      setProfile(data.profile)
      onSaved(data.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="section-content">
        <button className="back-link" onClick={onBack}>← Back to overview</button>
        <div className="panel">Loading your live talent profile from Supabase…</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="section-content">
        <button className="back-link" onClick={onBack}>← Back to overview</button>
        <div className="panel">{error || "Profile not found."}</div>
      </div>
    )
  }

  return (
    <div className="section-content">
      <button className="back-link" onClick={onBack}>← Back to overview</button>
      <div className="section-page-heading">
        <div className="section-overline"><Sparkles size={13} /> DYNAMIC VECTOR PROFILE · AUTO-REEMBED</div>
        <h1>Your talent profile</h1>
        <p>Saving changes updates Supabase and regenerates your 768-dim Gemini embedding so your match scores shift immediately.</p>
      </div>

      {error && <p className="ai-match-error" role="alert">{error}</p>}

      <form onSubmit={handleSave} className="panel" style={{ display: "grid", gap: "1.1rem", maxWidth: 740 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Full Name
            <input
              required
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Location
            <input
              value={profile.location || ""}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
          Professional Headline
          <input
            value={profile.headline || ""}
            onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
            style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
          Bio & Capabilities Summary (used for semantic vector matching)
          <textarea
            rows={3}
            value={profile.bio || ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            style={{ padding: "0.65rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.85rem" }}>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Hourly Rate ($/hr)
            <input
              type="number"
              min={5}
              value={profile.hourly_rate}
              onChange={(e) => setProfile({ ...profile, hourly_rate: Number(e.target.value) })}
              style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Availability (hrs/wk)
            <input
              type="number"
              min={1}
              max={60}
              value={profile.availability_hours_per_week}
              onChange={(e) => setProfile({ ...profile, availability_hours_per_week: Number(e.target.value) })}
              style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Experience (years)
            <input
              type="number"
              step="0.5"
              min={0}
              value={profile.experience_years}
              onChange={(e) => setProfile({ ...profile, experience_years: Number(e.target.value) })}
              style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Status
            <select
              value={profile.availability_status}
              onChange={(e) => setProfile({ ...profile, availability_status: e.target.value as WorkerProfile["availability_status"] })}
              style={{ padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", background: "#fff", fontWeight: 400 }}
            >
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
        </div>

        {/* Interactive Skills Manager */}
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Skills & Proficiency</span>
          <div className="skill-chips">
            {profile.skills.map((skill) => (
              <span key={skill.name} className={`skill-chip ${skill.verified ? "skill-highlight" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {skill.verified && <CheckCircle2 size={13} />}
                {skill.name}
                <span className="skill-level">{skill.level}%</span>
                <button
                  type="button"
                  aria-label={`Remove ${skill.name}`}
                  onClick={() => removeSkill(skill.name)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", opacity: 0.7 }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
            <input
              placeholder="Add a skill (e.g. Motion Graphics, Next.js, SQL)"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill() } }}
              style={{ flex: 1, minWidth: 220, padding: "0.55rem 0.8rem", borderRadius: 10, border: "1px solid #e4e2ec", fontSize: 13 }}
            />
            <input
              type="number"
              min={10}
              max={100}
              value={newSkillLevel}
              onChange={(e) => setNewSkillLevel(Number(e.target.value))}
              style={{ width: 72, padding: "0.55rem 0.6rem", borderRadius: 10, border: "1px solid #e4e2ec", fontSize: 13 }}
              title="Proficiency %"
            />
            <button type="button" className="apply-button" onClick={addSkill}>
              <Plus size={14} /> Add skill
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #efedf3" }}>
          <span style={{ fontSize: 12, color: "#6e6b7b" }}>
            Profile strength: <strong>{profile.profile_completion}/100</strong>
          </span>
          <button type="submit" className="primary-button" disabled={saving}>
            <Save size={15} /> {saving ? "Saving & re-embedding…" : "Save profile & update AI matches"}
          </button>
        </div>
      </form>
    </div>
  )
}