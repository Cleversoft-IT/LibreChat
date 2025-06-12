const axios = require('axios').default;
const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('~/config');

class CreateProcedureFA extends Tool {
  constructor(fields) {
    super();
    this.override = fields.override ?? false;
    this.drupalProcedureUrl = this.getEnvVariable('DRUPAL_PROCEDURE_API_URL');
    this.authKey = this.getEnvVariable('DRUPAL_PROCEDURE_API_KEY');

    this.name = 'create_procedure_fa';
    this.description_for_model = `
    Questo tool crea una nuova procedura su Drupal tramite API, e va usato solamente dopo aver chiesto all'utente conferma e ulteriori dettagli riguardo la procedura. Chiedi esplicitamente all'utente conferma per il permesso di utilizzare questo tool. Fornisci un titolo e il contenuto della procedura. Ricorda che dopo aver creato una procedura, il link corretto per visualizzarla è https://[drupalsite]/node/[nid], dove nid non è l'uuid, ma l'id interno di drupal.`;
    this.description = this.description_for_model;

    this.schema = z.object({
      title: z.string().describe('Il titolo della procedura da creare.'),
      field_contenuto: z.string().describe('Il contenuto della procedura da creare.'),
      field_ambito: z.enum(['forma_aquae', 'diy']).describe("Ambito della procedura: 'forma_aquae' oppure 'diy'.")
    });
  }

  getEnvVariable(varName) {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing ${varName} environment variable.`);
    }
    return value;
  }

  async _call(query, _runManager) {
    logger.info(`[CreateProcedureFA] Query: ${JSON.stringify(query)}`);
    const body = {
      data: {
        type: 'node--procedure',
        attributes: {
          field_titolo: query.title,
          field_contenuto: query.field_contenuto,
          field_ambito: [query.field_ambito]
        }
      }
    };
    logger.info(`[CreateProcedureFA] Posting to Drupal: ${this.drupalProcedureUrl}`);
    logger.info(`[CreateProcedureFA] Body: ${JSON.stringify(body)}`);
    try {
      const response = await axios.post(
        this.drupalProcedureUrl,
        body,
        {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Basic ${this.authKey}`,
            'Content-Type': 'application/vnd.api+json'
          }
        }
      );
      logger.info(`[CreateProcedureFA] Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      logger.error('[CreateProcedureFA] API request failed', error);
      return `[CreateProcedureFA] API request failed: ${error.message}`;
    }
  }
}

module.exports = CreateProcedureFA;