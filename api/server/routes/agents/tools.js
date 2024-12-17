const express = require('express');
<<<<<<< HEAD
const { getAvailableTools } = require('~/server/controllers/PluginController');
const { verifyToolAuth } = require('~/server/controllers/tools');
=======
const { callTool, verifyToolAuth, getToolCalls } = require('~/server/controllers/tools');
const { getAvailableTools } = require('~/server/controllers/PluginController');
const { toolCallLimiter } = require('~/server/middleware/limiters');
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5

const router = express.Router();

/**
 * Get a list of available tools for agents.
 * @route GET /agents/tools
 * @returns {TPlugin[]} 200 - application/json
 */
router.get('/', getAvailableTools);

/**
<<<<<<< HEAD
=======
 * Get a list of tool calls.
 * @route GET /agents/tools/calls
 * @returns {ToolCallData[]} 200 - application/json
 */
router.get('/calls', getToolCalls);

/**
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
 * Verify authentication for a specific tool
 * @route GET /agents/tools/:toolId/auth
 * @param {string} toolId - The ID of the tool to verify
 * @returns {{ authenticated?: boolean; message?: string }}
 */
router.get('/:toolId/auth', verifyToolAuth);

<<<<<<< HEAD
=======
/**
 * Execute code for a specific tool
 * @route POST /agents/tools/:toolId/call
 * @param {string} toolId - The ID of the tool to execute
 * @param {object} req.body - Request body
 * @returns {object} Result of code execution
 */
router.post('/:toolId/call', toolCallLimiter, callTool);

>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
module.exports = router;
