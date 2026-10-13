import { AnalysisResult, MeetingWrapUp, TopicCard } from "../types";

export const CANNED_DEMO_TOPICS: TopicCard[] = [
  {
    id: "topic-mcp-1",
    title: "Model Context Protocol (MCP)",
    type: "technology",
    isNewToTeam: true, // NEW to team!
    whyItMatters: "Emerging open standard from Anthropic for connecting AI models to CRM/data tools safely.",
    explanation:
      "MCP is an open standard client/server protocol that lets LLMs query live company tools and databases via standardized JSON-RPC rather than custom brittle plugins. It replaces custom API wrappers with reusable tool servers.",
    pros: [
      "Standardized security boundaries",
      "Broadly adopted by modern AI toolchains",
      "Reusable across multiple model providers",
    ],
    cons: [
      "Requires hosting dedicated stateful/SSE servers",
      "New ecosystem with evolving authentication standards",
    ],
    sources: [
      {
        title: "Anthropic Model Context Protocol Specs",
        url: "https://modelcontextprotocol.io",
      },
      {
        title: "GitHub: modelcontextprotocol/servers",
        url: "https://github.com/modelcontextprotocol",
      },
    ],
    confidence: "high",
    timestamp: Date.now() - 60000,
  },
  {
    id: "topic-vector-2",
    title: "Vector Search & Hybrid Retrieval",
    type: "approach",
    isNewToTeam: false, // Team knows vector search
    whyItMatters: "Client wants semantic lookup over unstructured customer notes in their CRM.",
    explanation:
      "Converts text into mathematical embeddings to find semantically similar documents even when exact keywords don't match. Combining this with full-text search (BM25) provides high-accuracy CRM search.",
    pros: [
      "Finds relevant context without exact keyword matches",
      "Works across multiple languages",
    ],
    cons: [
      "Embedding generation and vector DB indexing latency",
      "Requires periodic index re-computation",
    ],
    sources: [
      {
        title: "Pinecone / Qdrant Hybrid Search Guide",
        url: "https://qdrant.tech/articles/hybrid-search",
      },
    ],
    confidence: "high",
    timestamp: Date.now() - 30000,
  },
];

export const CANNED_DEMO_ANALYSIS: AnalysisResult = {
  topics: CANNED_DEMO_TOPICS,
  clientIntent:
    "Client wants to augment their legacy Salesforce CRM with an AI assistant via an MCP server and vector search, but is under strict budget and 6-week launch pressure.",
  signals: [
    {
      type: "budget",
      quote: "We don't have infinite budget—cap is around $25k for the pilot.",
      note: "Explicit hard budget ceiling stated for phase 1.",
    },
    {
      type: "timeline",
      quote: "We need this live before the Q4 sales kickoff in 6 weeks.",
      note: "Tight 6-week deadline with high visibility.",
    },
    {
      type: "decision-maker",
      quote: "I'll need to run the architecture past our VP of Engineering, Sarah.",
      note: "VP of Engineering Sarah is key technical stakeholder.",
    },
    {
      type: "risk",
      quote: "Our CRM schema is 12 years old and has custom un-indexed fields.",
      note: "High technical debt and un-indexed schema risk.",
    },
  ],
  suggestedReplies: [
    {
      tone: "professional",
      text: "An MCP server architecture is a great way to isolate your legacy CRM from the AI layer without risky direct database writes. For a 6-week timeline, we can deliver a hardened read-only pilot with vector caching within your $25k budget.",
    },
    {
      tone: "friendly",
      text: "That makes complete sense. We can start with a focused read-only MCP connector for the top 5 CRM objects first, which guarantees we hit your Q4 kickoff safely without blowing the budget.",
    },
  ],
  crossQuestions: [
    {
      question:
        "Does your CRM have existing REST/GraphQL webhooks, or will the MCP server need to query read replicas directly?",
      whyAsk: "Identifies whether data access introduces latency or security roadblocks.",
    },
    {
      question:
        "What specific security and role-based permissions must Sarah's team audit before granting tool access?",
      whyAsk: "Prevents last-minute VP veto on auth and enterprise access control.",
    },
    {
      question:
        "If we prioritize vector search over customer notes first, can we defer live CRM write actions to Phase 2?",
      whyAsk: "De-risks the 6-week timeline by separating read-search from write-tools.",
    },
  ],
  redFlags: [
    {
      issue: "Tight 6-week deadline with 12-year-old unindexed legacy schema.",
      quote: "Our CRM schema is 12 years old and has custom un-indexed fields.",
      recommendation:
        "Scope phase 1 strictly to read-only indexed queries and mock edge cases early.",
    },
    {
      issue: "Potential scope creep between read-only assistant vs automated tool actions.",
      recommendation:
        "Document explicit phase 1 boundaries in the scope document.",
    },
  ],
};

