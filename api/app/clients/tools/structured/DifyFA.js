const axios = require('axios').default;

const { z } = require('zod');
const { StructuredTool } = require('langchain/tools');
const { logger } = require('~/config');

class DifyFAAPI extends StructuredTool {
  constructor(fields) {
    super();
    this.override = fields.override ?? false;

    this.difyApiKey = this.getEnvVariable('DIFY_VTIGER_API_KEY');
    this.difyUrl = this.getEnvVariable('DIFY_API_CHAT_URL');

    this.name = 'dify_vtiger_fa_api';
    // TODO: Change!!

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato per accedere a informazioni aziendali generiche di Forma Aquae come articoli (prodotti aziendali come vasche o lavabi), procedure aziendali e dati non espressamente indicati in altri strumenti. Questo agente fornisce un accesso centralizzato e standardizzato ai contenuti aziendali attraverso l'API di Vtiger.
    //
    // Funzionalità Principali:
    // - Recupero Fatture: Accesso alle fatture emesse e ricevute.
    // - Recupero Ordini: Accesso agli ordini emessi e ricevuti.
    // - Recupero Lead: Accesso ai lead aziendali.
    // - Recupero Contatti: Accesso ai contatti aziendali.
    //
    // Formato della Risposta:
    // - L'agente deve restituire i dati in un formato strutturato (yaml o json) che includa solo i dati necessari per l'assistente principale.
    `;
    
    this.description = `Uno strumento per interrogare l'API di Vtiger FA. L'input dovrebbe essere un prompt per l'agente per recuperare la query string. L'output sarà la risposta grezza in formato testuale dall'API.`;

    this.schema = z.object({
      original_prompt: z.string().describe('Il testo della domanda così come viene scritta dall\'utente.'),
      context: z.string().describe('Contesto ricavato dall\'assistente per la domanda originale. Conciso ed efficace, fornendo informazioni necessarie per comprendere la domanda.'),
      data_requested: z.string().describe('Specifica i dati necessari richiesti all\'API per rispondere efficacemente alla domanda originale dell\'utente.'),
      conversation_id: z.string().describe('Identificativo univoco della conversazione in corso. Stringa vuota se prima conversazione con l\'agente.'),
    });
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

  logger.info(`[DifyFAAPI] Query: ${JSON.stringify(query)}`);

    // Create a formatted string that concatenates all the query objects
    let questionString = '';
    let conversationId = '';
    for (const key in query) {
      // Skip conversatin_id key
      if (key === 'conversation_id' && query[key] !== '' && query[key] !== ' ') {
        conversationId = query[key];
        continue;
      }
      questionString += `${key}: \n${query[key]}\n\n`;
    }

    const body = {
      inputs: {},
      query: questionString,
      response_mode: 'streaming',
      conversation_id: '',
      //conversation_id: conversationId,
      user: 'ForMe_Supervisor'
    }



    let url = this.difyUrl;
    logger.info(`[DifyFAAPI] Querying Flowise: ${url}`);
    logger.info(`[DifyFAAPI] Body: ${JSON.stringify(body)}`);

    try {
    


      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.difyApiKey}`
        },
        
        body: JSON.stringify(body)
      });


    // Get text from response
    const text = await response.text();

    // Convert to array of object with new line as delimiter
    const records = text.split("\n\n");

    // Initialize answer
    let answer = "";

    // Loop through the records and JSON parse each record
    records.forEach((record) => {
        try {
            // Trim "data: " at the beginning of each record
            record = record.replace("data: ", "");
            // Concatenate all the "answer" fields with content
            const recordObj = JSON.parse(record);

            // Check if the record is an answer
            if (recordObj.thought && recordObj.thought !== "") {
                answer += recordObj.thought;
            }
        } catch (error) {
            // console.log(error);
        }
    });

    return answer;

    } catch (error) {
      logger.error('[DifyFAAPI] API request failed', error);
      return `[DifyFAAPI] API request failed: ${error.message}`;
    }
  }



}

module.exports = DifyFAAPI;
