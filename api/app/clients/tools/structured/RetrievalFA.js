const CloudFlareFA = require('./CloudFlareFA');
const { z } = require('zod');

class RetrievalFAAPI extends CloudFlareFA {
  constructor(fields) {
    super(fields);

    this.name = 'retrieval_fa_api';
    this.cloudFlareUrl = this.getEnvVariable('CLOUDFLARE_RETRIEVAL_URL');
    
    this.description = `Uno strumento base per interrogare l'API di Zilliz FA. Questa è una classe base che deve essere estesa.`;

    this.schema = this.schema.extend({
      query: z.string().describe('La query da inviare all\'API di Zilliz per recuperare i dati richiesti.'),
      retrieval_setting: z.object({
        top_k: z.number().default(8).describe('Il numero massimo di risultati da recuperare.'),
        score_threshold: z.number().default(0.01).describe('La soglia minima di punteggio per i risultati.')
      }).optional().describe('Le impostazioni di recupero per la query.')
    });
  }
}

module.exports = RetrievalFAAPI;
