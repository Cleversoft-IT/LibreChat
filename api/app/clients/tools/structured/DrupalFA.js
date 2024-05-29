const { OpenAI } = require("openai");
const axios = require('axios');

const { z } = require('zod');
const { StructuredTool } = require('langchain/tools');
const { logger } = require('~/config');

class DrupalFAAPI extends StructuredTool {
  constructor(fields) {
    super();

    this.override = fields.override ?? false;
    this.name = 'drupal_fa_api';

    this.apiKey = this.getEnvVariable('DRUPAL_FA_API_KEY');
    this.apiBaseURL = this.getEnvVariable('DRUPAL_FA_API_BASE_URL');
    this.openaiApiKey = this.getEnvVariable('OPENAI_API_KEY');
    this.agentAssistantId = this.getEnvVariable('DRUPAL_AGENT_ASSISTANT_ID');

    this.description_for_model = `Give a prompt for another assistant to retrieve the query string. For example, "Find the latest articles about climate change."`;
    this.description = `A tool for querying the Drupal FA API. The input should be a prompt for the assistant to retrieve the query string. The output will be the raw text response from the API.`;

    this.schema = z.object({
      input: z.string().describe('Natural language query to Drupal following the guidelines'),
    });

    this.openai = new OpenAI({
      apiKey: this.openaiApiKey,
    });
  }

  async fetchRawText(url) {
    try {
      const response = await axios.get(url, { responseType: 'text' });
      return response;
    } catch (error) {
      logger.error('[DrupalFAAPI] Error fetching raw text:', error);
      throw error;
    }
  }

  getEnvVariable(varName) {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing ${varName} environment variable.`);
    }
    return value;
  }

  async createThread() {
    try {
      const thread = await this.openai.beta.threads.create();
      return thread;
    } catch (error) {
      logger.error('[DrupalFAAPI] Error creating thread:', error);
      throw error;
    }
  }

  async addMessageToThread(threadId, content) {
    try {
      logger.info(`[DrupalFAAPI] Adding message to thread: ${content}`);
      await this.openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: content,
      });
    } catch (error) {
      logger.error(`[DrupalFAAPI] Error adding message to thread: ${content}`, error);
      throw error;
    }
  }

  async runAssistant(threadId) {
    try {
      const response = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: this.agentAssistantId,
      });
      return response.id;
    } catch (error) {
      logger.error('[DrupalFAAPI] Error running assistant:', error);
      throw error;
    }
  }

  async getAssistantResponse(threadId, runId) {
    // TODO: Implement function call to check responde status by the agent
    // https://mer.vin/2023/11/assistants-api-function-calling-in-node-js/
    try {
      logger.info(`[DrupalFAAPI] Assistant threadId: ${threadId}`);
      logger.info(`[DrupalFAAPI] Assistant runId: ${runId}`);
      
      let runStatus = await this.openai.beta.threads.runs.retrieve(threadId, runId);

      logger.info(`[DrupalFAAPI] Run status: ${runStatus}`);

      let response = '';

      if(runStatus.status === "completed"){
        let messages = await this.openai.beta.threads.messages.list(threadId);
        messages.data.forEach((msg) => {
            const role = msg.role;
            const content = msg.content[0].text.value;
            if (role === 'assistant') {
              response += content;
            }
        });
        
        // Set the interval to clear the interval
        clearInterval(this.intervalId);


      } else {
        logger.info("Run is not completed yet.");
      }


      if (response === '') {
        throw new Error('No response from assistant.');
      } else {
        logger.info(`[DrupalFAAPI] Assistant response: ${response}`);
        return response;
      }


    } catch (error) {
      logger.error('[DrupalFAAPI] Error retrieving assistant response:', error);
      throw error;
    }
  }



  async createDrupalURL(prompt) {
    try {
      const thread = await this.createThread();
      const threadId = thread.id;
      logger.info(`[DrupalFAAPI] Created thread ${threadId}`);
      await this.addMessageToThread(threadId, prompt.input);
      const runId = await this.runAssistant(threadId);
      logger.info(`[DrupalFAAPI] Ran assistant ${runId}`);

      const getResponseWithInterval = () => {
        return new Promise((resolve, reject) => {
          const intervalId = setInterval(async () => {
            try {
              const response = await this.getAssistantResponse(threadId, runId);
              if (response) {
                clearInterval(intervalId);
                resolve(response);
              }
            } catch (error) {
              clearInterval(intervalId);
              reject(error);
            }
          }, 10000);
        });
      };
  
      const response = await getResponseWithInterval();

      // Convert json response to array
      const endpoints = JSON.parse(response).endpoints;

      logger.info(`[DrupalFAAPI] Endpoints: ${endpoints}`);
      logger.info(`[DrupalFAAPI] Endpoints type: ${typeof endpoints}`);

      let endpoint = '';

      for (const ep of endpoints) {
        // Check if it's a valid endpoint
        if (!ep.startsWith('/jsonapi/')) {
          logger.info(`[DrupalFAAPI] Skipping wrong endpoint ${ep}`);
          continue;
        }
        let url = `${this.apiBaseURL}${ep}`;

        // Append apikey to the query with api_key parameter
        url = new URL(url);
        url.searchParams.append('api_key', this.apiKey);
        url = url.toString();

        logger.info(`[DrupalFAAPI] Testing endpoint: ${url}`);
        try {
          const response = await this.fetchRawText(url);

          // Extract json data to array
          const responseData = JSON.parse(response.data);
          
          if (response.status === 200 && responseData.data.length > 0) {
            endpoint = url;
            break;
          }
        } catch (error) {
          logger.error(`[DrupalFAAPI] Error testing endpoint ${url}:`, error);
        }
      }

      if (!endpoint) {
        throw new Error('No endpoint with response 200 and content found.');
      }

      return endpoint;

    } catch (error) {
      logger.error('[DrupalFAAPI] Error creating Drupal URL:', error);
      throw error;
    }
  }

  async _call(input) {
    try {
      let url = await this.createDrupalURL(input);
      // Append apikey to the query with api_key parameter
      url = new URL(url);
      url.searchParams.append('api_key', this.apiKey);
      url = url.toString();
      logger.info(`[DrupalFAAPI] Querying Drupal FA: ${url}`);
      const response = await this.fetchRawText(url);
      return response.data;

    } catch (error) {
      if (error.response && error.response.data) {
        logger.error('[DrupalFAAPI] Error data:', error);
        return error.response.data;
      } else {
        logger.error('[DrupalFAAPI] Error querying Drupal FA', error);
        return 'There was an error querying Drupal FA.';
      }
    }
  }
}

module.exports = DrupalFAAPI;
