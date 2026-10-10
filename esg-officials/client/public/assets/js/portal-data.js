// ESG ClientOS — mock data (prototype only, no backend)
const PORTAL_DATA = {

  client: {
    name: 'Café Mysa',
    engagement: 'Marketing & Brand Engagement 2026',
    initials: 'CM',
  },

  user: {
    name: 'Aditi Rao',
    role: 'Client Admin',
    initials: 'AR',
  },

  accountManager: {
    name: 'Kabir Shah',
    role: 'Senior Account Manager, ESG Officials',
    email: 'kabir.shah@esgofficials.com',
    availability: 'Usually replies within a few hours',
    initials: 'KS',
  },

  health: {
    score: 87,
    status: 'healthy', // excellent | healthy | attention | risk
    breakdown: [
      { label: 'Delivery Progress', weight: 30, value: 90 },
      { label: 'Milestone Progress', weight: 20, value: 85 },
      { label: 'Client Responsiveness', weight: 15, value: 78 },
      { label: 'Approval Health', weight: 15, value: 88 },
      { label: 'Reporting', weight: 10, value: 95 },
      { label: 'Strategic Progress', weight: 10, value: 80 },
    ],
    byService: [
      { key: 'brand-strategy', name: 'Brand Strategy', value: 92 },
      { key: 'content', name: 'Content', value: 84 },
      { key: 'gbp', name: 'Google Business Profile', value: 91 },
      { key: 'whatsapp', name: 'WhatsApp Marketing', value: 78 },
      { key: 'performance', name: 'Performance Marketing', value: 89 },
      { key: 'research', name: 'Market Research', value: 96 },
      { key: 'founder', name: 'Founder Branding', value: 73 },
    ],
  },

  actionRequired: [
    { text: 'Approve the August Content Calendar', view: 'service/content' },
    { text: 'Upload the updated menu (PDF or photos)', view: 'vault' },
    { text: 'Review the Brand Positioning Document', view: 'service/brand-strategy' },
  ],

  kpis: [
    { label: 'Reach (30d)', value: '48.2K', delta: '+12.4%', up: true },
    { label: 'Engagement Rate', value: '6.1%', delta: '+0.8pt', up: true },
    { label: 'GBP Calls', value: '212', delta: '+18%', up: true },
    { label: 'WhatsApp Leads', value: '64', delta: '-4%', up: false },
  ],

  timeline: [
    { label: 'Discovery', status: 'done' },
    { label: 'Strategy', status: 'done' },
    { label: 'Positioning', status: 'done' },
    { label: 'Content System', status: 'done' },
    { label: 'Campaign Development', status: 'current' },
    { label: 'Client Approval', status: 'upcoming' },
    { label: 'Launch', status: 'upcoming' },
    { label: 'Performance Review', status: 'upcoming' },
  ],

  calendarEvents: [
    { date: '2026-08-18', title: 'Reel 04 shoot — rooftop seating', type: 'meeting' },
    { date: '2026-08-19', title: 'August Content Calendar due', type: 'deadline' },
    { date: '2026-08-21', title: 'Strategy workshop — Q4 positioning', type: 'meeting' },
    { date: '2026-08-24', title: 'GBP monthly report published', type: 'publish' },
    { date: '2026-08-27', title: 'WhatsApp festive campaign live', type: 'publish' },
    { date: '2026-08-29', title: 'Brand Positioning Doc — review deadline', type: 'deadline' },
  ],

  recentDeliverables: [
    { title: 'August Content Calendar', service: 'Content', status: 'client_review', date: 'Aug 14, 2026' },
    { title: 'Brand Positioning Document v2.1', service: 'Brand Strategy', status: 'client_review', date: 'Aug 13, 2026' },
    { title: 'Reel 03 — "Second Kitchen" campaign', service: 'Content', status: 'published', date: 'Aug 10, 2026' },
    { title: 'GBP Photo Set — Interior Refresh', service: 'Google Business Profile', status: 'approved', date: 'Aug 8, 2026' },
    { title: 'July Performance Report', service: 'Performance Marketing', status: 'completed', date: 'Aug 2, 2026' },
  ],

  reports: [
    { title: 'July Monthly Performance Report', category: 'Monthly Reports', period: 'Jul 1 – Jul 31, 2026', preparedBy: 'Kabir Shah', date: 'Aug 2, 2026', summary: 'Reach and engagement up across all channels; WhatsApp lead volume softened due to a paused festive campaign, resuming in August.' },
    { title: 'Q2 2026 Strategy Review', category: 'Strategy Reviews', period: 'Apr 1 – Jun 30, 2026', preparedBy: 'Priya Menon', date: 'Jul 10, 2026', summary: 'Positioning work from Q2 is translating into stronger repeat-visit signals; recommend carrying the "second kitchen" narrative into Q3 content.' },
    { title: 'Brand Health Study — Neighbourhood Recall', category: 'Brand Reports', period: 'Jun 2026', preparedBy: 'ESG Research Team', date: 'Jun 28, 2026', summary: 'Unprompted recall within 1km radius improved meaningfully since the identity refresh; full findings in the attached report.' },
    { title: 'Reel Campaign — "Second Kitchen" Wrap Report', category: 'Campaign Reports', period: 'Jun 15 – Jul 15, 2026', preparedBy: 'Kabir Shah', date: 'Jul 18, 2026', summary: 'Best-performing campaign of the engagement to date by saves and shares; recommend a follow-on series.' },
    { title: 'Consumer Interviews — Regulars vs. First-Time Visitors', category: 'Research Reports', period: 'May 2026', preparedBy: 'ESG Research Team', date: 'May 30, 2026', summary: 'Confirms the "routine, not just menu" insight underpinning current positioning.' },
  ],

  notifications: [
    { text: 'ESG uploaded a new version of the Brand Positioning Document', meta: '2 hours ago' },
    { text: 'Kabir Shah commented on Reel 04 script', meta: 'Yesterday' },
    { text: 'August Content Calendar is ready for your review', meta: 'Yesterday' },
    { text: 'July Monthly Performance Report is available', meta: '2 days ago' },
    { text: 'Reminder: Brand Positioning Document review deadline is Aug 29', meta: '2 days ago' },
  ],

  vault: {
    folders: [
      { key: 'brand-assets', name: 'Brand Assets', count: 18 },
      { key: 'business-docs', name: 'Business Documents', count: 9 },
      { key: 'photography', name: 'Photography', count: 64 },
      { key: 'videography', name: 'Videography', count: 21 },
      { key: 'marketing-assets', name: 'Marketing Assets', count: 37 },
      { key: 'strategy', name: 'Strategy', count: 12 },
      { key: 'client-uploads', name: 'Client Uploads', count: 6 },
      { key: 'esg-deliverables', name: 'ESG Deliverables', count: 29 },
    ],
    files: {
      'brand-assets': [
        { name: 'Mysa_Logo_Primary.svg', size: '18 KB', updated: 'Jul 2, 2026' },
        { name: 'Mysa_Brand_Guidelines_v2.pdf', size: '4.2 MB', updated: 'Jun 20, 2026' },
        { name: 'Mysa_Colour_Palette.pdf', size: '1.1 MB', updated: 'Jun 20, 2026' },
      ],
      'business-docs': [
        { name: 'Mysa_Menu_Summer2026.pdf', size: '2.4 MB', updated: 'Jun 1, 2026' },
        { name: 'Pricing_Sheet_2026.xlsx', size: '340 KB', updated: 'May 12, 2026' },
      ],
      photography: [
        { name: 'Interior_Refresh_Set_01.zip', size: '86 MB', updated: 'Aug 8, 2026' },
        { name: 'Founder_Portraits_2026.zip', size: '54 MB', updated: 'Jul 15, 2026' },
      ],
      videography: [
        { name: 'Reel03_Final_Export.mp4', size: '112 MB', updated: 'Aug 10, 2026' },
        { name: 'Reel04_Raw_Footage.mov', size: '640 MB', updated: 'Aug 18, 2026' },
      ],
      'marketing-assets': [
        { name: 'August_Campaign_Creatives.zip', size: '48 MB', updated: 'Aug 12, 2026' },
      ],
      strategy: [
        { name: 'Brand_Positioning_Document_v2.1.pdf', size: '1.8 MB', updated: 'Aug 13, 2026' },
        { name: 'ESG_Discovery_Findings.pdf', size: '3.1 MB', updated: 'Apr 18, 2026' },
      ],
      'client-uploads': [
        { name: 'Updated_Menu_Draft.pdf', size: '1.2 MB', updated: 'Aug 5, 2026' },
      ],
      'esg-deliverables': [
        { name: 'August_Content_Calendar.pdf', size: '2.0 MB', updated: 'Aug 14, 2026' },
        { name: 'July_Performance_Report.pdf', size: '2.6 MB', updated: 'Aug 2, 2026' },
      ],
    },
  },

  approvals: [
    {
      id: 'appr-1',
      title: 'August Content Calendar',
      service: 'Content',
      version: 'V1.0',
      submittedBy: 'Priya Menon',
      submittedDate: 'Aug 14, 2026',
      deadline: 'Aug 19, 2026',
      status: 'pending',
    },
    {
      id: 'appr-2',
      title: 'Brand Positioning Document',
      service: 'Brand Strategy',
      version: 'V2.1',
      submittedBy: 'Kabir Shah',
      submittedDate: 'Aug 13, 2026',
      deadline: 'Aug 29, 2026',
      status: 'pending',
    },
    {
      id: 'appr-3',
      title: 'Reel 04 Script — Rooftop Seating',
      service: 'Content',
      version: 'V1.2',
      submittedBy: 'Priya Menon',
      submittedDate: 'Aug 11, 2026',
      deadline: 'Aug 16, 2026',
      status: 'pending',
    },
    {
      id: 'appr-4',
      title: 'GBP Photo Set — Interior Refresh',
      service: 'Google Business Profile',
      version: 'V1.0',
      submittedBy: 'Rahul Nair',
      submittedDate: 'Aug 6, 2026',
      deadline: 'Aug 8, 2026',
      status: 'approved',
      approvedBy: 'Aditi Rao',
      approvedDate: 'Aug 8, 2026, 4:12 PM',
    },
    {
      id: 'appr-5',
      title: 'Reel 03 — "Second Kitchen" Campaign',
      service: 'Content',
      version: 'V1.1',
      submittedBy: 'Priya Menon',
      submittedDate: 'Aug 2, 2026',
      deadline: 'Aug 6, 2026',
      status: 'approved',
      approvedBy: 'Aditi Rao',
      approvedDate: 'Aug 5, 2026, 11:03 AM',
    },
  ],

  // -------- Service Workspaces --------
  services: {
    'brand-strategy': {
      name: 'Brand Strategy',
      description: 'Positioning, messaging, identity, research, and competitive analysis for Café Mysa.',
      modules: ['Discovery', 'Research', 'Competitive Analysis', 'Positioning', 'Brand Architecture', 'Brand Messaging', 'Strategy Documents', 'Workshops', 'Approvals', 'Milestones'],
      milestones: [
        { label: 'Discovery', status: 'done' },
        { label: 'Research', status: 'done' },
        { label: 'Positioning', status: 'done' },
        { label: 'Messaging System', status: 'current' },
        { label: 'Brand Architecture', status: 'upcoming' },
        { label: 'Final Sign-off', status: 'upcoming' },
      ],
      documents: [
        { title: 'Brand Positioning Document', version: 'V2.1', status: 'client_review', date: 'Aug 13, 2026' },
        { title: 'Competitive Analysis — Neighbourhood Cafés', version: 'V1.0', status: 'approved', date: 'Jul 22, 2026' },
        { title: 'ESG Discovery Findings', version: 'V1.0', status: 'completed', date: 'Apr 18, 2026' },
      ],
    },
    content: {
      name: 'Content',
      description: 'Content strategy, calendar, production, and performance across reels, posts, and stories.',
      modules: ['Content Strategy', 'Content Calendar', 'Reels', 'Static Posts', 'Stories', 'Scripts', 'Shoots', 'Editing', 'Design', 'Approval', 'Publishing', 'Performance'],
      pieces: [
        { title: 'Reel 04 — Rooftop Seating Launch', type: 'Reel', stage: 3, },
        { title: 'Reel 03 — "Second Kitchen" Campaign', type: 'Reel', stage: 8, },
        { title: 'Static Post — Weekend Brunch Menu', type: 'Static Post', stage: 5, },
        { title: 'Story Series — Behind the Counter', type: 'Stories', stage: 6, },
        { title: 'Reel 02 — Founder Introduction', type: 'Reel', stage: 8, },
      ],
      stages: ['Planning', 'Scripting', 'Production', 'Internal Review', 'Client Review', 'Approved', 'Scheduled', 'Published'],
    },
    gbp: {
      name: 'Google Business Profile',
      description: 'Profile optimization, posts, photos, reviews, and local search performance.',
      modules: ['Profile Optimization', 'Posts', 'Photos', 'Reviews', 'Review Responses', 'Local SEO', 'Search Performance'],
      metrics: [
        { label: 'Searches (30d)', value: '9,420', delta: '+9%', up: true },
        { label: 'Calls', value: '212', delta: '+18%', up: true },
        { label: 'Direction Requests', value: '486', delta: '+6%', up: true },
        { label: 'Website Clicks', value: '1,120', delta: '+3%', up: true },
        { label: 'Average Rating', value: '4.7', delta: '+0.1', up: true },
        { label: 'New Reviews', value: '23', delta: '-2', up: false },
      ],
    },
    whatsapp: {
      name: 'WhatsApp Marketing',
      description: 'Campaign planning, audience segments, creatives, and performance for WhatsApp outreach.',
      modules: ['Campaign Planning', 'Audience Segments', 'Campaigns', 'Creatives', 'Copy', 'Approval', 'Scheduling', 'Delivery', 'Engagement', 'Leads', 'Conversion'],
      campaigns: [
        { name: 'Festive Weekend Offer', status: 'scheduled', sent: 4200, delivered: 4108, read: 3012, leads: 64 },
        { name: 'New Menu Announcement', status: 'completed', sent: 3800, delivered: 3755, read: 2890, leads: 51 },
        { name: 'Loyalty Programme Invite', status: 'in_progress', sent: 1500, delivered: 1480, read: 940, leads: 22 },
      ],
    },
    performance: {
      name: 'Performance Marketing',
      description: 'Paid campaigns across platforms, with spend, leads, and ROAS tracked against targets.',
      modules: ['Campaigns', 'Platforms', 'Objectives', 'Budgets', 'Creatives', 'Audiences', 'Leads', 'ROAS'],
      campaigns: [
        { name: 'Meta — Neighbourhood Awareness', platform: 'Meta Ads', objective: 'Reach', budget: '₹45,000', status: 'active', cpc: '₹6.80', ctr: '2.1%', leads: 38, roas: '3.2x' },
        { name: 'Google — Local Search', platform: 'Google Ads', objective: 'Calls & Directions', budget: '₹30,000', status: 'active', cpc: '₹11.20', ctr: '4.6%', leads: 52, roas: '4.1x' },
        { name: 'Meta — Weekend Brunch Promo', platform: 'Meta Ads', objective: 'Conversions', budget: '₹20,000', status: 'paused', cpc: '₹7.40', ctr: '1.8%', leads: 19, roas: '2.4x' },
      ],
    },
    research: {
      name: 'Market Research',
      description: 'Primary and secondary research underpinning positioning and experience decisions.',
      modules: ['Research Objectives', 'Data Collection', 'Interviews', 'Surveys', 'Competitive Research', 'Consumer Insights', 'Findings'],
      findings: [
        { title: 'Consumer Interviews — Regulars vs. First-Time Visitors', date: 'May 30, 2026', summary: 'Guests return for routine and familiarity as much as for the menu itself.' },
        { title: 'Brand Health Study — Neighbourhood Recall', date: 'Jun 28, 2026', summary: 'Unprompted recall within 1km improved meaningfully since the identity refresh.' },
        { title: 'Competitive Set Mapping', date: 'Apr 30, 2026', summary: 'Five direct competitors identified within 1.5km; none own a clear "daily routine" positioning.' },
      ],
    },
    founder: {
      name: 'Founder Branding',
      description: 'Positioning, content, and thought leadership built around the founder\u2019s own voice.',
      modules: ['Positioning', 'Content Strategy', 'LinkedIn', 'Instagram', 'Thought Leadership', 'Speaking Opportunities'],
      pieces: [
        { title: 'LinkedIn — "Why We Redesigned Our Menu Language"', status: 'client_review', date: 'Aug 12, 2026' },
        { title: 'Instagram — Founder Q&A Series', status: 'in_progress', date: 'Aug 15, 2026' },
        { title: 'Local Business Podcast — Guest Appearance', status: 'scheduled', date: 'Sep 3, 2026' },
      ],
    },
  },
};
