const axios = require('axios').default;
const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('~/config');

class CloudFlareFA extends Tool {
  constructor(fields) {
    super();
    this.override = fields.override ?? false;

    this.cloudFlareApiKey = this.getEnvVariable('CLOUDFLARE_API_KEY');

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

  logger.info(`[CloudFlareFA] Query: ${JSON.stringify(query)}`);

    const body = query;

    let url = this.cloudFlareUrl;
    logger.info(`[CloudFlareFA] Querying CloudFlare: ${url}`);
    logger.info(`[CloudFlareFA] Body: ${JSON.stringify(body)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cloudFlareApiKey}`
        },
        
        body: JSON.stringify(body)
      });


    // Get json from response
    const text = await response.text();

    return text;

    } catch (error) {
      logger.error('[CloudFlareFA] API request failed', error);
      return `[CloudFlareFA] API request failed: ${error.message}`;
    }
  }

}

module.exports = CloudFlareFA;
