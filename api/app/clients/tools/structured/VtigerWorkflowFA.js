const { z } = require('zod');
const DifyFAWorkflow = require('./DifyFAWorkflow');

class VtigerWorkflowFAAPI extends DifyFAWorkflow {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.difyWorkflowApiKey = this.getEnvVariable('DIFY_VTIGER_WORKFLOW_API_KEY');
    this.name = 'vtiger_workflow_fa_api';

    // TODO: CHANGE!!
    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato per accedere a informazioni aziendali generiche di Forma Aquae come articoli (prodotti aziendali come vasche o lavabi), procedure aziendali e dati non espressamente indicati in altri strumenti. Questo agente fornisce un accesso centralizzato e standardizzato ai contenuti aziendali attraverso l'API di Vtiger.
    //
    // Funzionalità Principali:
    // - Recupero Fatture: Accesso alle fatture emesse e ricevute.
    // - Recupero Ordini: Accesso agli ordini emessi e ricevuti.
    // - Recupero Lead: Accesso ai lead aziendali.
    // - Recupero Contatti: Accesso ai contatti aziendali.
    `;
    
    this.description = `Uno strumento per interrogare l'API di Vtiger FA. L'output sarà la risposta grezza in formato testuale dall'API.`;

    this.schema = this.schema.extend({
      perfect_prompt_from_agent: z.string().describe('The perfect prompt in natural language, with the needed context and the requested data.'),
      JSON_previous_error: z.string().optional().describe('The errors in previous execution of the requests')
   });

  }

}

module.exports = VtigerWorkflowFAAPI;
