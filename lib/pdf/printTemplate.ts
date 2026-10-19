import { ExportOptions, MeetingWrapUp, TranscriptEntry } from "../types";
import { formatClockTime } from "../time";

export function containsUrdu(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export function buildPrintableHtml(
  wrapUp: MeetingWrapUp,
  options: ExportOptions,
  transcript: TranscriptEntry[],
  metadata: {
    clientName: string;
    projectName: string;
    dateStr: string;
    durationStr: string;
  },
  /** Roman Urdu translation per transcript entry id (shown when options.includeTranslation). */
  translations: Record<string, string> = {}
): string {
  const isInternal = options.audience === "internal";
  const showInternal = isInternal && options.includeInternalSections;

  const escapeHtml = (str: string = "") =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const renderTextWithRtl = (text: string) => {
    const hasUrdu = containsUrdu(text);
    const escaped = escapeHtml(text);
    if (hasUrdu) {
      return `<div class="urdu-text" dir="rtl">${escaped}</div>`;
    }
    return escaped;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meeting Report - ${escapeHtml(metadata.clientName)} - ${escapeHtml(metadata.dateStr)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    @page {
      size: A4 portrait;
      margin: 18mm 16mm 20mm 16mm;
      @bottom-right {
        content: counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #78716c;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1c1917;
      background: #ffffff;
      font-size: 9.5pt;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .urdu-text {
      font-family: 'Noto Naskh Arabic', serif !important;
      direction: rtl !important;
      text-align: right !important;
      line-height: 1.8 !important;
      font-size: 10.5pt;
    }

    .page-break-before {
      page-break-before: always;
      break-before: page;
    }

    .page-break-inside-avoid {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Cover Header Block */
    .header-block {
      border-bottom: 2px solid #292524;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .title {
      font-size: 18pt;
      font-weight: 700;
      color: #1c1917;
      letter-spacing: -0.02em;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 4px;
      border: 1px solid #d6d3d1;
      background: #fafaf9;
      color: #44403c;
    }

    .badge-internal {
      border-color: #b45309;
      background: #fef3c7;
      color: #92400e;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e7e5e4;
      font-size: 8.5pt;
    }

    .meta-item .meta-label {
      color: #78716c;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 2px;
    }

    .meta-item .meta-value {
      font-weight: 600;
      color: #1c1917;
    }

    /* Outcome Callout Box */
    .outcome-box {
      background: #fafaf9;
      border: 1.5px solid #292524;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 20px;
    }

    .outcome-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .outcome-label {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #78716c;
    }

    .outcome-status {
      font-size: 8pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      background: #292524;
      color: #fafaf9;
    }

    .outcome-statement {
      font-size: 10.5pt;
      font-weight: 500;
      color: #1c1917;
      line-height: 1.45;
      margin-bottom: 10px;
    }

    .next-step {
      font-size: 8.5pt;
      padding-top: 8px;
      border-top: 1px dashed #d6d3d1;
      color: #44403c;
    }

    .next-step strong {
      color: #1c1917;
    }

    /* Section Styling */
    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1c1917;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #e7e5e4;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }

    .prose-text {
      color: #292524;
      font-size: 9.5pt;
      line-height: 1.55;
    }

    /* Clean Key Points */
    .points-list {
      list-style: none;
    }

    .points-list li {
      margin-bottom: 6px;
      padding-left: 14px;
      position: relative;
    }

    .points-list li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #78716c;
      font-weight: bold;
    }

    /* Tasks Table */
    .tasks-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 8.5pt;
    }

    .tasks-table th {
      text-align: left;
      padding: 6px 8px;
      background: #f5f5f4;
      border-bottom: 1.5px solid #d6d3d1;
      font-weight: 600;
      color: #44403c;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .tasks-table td {
      padding: 8px 8px;
      border-bottom: 1px solid #e7e5e4;
      vertical-align: top;
    }

    .tag-pill {
      display: inline-block;
      font-size: 7pt;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      background: #eeece8;
      color: #44403c;
      white-space: nowrap;
    }

    .tag-client {
      background: #dbeafe;
      color: #1e40af;
    }

    .tag-suggested {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px dashed #d1d5db;
    }

    /* Appendix Transcript */
    .translation {
      margin-top: 2px;
      color: #57534e;
      font-style: italic;
      font-size: 8.5pt;
    }

    .transcript-entry {
      margin-bottom: 8px;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 8.5pt;
      background: #fafaf9;
      border: 1px solid #f5f5f4;
    }

    .ts-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      color: #78716c;
    }

    .speaker-client {
      font-weight: 700;
      color: #0369a1;
    }

    .speaker-team {
      font-weight: 700;
      color: #44403c;
    }

    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #a8a29e;
      border-top: 1px solid #f5f5f4;
      padding-top: 6px;
    }
  </style>
</head>
<body>

  <!-- Cover Header -->
  <div class="header-block">
    <div class="header-top">
      <div>
        <h1 class="title">${escapeHtml(metadata.projectName || "Client Discovery & Technical Scope")}</h1>
        <p style="color: #78716c; font-size: 9pt; margin-top: 2px;">Prepared by ${escapeHtml(options.companyName || "CallCopilot Services")}</p>
      </div>
      <div>
        <span class="badge ${isInternal ? "badge-internal" : ""}">
          ${isInternal ? "CONFIDENTIAL • INTERNAL TEAM" : "CLIENT-FACING REPORT"}
        </span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Client</div>
        <div class="meta-value">${escapeHtml(metadata.clientName || "Client Team")}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Date</div>
        <div class="meta-value">${escapeHtml(metadata.dateStr)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Duration</div>
        <div class="meta-value">${escapeHtml(metadata.durationStr)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Outcome Status</div>
        <div class="meta-value">${escapeHtml(wrapUp.outcome.status)}</div>
      </div>
    </div>
  </div>

  <!-- 1. Outcome Box -->
  ${
    options.includeOutcome
      ? `
  <div class="outcome-box page-break-inside-avoid">
    <div class="outcome-header">
      <span class="outcome-label">Meeting Outcome</span>
      <span class="outcome-status">${escapeHtml(wrapUp.outcome.status)}</span>
    </div>
    <div class="outcome-statement">
      ${renderTextWithRtl(wrapUp.outcome.statement)}
    </div>
    <div class="next-step">
      <strong>Agreed Next Step:</strong> ${renderTextWithRtl(wrapUp.outcome.nextStep)}
      ${wrapUp.outcome.nextStepDate ? ` <em>(${escapeHtml(wrapUp.outcome.nextStepDate)})</em>` : ""}
    </div>
  </div>
  `
      : ""
  }

  <!-- 2. Executive Summary & Discussion -->
  ${
    options.includeSummary
      ? `
  <div class="section page-break-inside-avoid">
    <h2 class="section-title">Executive Summary</h2>
    <div class="prose-text">${renderTextWithRtl(wrapUp.executiveSummary)}</div>

    ${
      wrapUp.keyDiscussionPoints.length > 0
        ? `
      <div style="margin-top: 12px;">
        <h3 style="font-size: 9pt; font-weight: 600; text-transform: uppercase; color: #78716c; margin-bottom: 6px;">Key Discussion Points</h3>
        <ul class="points-list">
          ${wrapUp.keyDiscussionPoints
            .map(
              (p) =>
                `<li><strong>${escapeHtml(p.topic)}:</strong> ${renderTextWithRtl(p.summary)}</li>`
            )
            .join("")}
        </ul>
      </div>
    `
        : ""
    }
  </div>
  `
      : ""
  }

  <!-- 3. Client Requirements -->
  ${
    options.includeRequirements
      ? `
  <div class="section page-break-inside-avoid">
    <h2 class="section-title">Client Requirements & Expectations</h2>
    ${
      wrapUp.clientRequirements.deliverables.length > 0
        ? `
      <ul class="points-list" style="margin-bottom: 8px;">
        ${wrapUp.clientRequirements.deliverables
          .map((d) => `<li>${renderTextWithRtl(d)}</li>`)
          .join("")}
      </ul>
    `
        : ""
    }
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 8.5pt; margin-top: 8px;">
      ${
        wrapUp.clientRequirements.budgetConstraints
          ? `<div><strong>Budget Constraints:</strong> ${escapeHtml(wrapUp.clientRequirements.budgetConstraints)}</div>`
          : ""
      }
      ${
        wrapUp.clientRequirements.timelineConstraints
          ? `<div><strong>Timeline Constraints:</strong> ${escapeHtml(wrapUp.clientRequirements.timelineConstraints)}</div>`
          : ""
      }
    </div>
  </div>
  `
      : ""
  }

  <!-- 4. Decisions & Open Questions -->
  ${
    options.includeDecisions
      ? `
  <div class="section page-break-inside-avoid">
    <h2 class="section-title">Decisions & Open Questions</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <h3 style="font-size: 8.5pt; font-weight: 600; text-transform: uppercase; color: #78716c; margin-bottom: 6px;">Decisions Agreed</h3>
        <ul class="points-list">
          ${
            wrapUp.decisions.length > 0
              ? wrapUp.decisions.map((d) => `<li>${renderTextWithRtl(d)}</li>`).join("")
              : "<li>None explicitly recorded</li>"
          }
        </ul>
      </div>
      <div>
        <h3 style="font-size: 8.5pt; font-weight: 600; text-transform: uppercase; color: #78716c; margin-bottom: 6px;">Open Questions</h3>
        <ul class="points-list">
          ${
            wrapUp.openQuestions.length > 0
              ? wrapUp.openQuestions.map((q) => `<li>${renderTextWithRtl(q)}</li>`).join("")
              : "<li>None</li>"
          }
        </ul>
      </div>
    </div>
  </div>
  `
      : ""
  }

  <!-- 5. Tasks and Action Items Table -->
  ${
    options.includeTasks && wrapUp.tasks.length > 0
      ? `
  <div class="section page-break-inside-avoid">
    <h2 class="section-title">Action Items & Deliverables</h2>
    <table class="tasks-table">
      <thead>
        <tr>
          <th style="width: 25px;"></th>
          <th>Action Item</th>
          <th style="width: 100px;">Owner</th>
          <th style="width: 90px;">Due Date</th>
          <th style="width: 70px;">Priority</th>
          <th style="width: 110px;">Classification</th>
        </tr>
      </thead>
      <tbody>
        ${wrapUp.tasks
          .map((t) => {
            const tagClass = t.isClientRequested
              ? "tag-client"
              : t.isSuggested
              ? "tag-suggested"
              : "";
            const tagText = t.isClientRequested
              ? "Requested by client"
              : t.isSuggested
              ? "Suggested"
              : "Action";
            return `
          <tr>
            <td style="text-align: center; font-size: 10pt;">${t.completed ? "&#9745;" : "&#9744;"}</td>
            <td>
              <strong>${escapeHtml(t.title)}</strong>
              ${t.details ? `<div style="color: #57534e; font-size: 8pt; margin-top: 2px;">${escapeHtml(t.details)}</div>` : ""}
              ${t.sourceQuote ? `<div style="color: #78716c; font-size: 7.5pt; font-style: italic; margin-top: 2px;">&ldquo;${escapeHtml(t.sourceQuote)}&rdquo;</div>` : ""}
            </td>
            <td>${escapeHtml(t.owner)}</td>
            <td>${escapeHtml(t.dueDate || "Suggested")}</td>
            <td style="text-transform: capitalize;">${escapeHtml(t.priority)}</td>
            <td><span class="tag-pill ${tagClass}">${tagText}</span></td>
          </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  </div>
  `
      : ""
  }

  <!-- 6. User Scratchpad Notes -->
  ${
    options.includeNotes && wrapUp.notes
      ? `
  <div class="section page-break-inside-avoid">
    <h2 class="section-title">Meeting Notes</h2>
    <div class="prose-text" style="white-space: pre-wrap;">${renderTextWithRtl(wrapUp.notes)}</div>
  </div>
  `
      : ""
  }

  <!-- 7. Internal Sections (ONLY IF AUDIENCE = INTERNAL) -->
  ${
    showInternal
      ? `
  <div class="section page-break-inside-avoid" style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 14px; margin-top: 14px;">
    <h2 class="section-title" style="color: #92400e; border-color: #fde68a;">Internal Strategy & Risk Assessment (Confidential)</h2>

    ${
      wrapUp.risksAndRedFlags.length > 0
        ? `
      <div style="margin-bottom: 12px;">
        <h3 style="font-size: 8.5pt; font-weight: 700; color: #b45309; text-transform: uppercase;">Risks & Red Flags</h3>
        <ul class="points-list">
          ${wrapUp.risksAndRedFlags
            .map(
              (r) =>
                `<li><strong>${escapeHtml(r.risk)}:</strong> Mitigation: ${escapeHtml(r.mitigation)}</li>`
            )
            .join("")}
        </ul>
      </div>
    `
        : ""
    }

    ${
      wrapUp.newToTeamResearch.length > 0
        ? `
      <div>
        <h3 style="font-size: 8.5pt; font-weight: 700; color: #b45309; text-transform: uppercase;">New To Our Team - Research Follow-up</h3>
        <ul class="points-list">
          ${wrapUp.newToTeamResearch
            .map(
              (item) =>
                `<li><strong>${escapeHtml(item.topic)}:</strong> ${escapeHtml(item.reason)}</li>`
            )
            .join("")}
        </ul>
      </div>
    `
        : ""
    }
  </div>
  `
      : ""
  }

  <!-- 8. Full Word-for-Word Transcript (Optional Appendix - starts on new page) -->
  ${
    options.includeFullTranscript && transcript.length > 0
      ? `
  <div class="page-break-before" style="margin-top: 20px;">
    <div style="border-bottom: 2px solid #292524; padding-bottom: 6px; margin-bottom: 14px;">
      <h2 style="font-size: 13pt; font-weight: 700; text-transform: uppercase;">Appendix: Word-for-Word Call Transcript</h2>
      <p style="font-size: 8pt; color: #78716c;">Complete record with speaker separation and chronological timestamps${options.includeTranslation ? " • Roman Urdu translation in italics" : ""}</p>
    </div>

    <div>
      ${transcript
        .map((entry) => {
          const time = formatClockTime(entry.timestamp);
          const isClient = entry.speaker === "client";
          return `
        <div class="transcript-entry">
          <div class="ts-header">
            <span>[${time}]</span>
            <span class="${isClient ? "speaker-client" : "speaker-team"}">
              ${isClient ? "CLIENT" : "OUR TEAM"}
            </span>
          </div>
          <div>${renderTextWithRtl(entry.text)}</div>
          ${
            options.includeTranslation && translations[entry.id]
              ? `<div class="translation">${escapeHtml(translations[entry.id])}</div>`
              : ""
          }
        </div>
        `;
        })
        .join("")}
    </div>
  </div>
  `
      : ""
  }

  <div class="footer">
    <span>CallCopilot Meeting Report</span>
    <span>${escapeHtml(metadata.dateStr)}</span>
  </div>

</body>
</html>`;
}
