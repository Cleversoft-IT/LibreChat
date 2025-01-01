const availableTools = require('./manifest.json');

// Structured Tools
const DALLE3 = require('./structured/DALLE3');
const StructuredWolfram = require('./structured/Wolfram');
const StructuredACS = require('./structured/AzureAISearch');
const StructuredSD = require('./structured/StableDiffusion');
const GoogleSearchAPI = require('./structured/GoogleSearch');
const TraversaalSearch = require('./structured/TraversaalSearch');
const TavilySearchResults = require('./structured/TavilySearchResults');
const DrupalFAAPI = require('./structured/DrupalFA');
const VtigerFAAPI = require('./structured/VtigerFA');
const AiTrainerFA = require('./structured/AiTrainerFA');
const GOFAAPI = require('./structured/GOFA');
const MarketingFAAPI = require('./structured/MarketingFA');
const RetrievalFAAPI = require('./structured/RetrievalFA');
const VtigerWorkflowFAAPI = require('./structured/VtigerWorkflowFA');
const GOWorkflowFAAPI = require('./structured/GOWorkflowFA');
const CreateFeedbackWorkflowAPI = require('./structured/CreateFeedbackWorkflow');

module.exports = {
  availableTools,
  // Structured Tools
  DALLE3,
  StructuredSD,
  StructuredACS,
  GoogleSearchAPI,
  TraversaalSearch,
  StructuredWolfram,
  TavilySearchResults,
  TraversaalSearch,
  DrupalFAAPI,
  VtigerFAAPI,
  AiTrainerFA,
  GOFAAPI,
  MarketingFAAPI,
  RetrievalFAAPI,
  VtigerWorkflowFAAPI,
  GOWorkflowFAAPI,
  CreateFeedbackWorkflowAPI,
};
