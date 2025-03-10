const availableTools = require('./manifest.json');

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
const ReorderCalculator = require('./structured/ReorderCalculator');

/** @type {Record<string, TPlugin | undefined>} */
const manifestToolMap = {};

/** @type {Array<TPlugin>} */
const toolkits = [];

availableTools.forEach((tool) => {
  manifestToolMap[tool.pluginKey] = tool;
  if (tool.toolkit === true) {
    toolkits.push(tool);
  }
});

module.exports = {
  toolkits,
  availableTools,
  manifestToolMap,
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
  RetrievalFAAPI,
  VtigerWorkflowFAAPI,
  GOWorkflowFAAPI,
  CreateFeedbackWorkflowAPI,
  ReorderCalculator,
};
