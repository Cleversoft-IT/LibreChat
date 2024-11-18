const CloudFlareFA = require('./CloudFlareFA');
const { z } = require('zod');


class RetrievalFAAPI extends CloudFlareFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'retrieval_fa_api';

    this.cloudFlareUrl = this.getEnvVariable('CLOUDFLARE_RETRIEVAL_URL');

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato interrogare la RAG aziendale sul database vettoriale Zilliz.
    //
    // Funzionalità Principali:
    // - Ricerca nei file aziendali come cataloghi, schede tecniche, manuali, listini prezzi. 
    `;
    
    this.description = `Uno strumento per interrogare l'API di Zilliz FA. L'input dovrebbe essere una query per l'agente per recuperare i dati richiesti. L'output sarà la risposta grezza in formato testuale dall'API.`;

    this.schema = this.schema.extend({
      query: z.string().describe('La query da inviare all\'API di Zilliz per recuperare i dati richiesti.'),
      knowledge_id: z.enum(['managed_files']).describe('L\'identificativo univoco della collection su Zilliz. Select from the list of available collections.'),
      retrieval_setting: z.object({
        top_k: z.number().default(5).describe('Il numero massimo di risultati da recuperare.'),
        score_threshold: z.number().default(0.01).describe('La soglia minima di punteggio per i risultati.')
      }).optional().describe('Le impostazioni di recupero per la query.')
    });
  }

}

module.exports = RetrievalFAAPI;
