import { ExportOptions, MeetingWrapUp, TranscriptEntry } from "./types";
import { formatClockTime } from "./time";

export function generateMarkdownReport(
  wrapUp: MeetingWrapUp,
  options: ExportOptions,
  transcript: TranscriptEntry[],
  metadata: {
    clientName: string;
    projectName: string;
    dateStr: string;
    durationStr: string;
  }
): string {
  const parts: string[] = [];

  // Title & Metadata
  parts.push(`# Meeting Report: ${metadata.projectName || "Client Discovery"}`);
  parts.push(`**Client:** ${metadata.clientName || "Client"}`);
  parts.push(`**Date:** ${metadata.dateStr} | **Duration:** ${metadata.durationStr}`);
  parts.push(`**Prepared by:** ${options.companyName}`);
  parts.push(`**Audience:** ${options.audience === "client" ? "Client-Facing" : "Internal Team"}`);
  parts.push("\n---\n");

  // 1. Outcome
  if (options.includeOutcome) {
    parts.push(`## Meeting Outcome (${wrapUp.outcome.status})`);
    parts.push(`> ${wrapUp.outcome.statement}\n`);
    parts.push(`**Agreed Next Step:** ${wrapUp.outcome.nextStep}`);
    if (wrapUp.outcome.nextStepDate) {
      parts.push(` (${wrapUp.outcome.nextStepDate})`);
    }
    parts.push("\n");
  }

  // 2. Summary & Discussion
  if (options.includeSummary) {
    parts.push("## Executive Summary");
    parts.push(wrapUp.executiveSummary);
    parts.push("\n");

    if (wrapUp.keyDiscussionPoints.length > 0) {
      parts.push("### Key Discussion Points");
      for (const pt of wrapUp.keyDiscussionPoints) {
        parts.push(`- **${pt.topic}:** ${pt.summary}`);
      }
      parts.push("\n");
    }
  }

  // 3. Client Requirements
  if (options.includeRequirements) {
    parts.push("## Client Requirements & Scope");
    if (wrapUp.clientRequirements.deliverables.length > 0) {
      parts.push("### Requested Deliverables");
      for (const d of wrapUp.clientRequirements.deliverables) {
        parts.push(`- ${d}`);
      }
    }
    if (wrapUp.clientRequirements.budgetConstraints) {
      parts.push(`- **Budget Constraints:** ${wrapUp.clientRequirements.budgetConstraints}`);
    }
    if (wrapUp.clientRequirements.timelineConstraints) {
      parts.push(`- **Timeline Constraints:** ${wrapUp.clientRequirements.timelineConstraints}`);
    }
    if (wrapUp.clientRequirements.technicalPreferences.length > 0) {
      parts.push(`- **Technical Preferences:** ${wrapUp.clientRequirements.technicalPreferences.join(", ")}`);
    }
    parts.push("\n");
  }

  // 4. Decisions & Open Questions
  if (options.includeDecisions) {
    parts.push("## Decisions & Open Questions");
    if (wrapUp.decisions.length > 0) {
      parts.push("### Agreed Decisions");
      for (const d of wrapUp.decisions) {
        parts.push(`- [x] ${d}`);
      }
    }
    if (wrapUp.openQuestions.length > 0) {
      parts.push("### Open Questions / Pending Clarifications");
      for (const q of wrapUp.openQuestions) {
        parts.push(`- [ ] ${q}`);
      }
    }
    parts.push("\n");
  }

  // 5. Tasks and Action Items
  if (options.includeTasks && wrapUp.tasks.length > 0) {
    parts.push("## Tasks & Action Items");
    parts.push("| Task | Owner | Due Date | Priority | Tag | Justification |");
    parts.push("|---|---|---|---|---|---|");
    for (const t of wrapUp.tasks) {
      const tag = t.isClientRequested
        ? "Requested by client"
        : t.isSuggested
        ? "Suggested"
        : "Standard";
      const due = t.dueDate || "TBD";
      const quote = t.sourceQuote ? `"${t.sourceQuote}"` : "-";
      parts.push(`| ${t.completed ? "[x]" : "[ ]"} ${t.title} | ${t.owner} | ${due} | ${t.priority} | ${tag} | ${quote} |`);
    }
    parts.push("\n");
  }

  // 6. User Notes
  if (options.includeNotes && wrapUp.notes) {
    parts.push("## Meeting Notes");
    parts.push(wrapUp.notes);
    parts.push("\n");
  }

  // 7. Internal Sections (ONLY if internal audience AND checked)
  if (options.audience === "internal" && options.includeInternalSections) {
    parts.push("## Internal Strategy & Risk Analysis (CONFIDENTIAL)");

    if (wrapUp.risksAndRedFlags.length > 0) {
      parts.push("### Risks & Red Flags");
      for (const r of wrapUp.risksAndRedFlags) {
        parts.push(`- **Risk:** ${r.risk}\n  **Mitigation:** ${r.mitigation}`);
      }
    }

    if (wrapUp.newToTeamResearch.length > 0) {
      parts.push("### New To Team - Research Items");
      for (const item of wrapUp.newToTeamResearch) {
        parts.push(`- **${item.topic}:** ${item.reason}`);
        if (item.sources?.length) {
          parts.push(`  Sources: ${item.sources.map((s) => `[${s.title}](${s.url})`).join(", ")}`);
        }
      }
    }
    parts.push("\n");
  }

  // 8. Transcript Appendix (Only if explicitly checked)
  if (options.includeFullTranscript && transcript.length > 0) {
    parts.push("## Appendix: Complete Word-for-Word Transcript");
    parts.push("\n---\n");
    for (const entry of transcript) {
      const timeStr = formatClockTime(entry.timestamp);
      const speakerLabel = entry.speaker === "client" ? "Client" : "Our Team";
      parts.push(`**[${timeStr}] ${speakerLabel}:** ${entry.text}\n`);
    }
  }

  return parts.join("\n");
}

export function generatePlainTranscriptText(transcript: TranscriptEntry[]): string {
  return transcript
    .map((e) => {
      const time = formatClockTime(e.timestamp);
      const speaker = e.speaker === "client" ? "CLIENT" : "OUR TEAM";
      return `[${time}] ${speaker}:\n${e.text}\n`;
    })
    .join("\n");
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
