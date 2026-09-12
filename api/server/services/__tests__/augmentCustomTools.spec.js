const fs = require('node:fs');
const path = require('node:path');

const mockGetCachedTools = jest.fn();
const mockSetCachedTools = jest.fn();
jest.mock('~/server/services/Config', () => ({
  getEndpointsConfig: jest.fn(),
  getMCPServerTools: jest.fn(),
  getCachedTools: (...args) => mockGetCachedTools(...args),
  setCachedTools: (...args) => mockSetCachedTools(...args),
}));
jest.mock('@librechat/api', () => ({
  ...jest.requireActual('@librechat/api'),
  loadToolDefinitions: jest.fn(),
  getUserMCPAuthMap: jest.fn(),
  sendEvent: jest.fn(),
  GenerationJobManager: { emitChunk: jest.fn() },
  resolveCodeExecutionContext: jest.fn(),
}));
jest.mock('~/app/clients/tools/util', () => ({ loadTools: jest.fn() }));
jest.mock('~/server/services/Tools/credentials', () => ({
  loadAuthValues: jest.fn().mockResolvedValue({}),
}));
jest.mock('~/server/services/Tools/search', () => ({ createOnSearchResults: jest.fn() }));
jest.mock('~/server/services/Tools/mcp', () => ({ reinitMCPServer: jest.fn() }));
jest.mock('~/server/services/Files/process', () => ({
  processFileURL: jest.fn(),
  uploadImageBuffer: jest.fn(),
}));
jest.mock('~/app/clients/tools/util/fileSearch', () => ({ primeFiles: jest.fn() }));
jest.mock('~/server/services/Files/Code/process', () => ({ primeFiles: jest.fn() }));
jest.mock('../ActionService', () => ({
  loadActionSets: jest.fn(),
  decryptMetadata: jest.fn(),
  createActionTool: jest.fn(),
  domainParser: jest.fn(),
  legacyDomainEncode: jest.fn(),
}));
jest.mock('~/server/services/Threads', () => ({ recordUsage: jest.fn() }));
jest.mock('~/models', () => ({ findPluginAuthsByKeys: jest.fn() }));
jest.mock('~/config', () => ({
  getFlowStateManager: jest.fn(() => ({ getFlowState: jest.fn() })),
  getMCPServersRegistry: jest.fn(() => ({ getServerConfig: jest.fn() })),
}));
jest.mock('~/server/services/MCP', () => ({
  resolveConfigServers: jest.fn(),
  resolveMcpServerNames: jest.fn(),
  resolveMcpServerContext: jest.fn(),
  resolveCollisionAuditNames: jest.fn(),
  createMCPPermissionContext: jest.fn(),
  userCanUseMCPServers: jest.fn(),
}));
jest.mock('~/cache', () => ({ getLogStores: jest.fn(() => ({})) }));

const { logger } = require('@librechat/data-schemas');
const { augmentWithCustomToolDefs } = require('../ToolService');

const FA_TOOL = 'drupal_fa_api';
const systemTools = {
  [FA_TOOL]: {
    type: 'function',
    function: {
      name: FA_TOOL,
      description: 'Drupal Forma Aquae',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    },
  },
};

function buildArgs(overrides = {}) {
  return {
    filteredTools: [FA_TOOL, 'web_search', 'some_action_mcp_tool'],
    toolDefinitions: [],
    toolRegistry: new Map([['web_search', { name: 'web_search' }]]),
    appConfig: { availableTools: systemTools },
    ...overrides,
  };
}

describe('augmentWithCustomToolDefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('adds manifest-only tools from the cached system tools (cache hit)', async () => {
    mockGetCachedTools.mockResolvedValue(systemTools);
    const args = buildArgs();

    await augmentWithCustomToolDefs(args);

    expect(mockSetCachedTools).not.toHaveBeenCalled();
    expect(args.toolDefinitions).toEqual([
      {
        name: FA_TOOL,
        description: 'Drupal Forma Aquae',
        parameters: systemTools[FA_TOOL].function.parameters,
      },
    ]);
    expect(args.toolRegistry.get(FA_TOOL)).toMatchObject({
      name: FA_TOOL,
      allowed_callers: ['direct'],
    });
    expect(args.toolRegistry.has('some_action_mcp_tool')).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('re-populates the cache from appConfig.availableTools when the cache expired', async () => {
    mockGetCachedTools.mockResolvedValue(null);
    mockSetCachedTools.mockResolvedValue(true);
    const args = buildArgs();

    await augmentWithCustomToolDefs(args);

    expect(mockSetCachedTools).toHaveBeenCalledTimes(1);
    expect(mockSetCachedTools).toHaveBeenCalledWith(systemTools);
    expect(args.toolDefinitions.map((def) => def.name)).toEqual([FA_TOOL]);
    expect(args.toolRegistry.has(FA_TOOL)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('re-initializing from app config'),
    );
  });

  it('warns and adds nothing when both the cache and appConfig are empty', async () => {
    mockGetCachedTools.mockResolvedValue(null);
    const args = buildArgs({ appConfig: undefined });

    await augmentWithCustomToolDefs(args);

    expect(mockSetCachedTools).not.toHaveBeenCalled();
    expect(args.toolDefinitions).toEqual([]);
    expect(args.toolRegistry.has(FA_TOOL)).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('custom tools skipped'));
  });
});

describe('augmentWithCustomToolDefs call sites', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'ToolService.js'), 'utf8');
  const calls = [...source.matchAll(/await augmentWithCustomToolDefs\(\{([\s\S]*?)\}\);/g)];

  it('is invoked exactly twice (after loadToolDefinitions and after the OAuth reload)', () => {
    expect(calls).toHaveLength(2);
  });

  it.each([0, 1])('call site %i passes the collision-filtered tools and the app config', (index) => {
    const args = calls[index][1];
    expect(args).toMatch(/filteredTools:\s*defsFilteredTools/);
    expect(args).toMatch(/appConfig:\s*req\.config/);
    expect(args).toMatch(/\btoolDefinitions\b/);
    expect(args).toMatch(/\btoolRegistry\b/);
  });
});
