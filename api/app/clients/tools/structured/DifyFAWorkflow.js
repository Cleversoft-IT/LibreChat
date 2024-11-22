const axios = require('axios').default;
const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('~/config');

class DifyFAWorkflow extends Tool {
  constructor(fields) {
    super();
    this.override = fields.override ?? false;

    this.difyWorkflowUrl = this.getEnvVariable('DIFY_API_WORKFLOW_URL');

    this.schema = z.object({});


  }

  getEnvVariable(varName) {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing ${varName} environment variable.`);
    }
    return value;
  }


  // eslint-disable-next-line no-unused-vars
  async _call(query, _runManager) {
  //  async _call({ query }, _runManager) {

  logger.info(`[DifyFAWorkflowAPI] Query: ${JSON.stringify(query)}`);

    const body = {
      inputs: query,
      response_mode: 'blocking',
      user: 'ForMe_Supervisor'
    }

    let url = this.difyWorkflowUrl;
    logger.info(`[DifyFAWorkflowAPI] Querying Dify: ${url}`);
    logger.info(`[DifyFAWorkflowAPI] Body: ${JSON.stringify(body)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.difyWorkflowApiKey}`
        },
        
        body: JSON.stringify(body)
      });

    // Get json from response
    const json = await response.json();

    // Log response
    logger.info(`[DifyFAWorkflowAPI] Response json: ${JSON.stringify(json)}`);

    return json.data.outputs.output;

    } catch (error) {
      logger.error('[DifyFAWorkflowAPI] API request failed', error);
      return `[DifyFAWorkflowAPI] API request failed: ${error.message}`;
    }
  }

}

module.exports = DifyFAWorkflow;
