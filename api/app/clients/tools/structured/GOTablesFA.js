const RetrievalFAAPI = require('./RetrievalFA');
const { z } = require('zod');

class GOTablesFAAPI extends RetrievalFAAPI {
  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'go_tables_fa_api';

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato interrogare la RAG delle tabelle del database aziendale sul database vettoriale Zilliz.
    //
    // Funzionalità Principali:
    // - Ricerca della corretta tabella e delle colonne da utilizzare per una query SQL. 
    `;
    
    this.description = `Uno strumento per interrogare la RAG delle tabelle del database aziendale sul database vettoriale Zilliz.`;

    // Extend the schema to add the knowledge_id specific to this implementation
    this.schema = this.schema.extend({
      knowledge_id: z.enum(['go_tables']).describe('L\'identificativo univoco della collection su Zilliz. Select from the list of available collections.')
    });
  }
}

module.exports = GOTablesFAAPI;
