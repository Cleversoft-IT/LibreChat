const manifest = require('./manifest');

// Structured Tools
const DALLE3 = require('./structured/DALLE3');
const FluxAPI = require('./structured/FluxAPI');
const OpenWeather = require('./structured/OpenWeather');
const StructuredWolfram = require('./structured/Wolfram');
const createYouTubeTools = require('./structured/YouTube');
const StructuredACS = require('./structured/AzureAISearch');
const StructuredSD = require('./structured/StableDiffusion');
const GoogleSearchAPI = require('./structured/GoogleSearch');
const TraversaalSearch = require('./structured/TraversaalSearch');
const createOpenAIImageTools = require('./structured/OpenAIImageTools');
const TavilySearchResults = require('./structured/TavilySearchResults');
const DrupalFAAPI = require('./structured/DrupalFA');
const VtigerFAAPI = require('./structured/VtigerFA');
const AiTrainerFA = require('./structured/AiTrainerFA');
const GOFAAPI = require('./structured/GOFA');
const MarketingFAAPI = require('./structured/MarketingFA');
const ManagedFilesFAAPI = require('./structured/ManagedFilesFA');
const VtigerWorkflowFAAPI = require('./structured/VtigerWorkflowFA');
const GOWorkflowFAAPI = require('./structured/GOWorkflowFA');
const CreateFeedbackWorkflowAPI = require('./structured/CreateFeedbackWorkflow');
const ReorderCalculator = require('./structured/ReorderCalculator');
const ProcedureFAAPI = require('./structured/ProcedureFA');
const GOTablesFAAPI = require('./structured/GOTablesFA');
const CreateProcedureFA = require('./structured/CreateProcedureFA');

module.exports = {
  ...manifest,
  // Structured Tools
  DALLE3,
  FluxAPI,
  OpenWeather,
  StructuredSD,
  StructuredACS,
  GoogleSearchAPI,
  TraversaalSearch,
  StructuredWolfram,
  createYouTubeTools,
  TavilySearchResults,
  DrupalFAAPI,
  VtigerFAAPI,
  AiTrainerFA,
  GOFAAPI,
  MarketingFAAPI,
  ManagedFilesFAAPI,
  VtigerWorkflowFAAPI,
  GOWorkflowFAAPI,
  CreateFeedbackWorkflowAPI,
  ReorderCalculator,
  ProcedureFAAPI,
  GOTablesFAAPI,
  createOpenAIImageTools,
  CreateProcedureFA,
};
