"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { TeamProfile } from "@/lib/types";

interface TeamProfileModalProps {
  profile: TeamProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: TeamProfile) => void;
}

export function TeamProfileModal({
  profile,
  isOpen,
  onClose,
  onSave,
}: TeamProfileModalProps) {
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [skills, setSkills] = useState<string[]>([...profile.coreSkills]);
  const [newSkill, setNewSkill] = useState("");
  const [industries, setIndustries] = useState<string[]>([...profile.industries]);
  const [newIndustry, setNewIndustry] = useState("");
  const [excluded, setExcluded] = useState<string[]>([...profile.excludedAreas]);
  const [newExcluded, setNewExcluded] = useState("");

  if (!isOpen) return null;

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleAddIndustry = (e: React.FormEvent) => {
    e.preventDefault();
    if (newIndustry.trim() && !industries.includes(newIndustry.trim())) {
      setIndustries([...industries, newIndustry.trim()]);
      setNewIndustry("");
    }
  };

  const handleRemoveIndustry = (ind: string) => {
    setIndustries(industries.filter((i) => i !== ind));
  };

  const handleAddExcluded = (e: React.FormEvent) => {
    e.preventDefault();
    if (newExcluded.trim() && !excluded.includes(newExcluded.trim())) {
      setExcluded([...excluded, newExcluded.trim()]);
      setNewExcluded("");
    }
  };

  const handleRemoveExcluded = (item: string) => {
    setExcluded(excluded.filter((e) => e !== item));
  };

  const handleSave = () => {
    onSave({
      ...profile,
      companyName,
      coreSkills: skills,
      industries,
      excludedAreas: excluded,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surface-border rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-subtle">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Team Skill & Competency Profile
            </h2>
            <p className="text-[11px] text-stone-500">
              Used by the AI engine to detect unfamiliar topics (&quot;NEW to team&quot;) in real time.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface text-stone-500 hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Company Name */}
          <div>
            <label className="font-semibold text-foreground block mb-1">Company / Team Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Core Skills */}
          <div>
            <label className="font-semibold text-foreground block mb-1">
              Core Skills & Tech Stack (Known to team)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-subtle border border-surface-border text-foreground text-[11px]"
                >
                  {s}
                  <button
                    onClick={() => handleRemoveSkill(s)}
                    className="text-stone-400 hover:text-red-500"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddSkill} className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add skill (e.g. Next.js, Python, AWS)..."
                className="flex-1 px-2.5 py-1 bg-surface-subtle border border-surface-border rounded text-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-surface-muted hover:bg-surface-border rounded font-medium text-foreground text-xs"
              >
                Add
              </button>
            </form>
          </div>

          {/* Industries Served */}
          <div>
            <label className="font-semibold text-foreground block mb-1">
              Industries Served
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {industries.map((ind) => (
                <span
                  key={ind}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-subtle border border-surface-border text-foreground text-[11px]"
                >
                  {ind}
                  <button
                    onClick={() => handleRemoveIndustry(ind)}
                    className="text-stone-400 hover:text-red-500"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddIndustry} className="flex gap-2">
              <input
                type="text"
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                placeholder="Add industry (e.g. FinTech, SaaS)..."
                className="flex-1 px-2.5 py-1 bg-surface-subtle border border-surface-border rounded text-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-surface-muted hover:bg-surface-border rounded font-medium text-foreground text-xs"
              >
                Add
              </button>
            </form>
          </div>

          {/* Excluded Areas */}
          <div>
            <label className="font-semibold text-foreground block mb-1">
              Out of Scope / Things We Do NOT Do
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {excluded.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-[11px]"
                >
                  {item}
                  <button
                    onClick={() => handleRemoveExcluded(item)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddExcluded} className="flex gap-2">
              <input
                type="text"
                value={newExcluded}
                onChange={(e) => setNewExcluded(e.target.value)}
                placeholder="Add excluded area (e.g. Firmware, COBOL)..."
                className="flex-1 px-2.5 py-1 bg-surface-subtle border border-surface-border rounded text-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-surface-muted hover:bg-surface-border rounded font-medium text-foreground text-xs"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-subtle flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-surface-border text-foreground hover:bg-surface font-medium text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 font-medium text-xs hover:opacity-90"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
