export const CONFIG = {
  // exposed intentionally, to avoid vercel routing; dont abuse it (read-only access; will stop API for an hour if limit reached).
  githubToken: '',           
  username: 'DeboJP',

  contact: {
    linkedin: 'https://www.linkedin.com/in/debojp/',
    email: 'mailto:debojyotipaul@gmail.com',
    github: 'https://github.com/DeboJP'
  },

  about: {
    html: `
      <p>Hi — I’m Debo Jyoti Paul. I’m a computer science & data science student from the Pacific Northwest with a passion for health, technology and sustainability. Outside of coding I love volunteering, working with local charities and exploring how technology can be used for social good. My work ranges from community projects to research and technology initiatives.</p>
      <p>This project auto serves my GitHub work with a clean, hopefully low-latency UI. Highlights live at the very top; the full catalog is also searchable below that. Open any repo to dive into docs, demos, or live links.</p>
      <p>Feel free to check out my work and get in touch!</p>
    `
  },

  includeRepos: [],
  excludeRepos: [],

  featured: {
    title: 'Featured',
    description: 'Flagship projects front and center.',
    repos: ['QLoRA-Fine-Tuning-FLAN-T5-Large-for-Stance-Classification-An-Exploration','Calendar-Gmail-Agent-Scheduler','Ad-Recommender-w-LLM-CTR-scoring-via-MCP-interface-','Cosmos-Agentic-RAG-Task-Automation-Tool','dolly_email_assistant']
  },

  spotlights: [
    { title: 'Web & Apps', description: 'Frontend & full‑stack.', filter: { language: ['JavaScript','TypeScript','HTML','CSS'] } }
  ],

  readmeStrategy: 'fast',
  cacheTtlMs: 30 * 60 * 1000
};