export const CANNED_DEMO_WRAPUP: MeetingWrapUp = {
  outcome: {
    statement:
      "Aligned on building a lightweight Model Context Protocol (MCP) server pilot integrated with hybrid vector search for the client's CRM. Agreed to deliver a 6-week read-only pilot within the $25,000 budget cap.",
    status: "Agreed",
    nextStep: "Technical architecture alignment review with VP of Engineering Sarah.",
    nextStepDate: "Next Tuesday at 2:00 PM EST",
  },
  executiveSummary:
    "The client is modernizing their CRM to empower sales reps with AI context retrieval. Rather than building custom brittle LLM wrappers, we agreed on an MCP server approach. The project will run in two phases: Phase 1 delivers a secure read-only retrieval pilot in 6 weeks ($25k budget), followed by automated write workflows in Phase 2.",
  keyDiscussionPoints: [
    {
      topic: "Model Context Protocol (MCP) Integration",
      summary:
        "Explored adopting Anthropic's open MCP standard to connect their CRM database to AI models cleanly without direct schema coupling.",
    },
    {
      topic: "Vector Search on Customer Notes",
      summary:
        "Discussed hybrid retrieval (dense vectors + sparse keyword matching) to handle 100k+ unstructured client interaction logs.",
    },
    {
      topic: "Budget & Schedule Guardrails",
      summary:
        "Client set a firm $25k ceiling and 6-week hard deadline ahead of their annual Q4 sales kickoff.",
    },
  ],
  clientRequirements: {
    deliverables: [
      "Containerized MCP server with OAuth2 authentication",
      "Vector indexing pipeline for CRM customer notes",
      "Fast API gateway with latency under 800ms",
      "Deployment documentation for internal cloud team",
    ],
    budgetConstraints: "$25,000 fixed price for Phase 1 pilot",
    timelineConstraints: "6 weeks hard deadline before Q4 kickoff",
    technicalPreferences: ["TypeScript/Node.js", "PostgreSQL pgvector", "Docker"],
  },
  decisions: [
    "Adopt Model Context Protocol (MCP) as the communication interface.",
    "Phase 1 will be strictly read-only to avoid schema corruption risks.",
    "PostgreSQL pgvector selected over managed third-party vector SaaS to satisfy privacy requirements.",
  ],
  openQuestions: [
    "Will Sarah (VP Eng) require SSO integration for the pilot phase?",
    "Can the client provide a sanitized staging replica of the CRM database by Friday?",
  ],
  tasks: [
    {
      id: "t-1",
      title: "Draft 2-page MCP Architecture & Security Brief for Sarah",
      details: "Prepare architecture diagram and data flow specification detailing read-only constraints.",
      owner: "Our Team",
      dueDate: "This Friday",
      isSuggested: false,
      isClientRequested: true,
      priority: "high",
      sourceQuote: "Can your team send over a short architecture summary so I can brief Sarah?",
      completed: false,
    },
    {
      id: "t-2",
      title: "Sanitize and share staging CRM schema export",
      details: "Provide database schema definition without PII so our team can test indexing.",
      owner: "Client",
      dueDate: "Monday next week",
      isSuggested: false,
      isClientRequested: true,
      priority: "high",
      sourceQuote: "I will have our database admin send over the sanitized schema by Monday.",
      completed: false,
    },
    {
      id: "t-3",
      title: "Confirm latency benchmarks for hybrid search",
      details: "Benchmark embedding generation time on 500-word customer notes.",
      owner: "Our Team",
      isSuggested: true,
      isClientRequested: false,
      priority: "medium",
      completed: false,
    },
  ],
  risksAndRedFlags: [
    {
      risk: "Legacy 12-year-old CRM schema with unindexed custom fields may cause slow queries.",
      mitigation: "Create dedicated read-only index tables in a local sync cache.",
    },
    {
      risk: "VP Engineering approval needed late in the cycle.",
      mitigation: "Include Sarah in next Tuesday's technical walkthrough.",
    },
  ],
  newToTeamResearch: [
    {
      topic: "Model Context Protocol (MCP) Production Best Practices",
      reason:
        "New standard for our team; need to review Anthropic SDK server lifecycle, connection multiplexing, and SSE transport.",
      sources: [
        {
          title: "Anthropic MCP Docs",
          url: "https://modelcontextprotocol.io",
        },
      ],
    },
  ],
  notes:
    "Client was very engaged. Budget is rigid at $25k. Emphasized speed and low friction. Team did great explaining why MCP is safer than raw SQL execution.",
  followUpEmail: {
    subject: "Call Summary & Next Steps: AI CRM Pilot with MCP Architecture",
    body: `Hi Alex,

Thank you for the productive call today! It was great discussing how we can augment your CRM with an AI copilot using the Model Context Protocol (MCP) and hybrid vector search.

To recap our agreed direction:
- Scope: A focused Phase 1 read-only MCP pilot delivering semantic search over customer notes in under 6 weeks.
- Budget: Locked within your $25,000 pilot target.
- Next Step: We will sync with Sarah (VP of Engineering) next Tuesday at 2:00 PM EST for the technical walkthrough.

Action Items:
1. Our Team: Share the 2-page MCP Architecture & Security brief by this Friday.
2. Client Team: Provide the sanitized staging schema export by Monday.

Looking forward to our discussion next Tuesday!

Best regards,
The CallCopilot Engineering Team`,
    tone: "consultative",
  },
};
