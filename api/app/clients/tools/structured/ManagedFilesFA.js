const RetrievalFAAPI = require('./RetrievalFA');
const { z } = require('zod');

class ManagedFilesFAAPI extends RetrievalFAAPI {
  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'managed_files_fa_api';

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato interrogare la RAG aziendale sul database vettoriale Zilliz.
    //
    // Funzionalità Principali:
    // - Ricerca nei file aziendali come cataloghi, schede tecniche, manuali, listini prezzi. 
    `;
    
    this.description = `Uno strumento per interrogare l'API di Zilliz FA. L'input dovrebbe essere una query per l'agente per recuperare i dati richiesti. L'output sarà la risposta grezza in formato testuale dall'API.`;

    // Extend the schema to add the knowledge_id specific to this implementation
    this.schema = this.schema.extend({
      knowledge_id: z.enum(['managed_files']).describe('L\'identificativo univoco della collection su Zilliz. Select from the list of available collections.')
    });
  }
}

module.exports = ManagedFilesFAAPI;
