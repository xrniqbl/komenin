export type Locale = "en" | "id";

export const messages = {
  en: {
    nav: {
      features: "Features",
      pricing: "Pricing",
      enterprise: "Enterprise",
      security: "Security",
      docs: "Docs",
      login: "Log in",
      startFree: "Start free",
      openMenu: "Open menu",
      language: "Language",
    },
    hero: {
      badge: "Social ops control plane",
      title: "Run comments and auto posts with enterprise control",
      subtitle:
        "Route sessions, generate content with AI, approve safely, and schedule publishing by the minute, hour, or day.",
      startFree: "Start free",
      watchVideo: "Watch video",
      point1: "Approval-first by default",
      point2: "AI via 9Router",
      point3: "1 / 6 / 12 month plans",
    },
    pillars: {
      badge: "Product pillars",
      title: "Four control pillars",
      subtitle: "Built for operators who need scale without losing governance.",
      items: [
        {
          title: "Session Routing",
          body: "Proxy pools, anti-detect sessions, and a high-performance multi-tunnel account grid.",
        },
        {
          title: "Comment Engine",
          body: "Keyword listeners, contextual drafts, human-like pacing, and approval queues.",
        },
        {
          title: "Agent Intelligence",
          body: "Persona, guardrails, RAG knowledge, and long-term memory for accurate replies.",
        },
        {
          title: "Skill Execution",
          body: "Function calling with intent triggers and transparent chain-of-thought logs.",
        },
      ],
    },
    howItWorks: {
      title: "How it works",
      step: "Step",
      steps: [
        "Connect social accounts with proxy-backed sessions",
        "Launch campaigns with approval-first controls",
        "Generate auto posts from topics on your schedule",
        "Review approvals, publish, and audit every action",
      ],
    },
    securitySection: {
      badge: "Security by default",
      title: "Security and control first",
      body: "Role-based access, encrypted session vaults, approval workflows, rate limits, and immutable audit logs keep enterprise operators in control.",
      chips: ["RBAC", "Encrypted secrets", "Audit trail"],
    },
    pricingTeaser: {
      badge: "Pricing",
      title: "1, 6, or 12 months. That's it.",
      subtitle: "Pick a commitment length. Longer plans unlock lower monthly pricing.",
      viewPlan: "View plan",
      compare: "Compare all plans",
      perMonth: "/mo",
      billed: "billed",
    },
    pricingPage: {
      badge: "Simple pricing",
      title: "Choose how long you want to run Komenin",
      subtitle:
        "Only three plans: 1 month, 6 months, and 12 months. Longer commitment, lower monthly rate. No hidden tiers.",
      currencyNote: "Prices in IDR · billed via Midtrans (same amounts as in-app checkout)",
      perMonth: "/month",
      billedEvery: "Billed",
      every: "every",
      month: "month",
      months: "months",
      footerNote: "Need custom limits, security review, or procurement paperwork?",
      talkSales: "Talk to sales",
      compareTitle: "Compare all plans",
      compareSubtitle:
        "A side-by-side view of what changes as commitment length increases. Pick the runway that matches your ops maturity.",
      backHome: "Back to home",
      comparisonHeading: "What you get by plan",
      whyTitle: "How to choose",
      whyBody:
        "Start monthly if you are validating workflows. Move to 6 months once campaigns are live weekly. Choose 12 months when Komenin is part of daily production ops.",
      savingsNote: "Longer plans lower the monthly rate while unlocking higher account limits and stronger support.",
      comparisonRows: [
        {
          label: "Best for",
          values: {
            "1m": "Testing and pilot teams",
            "6m": "Growing operator teams",
            "12m": "Stable production ops",
          },
        },
        {
          label: "Social accounts",
          values: {
            "1m": "Up to 10",
            "6m": "Up to 40",
            "12m": "Up to 100",
          },
        },
        {
          label: "Monthly sends",
          values: {
            "1m": "3,000 comments",
            "6m": "10,000 comments",
            "12m": "30,000 comments",
          },
        },
        {
          label: "Monthly publishes",
          values: {
            "1m": "300 posts",
            "6m": "1,000 posts",
            "12m": "3,000 posts",
          },
        },
        {
          label: "Automation depth",
          values: {
            "1m": "Comment + auto post basics",
            "6m": "Routing + content calendar",
            "12m": "Full worker automation",
          },
        },
        {
          label: "Approvals & control",
          values: {
            "1m": "Approval queue included",
            "6m": "Bulk approve workflows",
            "12m": "Audit logs + webhook controls",
          },
        },
        {
          label: "AI generation",
          values: {
            "1m": "Standard 9Router drafts",
            "6m": "Priority generation limits",
            "12m": "Higher production throughput",
          },
        },
        {
          label: "Support",
          values: {
            "1m": "Email support",
            "6m": "Chat support",
            "12m": "Priority onboarding + support",
          },
        },
        {
          label: "Monthly rate",
          values: {
            "1m": "Rp499.000 / month",
            "6m": "Rp399.000 / month",
            "12m": "Rp299.000 / month",
          },
        },
        {
          label: "Billed total",
          values: {
            "1m": "Rp499.000 every 1 month",
            "6m": "Rp2.394.000 every 6 months",
            "12m": "Rp3.588.000 every 12 months",
          },
        },
      ],
      plans: {
        "1m": {
          name: "1 Month",
          badge: "",
          description: "Flexible month-to-month for testing workflows.",
          features: [
            "Up to 10 social accounts",
            "Comment + auto post campaigns",
            "Approval queue included",
            "AI drafts via 9Router gateway",
            "Email support",
          ],
          cta: "Start 1 month",
        },
        "6m": {
          name: "6 Months",
          badge: "Most popular",
          description: "Best balance of commitment and savings for growing teams.",
          features: [
            "Up to 40 social accounts",
            "Proxy + session routing",
            "Content calendar + bulk approve",
            "Priority AI generation limits",
            "Chat support",
          ],
          cta: "Choose 6 months",
        },
        "12m": {
          name: "12 Months",
          badge: "Best value",
          description: "Lowest monthly rate for stable production operations.",
          features: [
            "Up to 100 social accounts",
            "Full worker automation",
            "Audit logs + publisher webhook",
            "Team seats included",
            "Priority onboarding",
          ],
          cta: "Choose 12 months",
        },
      },
      ai: {
        badge: "AI add-on",
        title: "Komenin AI — use AI without your own API key",
        subtitle:
          "The plans above cover sending & publishing. Komenin AI is a separate add-on that supplies the model — you pay for credits, we handle the keys. 1 credit = 1 token.",
        byokNote: "Prefer to bring your own API key? It stays free forever — AI credits are optional.",
        tiersHeading: "Monthly AI subscription",
        paygHeading: "Pay-as-you-go credit packs",
        creditsPerMonth: "credits/month",
        credits: "credits",
        perMonth: "/month",
        buyCta: "Choose plan",
        buyPackCta: "Buy credits",
        faqHeading: "AI metering FAQ",
        faq: [
          {
            q: "What is an AI credit?",
            a: "1 credit = 1 token (input + output), counted from the model's usage report. A typical AI comment uses about 150 credits.",
          },
          {
            q: "What happens when my monthly quota runs out?",
            a: "Starter and Pro stop (fail-closed) until the next month or you buy PAYG credits. Pro Max automatically continues on your pay-as-you-go balance so production never halts.",
          },
          {
            q: "Do PAYG credits expire?",
            a: "Credits stay valid for 12 months from purchase while your account is active, then expire (see the Acceptable Use Policy).",
          },
          {
            q: "Can I keep using my own API key?",
            a: "Yes — BYOK is always free. Toggle 'prefer my own key' in Settings → AI and AI calls use your provider without touching Komenin credits.",
          },
        ],
      },
    },
    featuresPage: {
      title: "Features",
      subtitle: "Four integrated pillars for enterprise social operations.",
      cta: "Start free",
      items: [
        {
          title: "Session Routing",
          body: "Multi-tunnel account grid, proxy pools, session vault, and health checks.",
        },
        {
          title: "Comment Engine",
          body: "Find conversations, draft replies with AI, and approve before send.",
        },
        {
          title: "Auto Post Campaigns",
          body: "Turn a topic into N posts and schedule by minutes, hours, or days.",
        },
        {
          title: "Agent Intelligence",
          body: "Persona, tone, and system prompts powered by your AI gateway.",
        },
        {
          title: "Approvals & Audit",
          body: "Human-in-the-loop queues with editable drafts and action trails.",
        },
        {
          title: "Publisher Webhook",
          body: "Simulator or live webhook delivery with testable endpoints.",
        },
      ],
    },
    featureDetails: {
      sessionRouting: {
        title: "Session Routing",
        subtitle: "Manage proxies, anti-detect sessions, and multi-tunnel account health.",
        points: [
          "HTTP/SOCKS5 proxy pools",
          "Encrypted session vault",
          "IP rotation logs",
          "Account health grid",
        ],
        cta: "Start free",
      },
      commentEngine: {
        title: "Comment Engine",
        subtitle: "Discover targets, generate contextual comments, and send with human-like controls.",
        points: [
          "Keyword and competitor listeners",
          "Approval-required campaigns",
          "Rate limits and delays",
          "Activity logging",
        ],
        cta: "Start free",
      },
      agentIntelligence: {
        title: "Agent Intelligence",
        subtitle: "Train agents with persona, guardrails, knowledge, and memory.",
        points: [
          "Persona configuration",
          "RAG document ingestion",
          "Long-term memory ledger",
          "Playground testing",
        ],
        cta: "Start free",
      },
      skillExecution: {
        title: "Skill Execution",
        subtitle: "Let agents call approved skills with transparent chain-of-thought logs.",
        points: [
          "Skill registry",
          "Intent auto-triggers",
          "Builtin and webhook skills",
          "CoT run timeline",
        ],
        cta: "Start free",
      },
    },
    enterprisePage: {
      badge: "Enterprise",
      title: "Built for security reviews and multi-team ops",
      subtitle:
        "Komenin gives enterprise operators governed automation: custom quotas, SSO configuration preview, audit export, and guided onboarding without losing day-to-day control.",
      cta: "Book demo",
      backHome: "Back to home",
      fitTitle: "When enterprise is the right fit",
      fitBody:
        "Choose enterprise when you need procurement support, higher limits, dedicated onboarding, or stricter compliance controls than self-serve plans.",
      sections: [
        {
          title: "Governance & access",
          body: "Keep every workspace isolated and role-aware.",
          bullets: [
            "Workspace RBAC with owner/admin/operator/analyst/auditor/viewer",
            "SSO/SAML configuration preview (production ACS shipping next)",
            "Invite flows and membership lifecycle controls",
          ],
        },
        {
          title: "Scale controls",
          body: "Operate more accounts without losing guardrails.",
          bullets: [
            "Custom account, send, and publish limits",
            "Approval-first defaults with paced automation",
            "Worker and connector policy tailored to your environment",
          ],
        },
        {
          title: "Security review support",
          body: "Make diligence faster for IT and compliance teams.",
          bullets: [
            "Encrypted secrets and audit-ready action trails",
            "Security questionnaire and architecture walkthrough support",
            "Clear data handling and residency metadata",
          ],
        },
        {
          title: "Success & support",
          body: "Launch with runbooks, not guesswork.",
          bullets: [
            "Guided onboarding for operators and admins",
            "Priority support path for production incidents",
            "Playbooks for campaign rollout and approval workflows",
          ],
        },
      ],
    },
    securityPage: {
      badge: "Security",
      title: "Control-plane security for social operations",
      subtitle:
        "Komenin is designed for managed engagement operations with explicit approvals, encrypted credentials, and immutable audit trails—not uncontrolled spam tooling.",
      cta: "Start free",
      backHome: "Back to home",
      sections: [
        {
          title: "Data protection",
          body: "Sensitive values stay protected at rest.",
          bullets: [
            "Application-level encryption for secrets and session material",
            "Least-privilege workspace isolation on every business query",
            "No plaintext credential storage in operator UI",
          ],
        },
        {
          title: "Operational guardrails",
          body: "Automation remains human-supervised by default.",
          bullets: [
            "Approval-required campaign mode as the default",
            "Daily quotas, delays, and health gating before send/publish",
            "High-risk skills can force manual review even in auto mode",
          ],
        },
        {
          title: "Identity & access",
          body: "Role boundaries are first-class.",
          bullets: [
            "Fine-grained workspace permissions",
            "SSO/SAML config stored today; production login enforcement coming next",
            "Platform superadmin separated from workspace roles",
          ],
        },
        {
          title: "Auditability",
          body: "Every sensitive action is reviewable.",
          bullets: [
            "Append-only audit logs for config and billing changes",
            "CSV export for compliance archives",
            "Delivery and job run histories for outbound actions",
          ],
        },
      ],
    },
    aboutPage: {
      title: "About Komenin",
      subtitle: "A quiet control plane for teams that need scale with governance.",
      cta: "Start free",
      points: [
        "Enterprise-first design",
        "Operator workflows",
        "AI with guardrails",
      ],
    },
    contactPage: {
      badge: "Contact",
      title: "Book a demo",
      subtitle: "Ask about enterprise onboarding, security review, or custom quotas.",
      success: "Thanks. Your message was received — our team will follow up shortly.",
      formTitle: "Send a message",
      formSubtitle: "We will respond with next steps.",
      name: "Name",
      email: "Work email",
      message: "How can we help?",
      submit: "Send message",
      submitting: "Sending…",
      errorGeneric: "Could not send your message. Please try again.",
    },
    legalPages: {
      privacy: {
        title: "Privacy Policy",
        subtitle: "How Komenin collects, uses, and protects your data.",
        updated: "Last updated: 2 September 2026",
        cta: "Contact",
        href: "/contact",
        sections: [
          {
            heading: "What we collect",
            points: [
              "Account data: name, email, and sign-in identifiers (Google, email OTP, or SSO).",
              "Workspace configuration: connected social accounts, proxies, providers, and settings you create.",
              "Operational content: drafts, comments, campaigns, approvals, and activity generated through the Service.",
              "Credentials you provide (BYOK API keys, session tokens) — stored encrypted.",
              "Usage and billing records: plan, orders, AI credit consumption (model and token counts, not your prompts).",
              "Technical data: logs, IP address, and device/browser information needed to operate and secure the Service.",
            ],
          },
          {
            heading: "How we use it",
            points: [
              "Provide and operate the Service (drafting, scheduling, publishing, analytics).",
              "Process payments and fulfill entitlements via our payment processor.",
              "Secure the platform, prevent abuse, and enforce quotas and rate limits.",
              "Communicate with you about your account, quota thresholds, and important changes.",
              "Improve reliability and features (in aggregate, not by reading your private content).",
            ],
          },
          {
            heading: "AI processing and your prompts",
            paragraphs: [
              "When you use AI features, the text needed to generate a result is sent to the AI provider you configured (your own key, or our gateway for Komenin AI) solely to produce that result.",
              "We record metering metadata — the model used and token counts — for billing and analytics. We do not use your prompts or generated content to train models, and we do not sell your content.",
            ],
          },
          {
            heading: "Third-party processors",
            paragraphs: [
              "We use subprocessors to deliver the Service, including: Midtrans (payments), Brevo (transactional email), our hosting/database provider, and the AI provider you select. Each processes data only as needed to provide its service to us.",
              "Connected social platforms (Instagram, Threads, TikTok) receive the content you choose to publish through them, under their own terms and privacy policies.",
            ],
          },
          {
            heading: "Retention, security, and your rights",
            points: [
              "We retain workspace data while your account is active and delete or anonymize it within a reasonable period after closure, except where law requires longer retention.",
              "We apply encryption in transit and at rest, per-workspace isolation, and access controls.",
              "You may request access, correction, export, or deletion of your personal data via the contact page.",
              "You can disconnect social accounts and remove stored credentials at any time in Settings.",
            ],
          },
          {
            heading: "Changes and contact",
            paragraphs: [
              "We may update this Policy; material changes will be notified in-app or by email before taking effect.",
              "For privacy questions or data requests, use the contact page.",
            ],
          },
        ],
      },
      terms: {
        title: "Terms of Service",
        subtitle: "The agreement between you and Komenin for using the platform.",
        updated: "Last updated: 2 September 2026",
        cta: "Read AUP",
        href: "/legal/aup",
        sections: [
          {
            heading: "Acceptance of these Terms",
            paragraphs: [
              "By creating an account or using Komenin (\"the Service\"), you agree to these Terms of Service and our Acceptable Use Policy. If you use the Service on behalf of a company or workspace, you represent that you are authorized to bind that entity, and \"you\" refers to that entity.",
              "If you do not agree, do not use the Service.",
            ],
          },
          {
            heading: "The Service",
            paragraphs: [
              "Komenin provides social-media operations tooling: connecting social accounts, AI-assisted comment and content drafting, approval workflows, scheduling, and analytics.",
              "You are responsible for the social accounts you connect and for complying with each platform's terms (Instagram, Threads, TikTok, and others). The Service is a tool; publishing decisions and their consequences remain yours.",
            ],
          },
          {
            heading: "Accounts, workspaces, and security",
            points: [
              "You must provide accurate registration information and keep your credentials confidential.",
              "You are responsible for all activity under your workspace and for the conduct of members you invite.",
              "API keys and session credentials you provide (BYOK) are stored encrypted; you are responsible for their validity and for revoking them when no longer needed.",
              "Notify us promptly of any unauthorized use of your account.",
            ],
          },
          {
            heading: "Subscriptions, billing, and Komenin AI credits",
            paragraphs: [
              "Paid plans and Komenin AI add-ons are billed in Indonesian Rupiah (IDR) via our payment processor (Midtrans). Prices are shown at checkout before you pay.",
              "Social plans grant send/publish limits for the stated period. Komenin AI is a separate add-on with its own subscription tiers and pay-as-you-go (PAYG) credit packs.",
              "AI credits: 1 credit equals 1 token (input + output), counted from the model's usage report. Unused subscription quota does not roll over between monthly quota periods. PAYG credits are valid for 12 months from purchase while your account is active, after which they expire.",
              "Tier changes take effect at the next quota period (no proration). Except where required by law, payments are non-refundable once the corresponding entitlement or credits have been provisioned; a refund or chargeback may reverse the associated entitlement and any unspent credits.",
            ],
          },
          {
            heading: "Acceptable use",
            paragraphs: [
              "You must use the Service in compliance with our Acceptable Use Policy, applicable law, and platform rules. We may suspend or terminate access for abuse, spam, or violations.",
            ],
          },
          {
            heading: "Intellectual property and your content",
            paragraphs: [
              "You retain ownership of the content you create. You grant us a limited license to process that content solely to provide the Service (for example, generating drafts at your request).",
              "We retain all rights to the Service itself, including software, design, and branding.",
            ],
          },
          {
            heading: "Disclaimers and limitation of liability",
            paragraphs: [
              "The Service is provided \"as is\" without warranties of any kind. We do not warrant that generated content complies with any platform's policies or that the Service will be uninterrupted or error-free.",
              "To the maximum extent permitted by law, Komenin is not liable for indirect, incidental, or consequential damages, or for actions taken by third-party platforms (such as account suspension). Our aggregate liability is limited to the amount you paid us in the 3 months preceding the claim.",
            ],
          },
          {
            heading: "Changes and contact",
            paragraphs: [
              "We may update these Terms; material changes will be notified in-app or by email, and continued use after the effective date constitutes acceptance.",
              "Questions about these Terms: use the contact page.",
            ],
          },
        ],
      },
      aup: {
        title: "Acceptable Use Policy",
        subtitle: "Automation must respect platform rules, consent, and rate limits.",
        updated: "Last updated: 2 September 2026",
        cta: "Contact",
        href: "/contact",
        sections: [
          {
            heading: "Scope of this Policy",
            paragraphs: [
              "This Acceptable Use Policy (\"AUP\") governs how you may use Komenin (\"the Service\") — the web app, the public API, and every automated action the Service performs on your behalf, including listeners, comment drafting, and scheduled publishing.",
              "It applies to every member of your workspace and to all content sent through connected accounts. This AUP supplements our Terms of Service; capitalized terms have the meaning given there.",
            ],
          },
          {
            heading: "Follow the connected platforms' rules",
            paragraphs: [
              "Your Instagram, Threads, and TikTok accounts remain subject to each platform's own terms, automation policies, and community standards. Komenin is built to operate within those limits — not around them.",
            ],
            points: [
              "Only connect accounts you own or are explicitly authorized to operate.",
              "Respect each platform's rate limits and keep the Service's built-in delays, quotas, and approval controls enabled.",
              "Do not use the Service to evade platform bans, restrictions, device or account verification, or other enforcement measures.",
            ],
          },
          {
            heading: "Prohibited content",
            paragraphs: [
              "You may not send, schedule, or store through the Service:",
            ],
            points: [
              "Illegal content, or content that infringes intellectual property, privacy, or other rights of others.",
              "Harassment, hate speech, threats, or content that exploits or endangers minors.",
              "Malware, phishing, fraud, or schemes designed to deceive people or platforms.",
              "Misleading engagement — undisclosed bots, fake personas, or inauthentic reviews and testimonials.",
            ],
          },
          {
            heading: "Prohibited behavior",
            points: [
              "Spam: unsolicited bulk comments, replies, or messages, or repeated unwanted contact with the same targets.",
              "Engagement manipulation: buying, selling, or artificially inflating followers, likes, or comments — including bot networks and engagement pods.",
              "Circumventing the Service's own controls: bypassing quotas, rate limits, approval flows, or abuse detections (for example by creating extra workspaces or accounts to evade limits).",
              "Discovery abuse: scraping or monitoring content beyond what listeners and the API are designed to return.",
              "Credential misuse: connecting sessions or API keys you are not authorized to use, or sharing them in violation of your organization's policies.",
            ],
          },
          {
            heading: "Consent and personal data",
            paragraphs: [
              "Automated outreach targets real people. You are responsible for having a lawful basis for the interactions you automate and for honoring opt-outs and deletion requests.",
            ],
            points: [
              "Do not collect or store personal data from platforms except through the Service's supported features (inbox, leads, listeners).",
              "Comply with applicable privacy laws (including Indonesia's PDP Law and, where relevant, GDPR) for the data you process through the Service.",
            ],
          },
          {
            heading: "Enforcement",
            paragraphs: [
              "We investigate suspected violations. Where feasible, we notify the workspace owner and describe what must be fixed.",
            ],
            points: [
              "We may warn, limit features, pause sending, suspend, or terminate a workspace that breaches this AUP.",
              "Serious violations — or repeated ones after a warning — may result in immediate suspension.",
              "Report violations or ask questions about this Policy via the contact page.",
            ],
          },
        ],
      },
    },
    faq: {
      kicker: "FAQ",
      title: "Answers before you start",
      subtitle: "Clear details on plans, AI posting, approvals, and platform support.",
      items: [
        {
          q: "What plans can I buy?",
          a: "Only three duration plans: 1 month, 6 months, and 12 months. Longer commitments unlock a lower monthly rate.",
        },
        {
          q: "Can AI create posts from a topic I choose?",
          a: "Yes. In Auto Post campaigns you enter a topic, choose how many posts you want, and set the interval (minutes, hours, or days). Komenin generates drafts via your 9Router AI gateway.",
        },
        {
          q: "Do posts publish automatically?",
          a: "You can choose Approval required or Auto mode. Approval mode keeps a human review step before scheduling/publishing.",
        },
        {
          q: "Which platforms are supported?",
          a: "Instagram, Threads, and TikTok are in the product model. Publishing currently supports simulator mode and live webhook delivery.",
        },
        {
          q: "How does AI connect?",
          a: "Komenin routes generation through an OpenAI-compatible gateway such as 9Router. Provider auth (for example xAI build auth) stays inside 9Router.",
        },
        {
          q: "Is this safe for team operations?",
          a: "Yes. Workspace RBAC, encrypted secrets, approval queues, audit logs, and rate/delay controls are built into the control plane.",
        },
      ],
    },
    cta: {
      title: "Ready to run controlled engagement ops?",
      subtitle:
        "Create a workspace, invite your team, and launch with approval-first automation.",
      startFree: "Start free",
      talkSales: "Talk to sales",
    },
    footer: {
      blurb: "Quiet control plane for enterprise social engagement operations.",
      product: "Product",
      company: "Company",
      legal: "Legal",
      features: "Features",
      pricing: "Pricing",
      security: "Security",
      docs: "Docs",
      about: "About",
      contact: "Contact",
      enterprise: "Enterprise",
      privacy: "Privacy",
      terms: "Terms",
      aup: "AUP",
    },
    docsUi: {
      brand: "Komenin Documentation",
      brandShort: "Komenin Docs",
      home: "Home",
      tutorial: "Tutorial",
      api: "API Reference",
      backToSite: "Back to site",
      browse: "Browse docs",
      openMenu: "Open docs menu",
      searchPlaceholder: "Search docs...",
      noMatches: "No matches",
      previous: "Previous",
      next: "Next",
      copyPage: "Copy page",
      copied: "Copied",
      needProductUi: "Need the product UI?",
      openCommandCenter: "Open command center",
      homeTitle: "Komenin Documentation",
      homeSubtitle:
        "Two ways to use Komenin: follow the Tutorial to manage everything from the dashboard, or use the API Reference to build your own integration around workers, webhooks, and billing.",
      getStarted: "Get Started",
      apiReference: "API Reference",
      quickStart: "Quick Start",
      tutorialPath: "Tutorial path",
      tutorialPathBody:
        "Dashboard-first operators: accounts, campaigns, approvals, agents, billing, and admin.",
      openTutorial: "Open Tutorial",
      integrationPath: "Integration path",
      integrationPathBody:
        "Engineers: worker jobs, publish webhooks, Midtrans notifications, and SSO endpoints.",
      openWorkerApi: "Open Worker API",
      cards: [
        {
          href: "/docs/tutorial/introduction",
          title: "Getting Started",
          body: "New to Komenin? Learn the core concepts and what you can manage from one workspace.",
        },
        {
          href: "/docs/tutorial/connectors",
          title: "Hybrid Connectors",
          body: "Use simulator for demos, webhook for live ops, and official adapters when credentials exist.",
        },
        {
          href: "/docs/tutorial/campaigns",
          title: "Set Automation",
          body: "Run comment campaigns, approvals, paced sends, and auto-post schedules with guardrails.",
        },
        {
          href: "/docs/tutorial/agents",
          title: "Agent Intelligence",
          body: "Personas, knowledge retrieval, memory, and playground drafts before anything goes live.",
        },
        {
          href: "/docs/api",
          title: "API Reference",
          body: "Trigger workers, receive publish webhooks, and handle Midtrans billing notifications.",
        },
        {
          href: "/docs/tutorial/security",
          title: "Security & Control",
          body: "Encrypted secrets, RBAC, approvals-by-default, usage limits, and audit export.",
        },
        {
          href: "/docs/tutorial/golden-path",
          title: "Golden Path Demo",
          body: "Run the full simulator loop from signup to audited send/publish before going live.",
        },
        {
          href: "/docs/tutorial/command-center",
          title: "Command Center",
          body: "Learn what to check daily in /app and where to click next when something degrades.",
        },
        {
          href: "/docs/tutorial/troubleshooting",
          title: "Troubleshooting",
          body: "Fix auth loops, empty inbox, worker 401s, live fail-closed errors, and billing pending states.",
        },
        {
          href: "/docs/tutorial/faq",
          title: "FAQ",
          body: "Short answers about simulator vs live, approvals, Midtrans, workers, SSO, and admin access.",
        },
      ],
    },
  },
  id: {
    nav: {
      features: "Fitur",
      pricing: "Harga",
      enterprise: "Enterprise",
      security: "Keamanan",
      docs: "Dokumentasi",
      login: "Masuk",
      startFree: "Mulai gratis",
      openMenu: "Buka menu",
      language: "Bahasa",
    },
    hero: {
      badge: "Control plane social ops",
      title: "Jalankan komentar dan auto post dengan kontrol enterprise",
      subtitle:
        "Route session, generate konten dengan AI, approve dengan aman, dan jadwalkan publish per menit, jam, atau hari.",
      startFree: "Mulai gratis",
      watchVideo: "Tonton video",
      point1: "Approval-first secara default",
      point2: "AI via 9Router",
      point3: "Paket 1 / 6 / 12 bulan",
    },
    pillars: {
      badge: "Pilar produk",
      title: "Empat pilar kontrol",
      subtitle: "Dibangun untuk operator yang butuh skala tanpa kehilangan governance.",
      items: [
        {
          title: "Session Routing",
          body: "Proxy pool, session anti-detect, dan grid multi-tunnel berperforma tinggi.",
        },
        {
          title: "Comment Engine",
          body: "Listener kata kunci, draft kontekstual, pacing human-like, dan antrian approval.",
        },
        {
          title: "Agent Intelligence",
          body: "Persona, guardrail, knowledge RAG, dan memori jangka panjang untuk balasan akurat.",
        },
        {
          title: "Skill Execution",
          body: "Function calling dengan intent trigger dan log chain-of-thought yang transparan.",
        },
      ],
    },
    howItWorks: {
      title: "Cara kerja",
      step: "Langkah",
      steps: [
        "Hubungkan akun sosial dengan session berbasis proxy",
        "Jalankan campaign dengan kontrol approval-first",
        "Generate auto post dari topik sesuai jadwal Anda",
        "Review approval, publish, dan audit setiap aksi",
      ],
    },
    securitySection: {
      badge: "Keamanan default",
      title: "Keamanan dan kontrol lebih dulu",
      body: "Akses berbasis peran, session vault terenkripsi, alur approval, rate limit, dan audit log imutabel menjaga operator enterprise tetap kendali.",
      chips: ["RBAC", "Secret terenkripsi", "Jejak audit"],
    },
    pricingTeaser: {
      badge: "Harga",
      title: "1, 6, atau 12 bulan. Selesai.",
      subtitle:
        "Pilih lama berlangganan. Paket lebih panjang, harga bulanan lebih rendah.",
      viewPlan: "Lihat paket",
      compare: "Bandingkan semua paket",
      perMonth: "/bln",
      billed: "ditagih",
    },
    pricingPage: {
      badge: "Harga sederhana",
      title: "Pilih berapa lama Anda ingin memakai Komenin",
      subtitle:
        "Hanya tiga paket: 1 bulan, 6 bulan, dan 12 bulan. Semakin panjang, semakin rendah harga bulanan. Tanpa tier tersembunyi.",
      currencyNote: "Harga dalam IDR · ditagih via Midtrans (sama dengan checkout di app)",
      perMonth: "/bulan",
      billedEvery: "Ditagih",
      every: "setiap",
      month: "bulan",
      months: "bulan",
      footerNote: "Butuh limit kustom, security review, atau proses procurement?",
      talkSales: "Hubungi sales",
      compareTitle: "Bandingkan semua paket",
      compareSubtitle:
        "Perbandingan berdampingan tentang apa yang berubah seiring durasi komitmen. Pilih runway yang sesuai kematangan operasi Anda.",
      backHome: "Kembali ke beranda",
      comparisonHeading: "Yang Anda dapat per paket",
      whyTitle: "Cara memilih",
      whyBody:
        "Mulai bulanan jika masih validasi workflow. Pindah ke 6 bulan saat campaign sudah jalan mingguan. Pilih 12 bulan ketika Komenin jadi bagian operasi produksi harian.",
      savingsNote: "Paket lebih panjang menurunkan harga bulanan sekaligus membuka limit akun lebih tinggi dan support lebih kuat.",
      comparisonRows: [
        {
          label: "Paling cocok untuk",
          values: {
            "1m": "Tim uji coba / pilot",
            "6m": "Tim operator yang berkembang",
            "12m": "Operasi produksi yang stabil",
          },
        },
        {
          label: "Akun sosial",
          values: {
            "1m": "Hingga 10",
            "6m": "Hingga 40",
            "12m": "Hingga 100",
          },
        },
        {
          label: "Kirim komentar / bulan",
          values: {
            "1m": "3.000 komentar",
            "6m": "10.000 komentar",
            "12m": "30.000 komentar",
          },
        },
        {
          label: "Publish / bulan",
          values: {
            "1m": "300 post",
            "6m": "1.000 post",
            "12m": "3.000 post",
          },
        },
        {
          label: "Kedalaman otomasi",
          values: {
            "1m": "Dasar komentar + auto post",
            "6m": "Routing + kalender konten",
            "12m": "Otomasi worker penuh",
          },
        },
        {
          label: "Approval & kontrol",
          values: {
            "1m": "Antrian approval termasuk",
            "6m": "Workflow bulk approve",
            "12m": "Audit log + kontrol webhook",
          },
        },
        {
          label: "Generate AI",
          values: {
            "1m": "Draft 9Router standar",
            "6m": "Limit generate prioritas",
            "12m": "Throughput produksi lebih tinggi",
          },
        },
        {
          label: "Dukungan",
          values: {
            "1m": "Dukungan email",
            "6m": "Dukungan chat",
            "12m": "Onboarding + support prioritas",
          },
        },
        {
          label: "Harga bulanan",
          values: {
            "1m": "Rp499.000 / bulan",
            "6m": "Rp399.000 / bulan",
            "12m": "Rp299.000 / bulan",
          },
        },
        {
          label: "Total tagihan",
          values: {
            "1m": "Rp499.000 setiap 1 bulan",
            "6m": "Rp2.394.000 setiap 6 bulan",
            "12m": "Rp3.588.000 setiap 12 bulan",
          },
        },
      ],
      plans: {
        "1m": {
          name: "1 Bulan",
          badge: "",
          description: "Fleksibel bulanan untuk uji coba workflow.",
          features: [
            "Hingga 10 akun sosial",
            "Campaign komentar + auto post",
            "Antrian approval termasuk",
            "Draft AI via gateway 9Router",
            "Dukungan email",
          ],
          cta: "Mulai 1 bulan",
        },
        "6m": {
          name: "6 Bulan",
          badge: "Paling populer",
          description: "Keseimbangan terbaik antara komitmen dan penghematan.",
          features: [
            "Hingga 40 akun sosial",
            "Proxy + session routing",
            "Kalender konten + bulk approve",
            "Limit generate AI prioritas",
            "Dukungan chat",
          ],
          cta: "Pilih 6 bulan",
        },
        "12m": {
          name: "12 Bulan",
          badge: "Nilai terbaik",
          description: "Harga bulanan terendah untuk operasi produksi yang stabil.",
          features: [
            "Hingga 100 akun sosial",
            "Otomasi worker penuh",
            "Audit log + publisher webhook",
            "Seat tim termasuk",
            "Onboarding prioritas",
          ],
          cta: "Pilih 12 bulan",
        },
      },
      ai: {
        badge: "Add-on AI",
        title: "Komenin AI — pakai AI tanpa API key sendiri",
        subtitle:
          "Plan di atas mencakup pengiriman & publikasi. Komenin AI adalah add-on terpisah yang menyediakan modelnya — Anda membayar kredit, kami yang mengurus key. 1 kredit = 1 token.",
        byokNote: "Lebih suka bawa API key sendiri? Tetap gratis selamanya — kredit AI bersifat opsional.",
        tiersHeading: "Langganan AI bulanan",
        paygHeading: "Paket kredit pay-as-you-go",
        creditsPerMonth: "kredit/bulan",
        credits: "kredit",
        perMonth: "/bulan",
        buyCta: "Pilih plan",
        buyPackCta: "Beli kredit",
        faqHeading: "FAQ metering AI",
        faq: [
          {
            q: "Apa itu kredit AI?",
            a: "1 kredit = 1 token (input + output), dihitung dari laporan usage model. Satu komentar AI umumnya memakai sekitar 150 kredit.",
          },
          {
            q: "Apa yang terjadi saat kuota bulanan habis?",
            a: "Starter dan Pro berhenti (fail-closed) sampai bulan berikutnya atau Anda membeli kredit PAYG. Pro Max otomatis lanjut ke saldo pay-as-you-go agar produksi tidak berhenti.",
          },
          {
            q: "Apakah kredit PAYG kedaluwarsa?",
            a: "Kredit berlaku 12 bulan sejak pembelian selama akun aktif, lalu hangus (lihat Kebijakan Penggunaan yang Diterima).",
          },
          {
            q: "Bisakah saya tetap memakai API key sendiri?",
            a: "Bisa — BYOK selalu gratis. Aktifkan 'utamakan API key sendiri' di Settings → AI dan panggilan AI memakai provider Anda tanpa memotong kredit Komenin.",
          },
        ],
      },
    },
    featuresPage: {
      title: "Fitur",
      subtitle: "Empat pilar terintegrasi untuk operasi sosial enterprise.",
      cta: "Mulai gratis",
      items: [
        {
          title: "Session Routing",
          body: "Grid multi-tunnel akun, proxy pool, session vault, dan health check.",
        },
        {
          title: "Comment Engine",
          body: "Temukan percakapan, buat balasan AI, dan approve sebelum kirim.",
        },
        {
          title: "Auto Post Campaign",
          body: "Ubah topik menjadi N postingan dan jadwalkan per menit, jam, atau hari.",
        },
        {
          title: "Agent Intelligence",
          body: "Persona, tone, dan system prompt yang didukung AI gateway Anda.",
        },
        {
          title: "Approval & Audit",
          body: "Antrian human-in-the-loop dengan draft yang bisa diedit dan jejak aksi.",
        },
        {
          title: "Publisher Webhook",
          body: "Simulator atau live webhook delivery dengan endpoint yang bisa diuji.",
        },
      ],
    },
    featureDetails: {
      sessionRouting: {
        title: "Session Routing",
        subtitle: "Kelola proxy, session anti-detect, dan kesehatan akun multi-tunnel.",
        points: [
          "Proxy pool HTTP/SOCKS5",
          "Session vault terenkripsi",
          "Log rotasi IP",
          "Grid kesehatan akun",
        ],
        cta: "Mulai gratis",
      },
      commentEngine: {
        title: "Comment Engine",
        subtitle: "Temukan target, generate komentar kontekstual, dan kirim dengan kontrol human-like.",
        points: [
          "Listener kata kunci dan kompetitor",
          "Campaign approval-required",
          "Rate limit dan delay",
          "Logging aktivitas",
        ],
        cta: "Mulai gratis",
      },
      agentIntelligence: {
        title: "Agent Intelligence",
        subtitle: "Latih agent dengan persona, guardrail, knowledge, dan memori.",
        points: [
          "Konfigurasi persona",
          "Ingest dokumen RAG",
          "Ledger memori jangka panjang",
          "Pengujian playground",
        ],
        cta: "Mulai gratis",
      },
      skillExecution: {
        title: "Skill Execution",
        subtitle: "Biarkan agent memanggil skill yang disetujui dengan log chain-of-thought yang transparan.",
        points: [
          "Registry skill",
          "Auto-trigger intent",
          "Skill builtin dan webhook",
          "Timeline run CoT",
        ],
        cta: "Mulai gratis",
      },
    },
    enterprisePage: {
      badge: "Enterprise",
      title: "Dirancang untuk security review dan operasi multi-tim",
      subtitle:
        "Komenin memberi operator enterprise otomatisasi yang terkendali: kuota kustom, preview konfigurasi SSO, export audit, dan onboarding terpandu tanpa kehilangan kontrol harian.",
      cta: "Jadwalkan demo",
      backHome: "Kembali ke beranda",
      fitTitle: "Kapan paket enterprise paling pas",
      fitBody:
        "Pilih enterprise jika Anda butuh dukungan procurement, limit lebih tinggi, onboarding khusus, atau kontrol compliance yang lebih ketat daripada paket self-serve.",
      sections: [
        {
          title: "Governance & akses",
          body: "Setiap workspace tetap terisolasi dan berbasis peran.",
          bullets: [
            "RBAC workspace: owner/admin/operator/analyst/auditor/viewer",
            "Preview konfigurasi SSO/SAML (ACS production menyusul)",
            "Alur invite dan kontrol siklus membership",
          ],
        },
        {
          title: "Kontrol skala",
          body: "Kelola lebih banyak akun tanpa lepas guardrail.",
          bullets: [
            "Limit akun, send, dan publish yang bisa dikustom",
            "Default approval-first dengan otomasi berirama",
            "Kebijakan worker dan connector sesuai environment Anda",
          ],
        },
        {
          title: "Dukungan security review",
          body: "Proses due diligence jadi lebih cepat untuk IT dan compliance.",
          bullets: [
            "Secret terenkripsi dan jejak aksi siap audit",
            "Dukungan kuesioner keamanan dan walkthrough arsitektur",
            "Metadata penanganan data dan residency yang jelas",
          ],
        },
        {
          title: "Success & support",
          body: "Go-live dengan runbook, bukan tebakan.",
          bullets: [
            "Onboarding terpandu untuk operator dan admin",
            "Jalur support prioritas untuk insiden production",
            "Playbook rollout campaign dan workflow approval",
          ],
        },
      ],
    },
    securityPage: {
      badge: "Keamanan",
      title: "Keamanan control plane untuk social operations",
      subtitle:
        "Komenin dirancang untuk managed engagement operations dengan approval eksplisit, kredensial terenkripsi, dan audit trail imutabel—bukan tooling spam tanpa kontrol.",
      cta: "Mulai gratis",
      backHome: "Kembali ke beranda",
      sections: [
        {
          title: "Proteksi data",
          body: "Nilai sensitif tetap terlindungi saat disimpan.",
          bullets: [
            "Enkripsi level aplikasi untuk secret dan material session",
            "Isolasi workspace least-privilege di setiap query bisnis",
            "Tidak ada penyimpanan kredensial plaintext di UI operator",
          ],
        },
        {
          title: "Guardrail operasional",
          body: "Otomasi tetap diawasi manusia secara default.",
          bullets: [
            "Mode campaign approval-required sebagai default",
            "Kuota harian, delay, dan health gating sebelum send/publish",
            "Skill berisiko tinggi bisa memaksa review manual meski mode auto",
          ],
        },
        {
          title: "Identitas & akses",
          body: "Batas peran adalah first-class.",
          bullets: [
            "Permission workspace yang granular",
            "Konfig SSO/SAML tersimpan hari ini; penegakan login production menyusul",
            "Superadmin platform terpisah dari role workspace",
          ],
        },
        {
          title: "Auditabilitas",
          body: "Setiap aksi sensitif bisa ditinjau ulang.",
          bullets: [
            "Audit log append-only untuk perubahan config dan billing",
            "Export CSV untuk arsip compliance",
            "Riwayat delivery dan job run untuk aksi outbound",
          ],
        },
      ],
    },
    aboutPage: {
      title: "Tentang Komenin",
      subtitle: "Control plane yang tenang untuk tim yang butuh skala dengan governance.",
      cta: "Mulai gratis",
      points: [
        "Desain enterprise-first",
        "Workflow operator",
        "AI dengan guardrail",
      ],
    },
    contactPage: {
      badge: "Kontak",
      title: "Jadwalkan demo",
      subtitle: "Tanyakan onboarding enterprise, security review, atau kuota kustom.",
      success: "Terima kasih. Pesan Anda sudah diterima — tim kami akan segera menindaklanjuti.",
      formTitle: "Kirim pesan",
      formSubtitle: "Kami akan membalas dengan langkah berikutnya.",
      name: "Nama",
      email: "Email kerja",
      message: "Ada yang bisa kami bantu?",
      submit: "Kirim pesan",
      submitting: "Mengirim…",
      errorGeneric: "Pesan gagal dikirim. Silakan coba lagi.",
    },
    legalPages: {
      privacy: {
        title: "Kebijakan Privasi",
        subtitle: "Bagaimana Komenin mengumpulkan, menggunakan, dan melindungi data Anda.",
        updated: "Terakhir diperbarui: 2 September 2026",
        cta: "Kontak",
        href: "/contact",
        sections: [
          {
            heading: "Data yang kami kumpulkan",
            points: [
              "Data akun: nama, email, dan identitas masuk (Google, OTP email, atau SSO).",
              "Konfigurasi workspace: akun sosial, proxy, provider, dan pengaturan yang Anda buat.",
              "Konten operasional: draf, komentar, campaign, approval, dan aktivitas yang dihasilkan lewat Layanan.",
              "Kredensial yang Anda berikan (API key BYOK, token sesi) — disimpan terenkripsi.",
              "Catatan pemakaian dan tagihan: plan, order, konsumsi kredit AI (model dan jumlah token, bukan prompt Anda).",
              "Data teknis: log, alamat IP, dan informasi perangkat/browser yang diperlukan untuk mengoperasikan dan mengamankan Layanan.",
            ],
          },
          {
            heading: "Cara kami menggunakannya",
            points: [
              "Menyediakan dan mengoperasikan Layanan (penyusunan draf, penjadwalan, publikasi, analitik).",
              "Memproses pembayaran dan memenuhi entitlement lewat pemroses pembayaran kami.",
              "Mengamankan platform, mencegah penyalahgunaan, dan menegakkan kuota serta rate limit.",
              "Menghubungi Anda tentang akun, ambang kuota, dan perubahan penting.",
              "Meningkatkan keandalan dan fitur (secara agregat, bukan dengan membaca konten privat Anda).",
            ],
          },
          {
            heading: "Pemrosesan AI dan prompt Anda",
            paragraphs: [
              "Saat Anda memakai fitur AI, teks yang diperlukan untuk menghasilkan output dikirim ke provider AI yang Anda konfigurasi (key sendiri, atau gateway kami untuk Komenin AI) semata untuk menghasilkan output itu.",
              "Kami mencatat metadata metering — model yang dipakai dan jumlah token — untuk penagihan dan analitik. Kami tidak menggunakan prompt atau konten hasil Anda untuk melatih model, dan kami tidak menjual konten Anda.",
            ],
          },
          {
            heading: "Pemroses pihak ketiga",
            paragraphs: [
              "Kami menggunakan sub-prosesor untuk menyediakan Layanan, antara lain: Midtrans (pembayaran), Brevo (email transaksional), penyedia hosting/database kami, dan provider AI yang Anda pilih. Masing-masing memproses data hanya seperlunya untuk menyediakan layanannya kepada kami.",
              "Platform sosial yang terhubung (Instagram, Threads, TikTok) menerima konten yang Anda pilih untuk dipublikasikan lewat mereka, sesuai syarat dan kebijakan privasi mereka.",
            ],
          },
          {
            heading: "Retensi, keamanan, dan hak Anda",
            points: [
              "Kami menyimpan data workspace selama akun Anda aktif dan menghapus atau menganonimkannya dalam jangka waktu yang wajar setelah penutupan, kecuali hukum mewajibkan retensi lebih lama.",
              "Kami menerapkan enkripsi saat transit dan saat disimpan, isolasi per workspace, dan kontrol akses.",
              "Anda dapat meminta akses, koreksi, ekspor, atau penghapusan data pribadi Anda lewat halaman kontak.",
              "Anda dapat memutus akun sosial dan menghapus kredensial tersimpan kapan saja di Settings.",
            ],
          },
          {
            heading: "Perubahan dan kontak",
            paragraphs: [
              "Kami dapat memperbarui Kebijakan ini; perubahan material akan diberitahukan di aplikasi atau lewat email sebelum berlaku.",
              "Untuk pertanyaan privasi atau permintaan data, gunakan halaman kontak.",
            ],
          },
        ],
      },
      terms: {
        title: "Syarat Layanan",
        subtitle: "Perjanjian antara Anda dan Komenin untuk penggunaan platform.",
        updated: "Terakhir diperbarui: 2 September 2026",
        cta: "Baca AUP",
        href: "/legal/aup",
        sections: [
          {
            heading: "Penerimaan Syarat ini",
            paragraphs: [
              "Dengan membuat akun atau menggunakan Komenin (\"Layanan\"), Anda menyetujui Syarat Layanan ini dan Kebijakan Penggunaan yang Dapat Diterima (AUP) kami. Jika Anda menggunakan Layanan atas nama perusahaan atau workspace, Anda menyatakan berwenang mengikat entitas tersebut, dan \"Anda\" merujuk pada entitas itu.",
              "Jika Anda tidak setuju, jangan gunakan Layanan.",
            ],
          },
          {
            heading: "Layanan",
            paragraphs: [
              "Komenin menyediakan perangkat operasi media sosial: menghubungkan akun sosial, penyusunan komentar dan konten berbantuan AI, alur approval, penjadwalan, dan analitik.",
              "Anda bertanggung jawab atas akun sosial yang Anda hubungkan dan atas kepatuhan terhadap ketentuan tiap platform (Instagram, Threads, TikTok, dan lainnya). Layanan adalah alat; keputusan publikasi dan konsekuensinya tetap menjadi milik Anda.",
            ],
          },
          {
            heading: "Akun, workspace, dan keamanan",
            points: [
              "Anda wajib memberikan informasi pendaftaran yang akurat dan menjaga kerahasiaan kredensial Anda.",
              "Anda bertanggung jawab atas semua aktivitas di workspace Anda dan atas perilaku anggota yang Anda undang.",
              "API key dan kredensial sesi yang Anda berikan (BYOK) disimpan terenkripsi; Anda bertanggung jawab atas validitasnya dan untuk mencabutnya bila tidak diperlukan.",
              "Segera beri tahu kami jika ada penggunaan akun Anda tanpa izin.",
            ],
          },
          {
            heading: "Langganan, penagihan, dan kredit Komenin AI",
            paragraphs: [
              "Plan berbayar dan add-on Komenin AI ditagih dalam Rupiah (IDR) lewat pemroses pembayaran kami (Midtrans). Harga ditampilkan saat checkout sebelum Anda membayar.",
              "Plan sosial memberikan batas kirim/publish untuk periode yang tertera. Komenin AI adalah add-on terpisah dengan tier langganan dan paket kredit pay-as-you-go (PAYG) sendiri.",
              "Kredit AI: 1 kredit setara 1 token (input + output), dihitung dari laporan usage model. Kuota langganan yang tidak terpakai tidak dibawa ke periode kuota berikutnya. Kredit PAYG berlaku 12 bulan sejak pembelian selama akun Anda aktif, setelah itu hangus.",
              "Perubahan tier berlaku pada periode kuota berikutnya (tanpa prorata). Kecuali diwajibkan hukum, pembayaran tidak dapat dikembalikan setelah entitlement atau kredit terkait telah diberikan; refund atau chargeback dapat membalikkan entitlement terkait beserta kredit yang belum terpakai.",
            ],
          },
          {
            heading: "Penggunaan yang dapat diterima",
            paragraphs: [
              "Anda wajib menggunakan Layanan sesuai AUP kami, hukum yang berlaku, dan aturan platform. Kami dapat menangguhkan atau menghentikan akses karena penyalahgunaan, spam, atau pelanggaran.",
            ],
          },
          {
            heading: "Kekayaan intelektual dan konten Anda",
            paragraphs: [
              "Anda tetap memiliki konten yang Anda buat. Anda memberi kami lisensi terbatas untuk memproses konten itu semata untuk menyediakan Layanan (misalnya, membuat draf atas permintaan Anda).",
              "Kami mempertahankan semua hak atas Layanan itu sendiri, termasuk perangkat lunak, desain, dan merek.",
            ],
          },
          {
            heading: "Penafian dan batasan tanggung jawab",
            paragraphs: [
              "Layanan disediakan \"sebagaimana adanya\" tanpa jaminan apa pun. Kami tidak menjamin konten hasil mematuhi kebijakan platform mana pun, atau bahwa Layanan akan tanpa gangguan atau bebas kesalahan.",
              "Sejauh diizinkan hukum, Komenin tidak bertanggung jawab atas kerugian tidak langsung, insidental, atau konsekuensial, maupun atas tindakan platform pihak ketiga (seperti penangguhan akun). Tanggung jawab agregat kami dibatasi pada jumlah yang Anda bayarkan kepada kami dalam 3 bulan sebelum klaim.",
            ],
          },
          {
            heading: "Perubahan dan kontak",
            paragraphs: [
              "Kami dapat memperbarui Syarat ini; perubahan material akan diberitahukan di aplikasi atau lewat email, dan penggunaan berkelanjutan setelah tanggal efektif berarti penerimaan.",
              "Pertanyaan tentang Syarat ini: gunakan halaman kontak.",
            ],
          },
        ],
      },
      aup: {
        title: "Kebijakan Penggunaan yang Dapat Diterima",
        subtitle: "Otomasi harus menghormati aturan platform, consent, dan rate limit.",
        updated: "Terakhir diperbarui: 2 September 2026",
        cta: "Kontak",
        href: "/contact",
        sections: [
          {
            heading: "Cakupan Kebijakan ini",
            paragraphs: [
              "Kebijakan Penggunaan yang Dapat Diterima (\"AUP\") ini mengatur cara Anda menggunakan Komenin (\"Layanan\") — aplikasi web, API publik, dan setiap tindakan otomatis yang dilakukan Layanan atas nama Anda, termasuk listener, penyusunan komentar, dan publikasi terjadwal.",
              "Kebijakan ini berlaku untuk semua anggota workspace Anda dan seluruh konten yang dikirim melalui akun yang terhubung. AUP ini melengkapi Syarat Layanan kami; istilah berkapital memiliki arti sebagaimana didefinisikan di sana.",
            ],
          },
          {
            heading: "Ikuti aturan platform yang terhubung",
            paragraphs: [
              "Akun Instagram, Threads, dan TikTok Anda tetap tunduk pada syarat, kebijakan otomasi, dan standar komunitas masing-masing platform. Komenin dirancang untuk beroperasi dalam batas tersebut — bukan melewatinya.",
            ],
            points: [
              "Hanya hubungkan akun yang Anda miliki atau yang secara eksplisit berwenang kepada Anda untuk dioperasikan.",
              "Hormati rate limit masing-masing platform dan biarkan delay, kuota, serta kontrol approval bawaan Layanan tetap aktif.",
              "Jangan gunakan Layanan untuk menghindari banned, pembatasan, verifikasi perangkat atau akun, atau penegakan aturan lain dari platform.",
            ],
          },
          {
            heading: "Konten yang dilarang",
            paragraphs: [
              "Anda tidak boleh mengirim, menjadwalkan, atau menyimpan melalui Layanan:",
            ],
            points: [
              "Konten yang melanggar hukum, atau yang melanggar hak kekayaan intelektual, privasi, atau hak lain pihak lain.",
              "Pelecehan, ujaran kebencian, ancaman, atau konten yang mengeksploitasi dan membahayakan anak di bawah umur.",
              "Malware, phishing, penipuan, atau skema yang dirancang untuk menipu pengguna maupun platform.",
              "Engagement yang menyesatkan — bot tanpa disclosure, persona palsu, serta ulasan atau testimoni yang tidak autentik.",
            ],
          },
          {
            heading: "Perilaku yang dilarang",
            points: [
              "Spam: komentar, balasan, atau pesan massal yang tidak diminta, atau kontak berulang kepada target yang sama.",
              "Manipulasi engagement: membeli, menjual, atau menggelembungkan followers, likes, atau komentar secara artifisial — termasuk jaringan bot dan engagement pod.",
              "Mengakali kontrol Layanan sendiri: melewati kuota, rate limit, alur approval, atau deteksi penyalahgunaan (misalnya dengan membuat workspace atau akun tambahan untuk menghindari batasan).",
              "Penyalahgunaan discovery: scraping atau pemantauan konten melampaui yang memang dirancang untuk listener dan API.",
              "Penyalahgunaan kredensial: menghubungkan sesi atau API key yang tidak berwenang kepada Anda, atau membagikannya melanggar kebijakan organisasi Anda.",
            ],
          },
          {
            heading: "Consent dan data pribadi",
            paragraphs: [
              "Otomasi outreach menyasar orang sungguhan. Anda bertanggung jawab memiliki dasar hukum yang sah atas interaksi yang Anda otomatisasi, serta menghormati permintaan berhenti (opt-out) dan penghapusan data.",
            ],
            points: [
              "Jangan mengumpulkan atau menyimpan data pribadi dari platform kecuali melalui fitur Layanan yang memang disediakan (inbox, leads, listener).",
              "Patuhi hukum privasi yang berlaku (termasuk UU PDP di Indonesia dan, bila relevan, GDPR) untuk data yang Anda proses melalui Layanan.",
            ],
          },
          {
            heading: "Penegakan",
            paragraphs: [
              "Kami menyelidiki dugaan pelanggaran. Bila memungkinkan, kami memberi tahu pemilik workspace dan menjelaskan apa yang perlu diperbaiki.",
            ],
            points: [
              "Kami dapat memberi peringatan, membatasi fitur, menghentikan sementara pengiriman, menangguhkan, atau mengakhiri workspace yang melanggar AUP ini.",
              "Pelanggaran serius — atau pelanggaran berulang setelah peringatan — dapat berujung penangguhan seketika.",
              "Laporkan pelanggaran atau ajukan pertanyaan tentang Kebijakan ini melalui halaman kontak.",
            ],
          },
        ],
      },
    },
    faq: {
      kicker: "FAQ",
      title: "Jawaban sebelum mulai",
      subtitle:
        "Detail jelas soal paket, AI posting, approval, dan dukungan platform.",
      items: [
        {
          q: "Paket apa saja yang tersedia?",
          a: "Hanya tiga: 1 bulan, 6 bulan, dan 12 bulan. Semakin panjang masa aktif, semakin rendah harga per bulan.",
        },
        {
          q: "Apakah AI bisa membuat postingan dari topik yang saya pilih?",
          a: "Ya. Di Auto Post Campaign, masukkan topik, tentukan jumlah post, dan atur interval (menit, jam, atau hari). Komenin generate draft lewat 9Router AI gateway.",
        },
        {
          q: "Apakah postingan langsung publish otomatis?",
          a: "Bisa pilih mode Approval required atau Auto. Mode approval tetap butuh review manusia sebelum dijadwalkan/dipublish.",
        },
        {
          q: "Platform apa yang didukung?",
          a: "Instagram, Threads, dan TikTok ada di model produk. Publish saat ini mendukung simulator mode dan live webhook.",
        },
        {
          q: "Bagaimana AI terhubung?",
          a: "Komenin mengarahkan generate lewat gateway OpenAI-compatible seperti 9Router. Auth provider (misalnya xAI build auth) tetap di 9Router.",
        },
        {
          q: "Apakah aman untuk operasi tim?",
          a: "Ya. RBAC workspace, secret terenkripsi, antrian approval, audit log, serta kontrol rate/delay sudah built-in.",
        },
      ],
    },
    cta: {
      title: "Siap menjalankan engagement ops yang terkendali?",
      subtitle:
        "Buat workspace, undang tim, dan mulai dengan otomasi approval-first.",
      startFree: "Mulai gratis",
      talkSales: "Hubungi sales",
    },
    footer: {
      blurb:
        "Control plane yang tenang untuk operasi engagement sosial enterprise.",
      product: "Produk",
      company: "Perusahaan",
      legal: "Legal",
      features: "Fitur",
      pricing: "Harga",
      security: "Keamanan",
      docs: "Dokumentasi",
      about: "Tentang",
      contact: "Kontak",
      enterprise: "Enterprise",
      privacy: "Privasi",
      terms: "Syarat",
      aup: "AUP",
    },
    docsUi: {
      brand: "Dokumentasi Komenin",
      brandShort: "Docs Komenin",
      home: "Beranda",
      tutorial: "Tutorial",
      api: "Referensi API",
      backToSite: "Kembali ke situs",
      browse: "Jelajahi docs",
      openMenu: "Buka menu docs",
      searchPlaceholder: "Cari dokumentasi...",
      noMatches: "Tidak ada hasil",
      previous: "Sebelumnya",
      next: "Berikutnya",
      copyPage: "Salin halaman",
      copied: "Disalin",
      needProductUi: "Butuh UI produk?",
      openCommandCenter: "Buka command center",
      homeTitle: "Dokumentasi Komenin",
      homeSubtitle:
        "Dua cara memakai Komenin: ikuti Tutorial untuk mengelola semuanya dari dashboard, atau gunakan Referensi API untuk membangun integrasi sendiri di sekitar worker, webhook, dan billing.",
      getStarted: "Mulai",
      apiReference: "Referensi API",
      quickStart: "Mulai Cepat",
      tutorialPath: "Jalur tutorial",
      tutorialPathBody:
        "Operator yang mengutamakan dashboard: akun, kampanye, persetujuan, agen, billing, dan admin.",
      openTutorial: "Buka Tutorial",
      integrationPath: "Jalur integrasi",
      integrationPathBody:
        "Engineer: job worker, webhook publish, notifikasi Midtrans, dan endpoint SSO.",
      openWorkerApi: "Buka API Worker",
      cards: [
        {
          href: "/docs/tutorial/introduction",
          title: "Mulai",
          body: "Baru di Komenin? Pelajari konsep inti dan apa saja yang bisa dikelola dari satu workspace.",
        },
        {
          href: "/docs/tutorial/connectors",
          title: "Konektor Hybrid",
          body: "Gunakan simulator untuk demo, webhook untuk operasi live, dan adapter resmi saat kredensial tersedia.",
        },
        {
          href: "/docs/tutorial/campaigns",
          title: "Siapkan Otomasi",
          body: "Jalankan kampanye komentar, persetujuan, pengiriman berirama, dan jadwal auto-post dengan guardrail.",
        },
        {
          href: "/docs/tutorial/agents",
          title: "Inteligensi Agen",
          body: "Persona, pengambilan knowledge, memori, dan draf playground sebelum apa pun dipublikasikan.",
        },
        {
          href: "/docs/api",
          title: "Referensi API",
          body: "Picu worker, terima webhook publish, dan tangani notifikasi billing Midtrans.",
        },
        {
          href: "/docs/tutorial/security",
          title: "Keamanan & Kontrol",
          body: "Rahasia terenkripsi, RBAC, persetujuan-by-default, batas penggunaan, dan ekspor audit.",
        },
        {
          href: "/docs/tutorial/golden-path",
          title: "Demo Golden Path",
          body: "Jalankan loop simulator penuh dari signup hingga send/publish ber-audit sebelum live.",
        },
        {
          href: "/docs/tutorial/command-center",
          title: "Command Center",
          body: "Pelajari apa yang dicek harian di /app dan ke mana klik berikutnya saat ada degradasi.",
        },
        {
          href: "/docs/tutorial/troubleshooting",
          title: "Pemecahan Masalah",
          body: "Perbaiki loop auth, inbox kosong, worker 401, error fail-closed live, dan status billing pending.",
        },
        {
          href: "/docs/tutorial/faq",
          title: "FAQ",
          body: "Jawaban singkat tentang simulator vs live, persetujuan, Midtrans, worker, SSO, dan akses admin.",
        },
      ],
    },
  },
} as const;

export type Messages = (typeof messages)["en"];
