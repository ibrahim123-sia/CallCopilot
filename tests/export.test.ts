import { describe, it, expect } from "vitest";
import {
  generateMarkdownReport,
  generatePlainTranscriptText,
} from "@/lib/export";
import { buildPrintableHtml, containsUrdu } from "@/lib/pdf/printTemplate";
import { CANNED_DEMO_WRAPUP } from "@/lib/analysis/cannedData";
import { ExportOptions, TranscriptEntry } from "@/lib/types";

describe("Export & PDF Formatting Tests", () => {
  const sampleTranscript: TranscriptEntry[] = [
    {
      id: "1",
      speaker: "team",
      text: "Welcome to CallCopilot.",
      timestamp: 1700000000000,
      isFinal: true,
      channel: 0,
    },
    {
      id: "2",
      speaker: "client",
      text: "بہت شکریہ! We want to integrate an MCP server.",
      timestamp: 1700000015000,
      isFinal: true,
      channel: 1,
    },
  ];

  const metadata = {
    clientName: "Alex Rivers",
    projectName: "CRM MCP Pilot",
    dateStr: "2026-10-13",
    durationStr: "15m 30s",
  };

  it("audience switch: Client-Facing mode NEVER leaks internal risks or new-to-us research", () => {
    const clientOptions: ExportOptions = {
      audience: "client",
      includeOutcome: true,
      includeSummary: true,
      includeRequirements: true,
      includeDecisions: true,
      includeTasks: true,
      includeNotes: true,
      includeInternalSections: false, // suppressed in client mode
      includeFullTranscript: false,
      companyName: "CallCopilot Team",
    };

    // Test Markdown output
    const md = generateMarkdownReport(
      CANNED_DEMO_WRAPUP,
      clientOptions,
      sampleTranscript,
      metadata
    );

    expect(md).toContain("Client-Facing");
    expect(md).not.toContain("Internal Strategy & Risk Analysis (CONFIDENTIAL)");
    expect(md).not.toContain("Legacy 12-year-old CRM schema with unindexed custom fields");
    expect(md).not.toContain("New To Team - Research Items");

    // Test HTML print template
    const html = buildPrintableHtml(
      CANNED_DEMO_WRAPUP,
      clientOptions,
      sampleTranscript,
      metadata
    );

    expect(html).toContain("CLIENT-FACING REPORT");
    expect(html).not.toContain("Internal Strategy &amp; Risk Assessment (Confidential)");
    expect(html).not.toContain("Legacy 12-year-old CRM schema with unindexed custom fields");
  });

  it("audience switch: Internal Team mode includes confidential sections when enabled", () => {
    const internalOptions: ExportOptions = {
      audience: "internal",
      includeOutcome: true,
      includeSummary: true,
      includeRequirements: true,
      includeDecisions: true,
      includeTasks: true,
      includeNotes: true,
      includeInternalSections: true,
      includeFullTranscript: false,
      companyName: "CallCopilot Team",
    };

    const md = generateMarkdownReport(
      CANNED_DEMO_WRAPUP,
      internalOptions,
      sampleTranscript,
      metadata
    );

    expect(md).toContain("Internal Team");
    expect(md).toContain("Internal Strategy & Risk Analysis (CONFIDENTIAL)");
    expect(md).toContain("Legacy 12-year-old CRM schema with unindexed custom fields");

    const html = buildPrintableHtml(
      CANNED_DEMO_WRAPUP,
      internalOptions,
      sampleTranscript,
      metadata
    );

    expect(html).toContain("CONFIDENTIAL • INTERNAL TEAM");
    expect(html).toContain("Internal Strategy & Risk Assessment (Confidential)");
    expect(html).toContain("Legacy 12-year-old CRM schema with unindexed custom fields");
  });

  it("transcript option logic: Word-for-word transcript is completely excluded unless checked", () => {
    const withoutTranscript: ExportOptions = {
      audience: "client",
      includeOutcome: true,
      includeSummary: true,
      includeRequirements: true,
      includeDecisions: true,
      includeTasks: true,
      includeNotes: false,
      includeInternalSections: false,
      includeFullTranscript: false, // Default: unchecked
      companyName: "CallCopilot Team",
    };

    const mdOff = generateMarkdownReport(
      CANNED_DEMO_WRAPUP,
      withoutTranscript,
      sampleTranscript,
      metadata
    );
    expect(mdOff).not.toContain("Appendix: Complete Word-for-Word Transcript");
    expect(mdOff).not.toContain("Welcome to CallCopilot.");

    const htmlOff = buildPrintableHtml(
      CANNED_DEMO_WRAPUP,
      withoutTranscript,
      sampleTranscript,
      metadata
    );
    expect(htmlOff).not.toContain("Appendix: Word-for-Word Call Transcript");

    // Turn transcript ON
    const withTranscript: ExportOptions = {
      ...withoutTranscript,
      includeFullTranscript: true,
    };

    const mdOn = generateMarkdownReport(
      CANNED_DEMO_WRAPUP,
      withTranscript,
      sampleTranscript,
      metadata
    );
    expect(mdOn).toContain("Appendix: Complete Word-for-Word Transcript");
    expect(mdOn).toContain("Welcome to CallCopilot.");

    const htmlOn = buildPrintableHtml(
      CANNED_DEMO_WRAPUP,
      withTranscript,
      sampleTranscript,
      metadata
    );
    expect(htmlOn).toContain("Appendix: Word-for-Word Call Transcript");
    expect(htmlOn).toContain("Welcome to CallCopilot.");
    expect(htmlOn).toContain("page-break-before");
  });

  it("correctly identifies Urdu script and applies RTL styling with Noto Naskh Arabic font", () => {
    const urduText = "بہت شکریہ! That sounds like a solid plan.";
    const englishText = "We look forward to meeting Sarah next Tuesday.";

    expect(containsUrdu(urduText)).toBe(true);
    expect(containsUrdu(englishText)).toBe(false);

    const transcriptWithUrdu: TranscriptEntry[] = [
      {
        id: "ur-1",
        speaker: "client",
        text: urduText,
        timestamp: Date.now(),
        isFinal: true,
        channel: 1,
      },
    ];

    const html = buildPrintableHtml(
      CANNED_DEMO_WRAPUP,
      {
        audience: "client",
        includeOutcome: true,
        includeSummary: true,
        includeRequirements: false,
        includeDecisions: false,
        includeTasks: false,
        includeNotes: false,
        includeInternalSections: false,
        includeFullTranscript: true,
        companyName: "Services Agency",
      },
      transcriptWithUrdu,
      metadata
    );

    // Verify Urdu text is enclosed with dir="rtl" and urdu-text class for letter shaping
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('class="urdu-text"');
    expect(html).toContain("Noto Naskh Arabic");
  });

  it("properly formats plain text transcript for download", () => {
    const txt = generatePlainTranscriptText(sampleTranscript);
    expect(txt).toContain("OUR TEAM:\nWelcome to CallCopilot.");
    expect(txt).toContain("CLIENT:\nبہت شکریہ! We want to integrate an MCP server.");
  });
});
