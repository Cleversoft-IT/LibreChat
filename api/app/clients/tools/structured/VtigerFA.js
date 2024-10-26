const { z } = require('zod');
const DifyFA = require('./DifyFA');

class VtigerFAAPI extends DifyFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.difyApiKey = this.getEnvVariable('DIFY_VTIGER_API_KEY');
    this.name = 'vtiger_fa_api';

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
    //
    // Formato della Risposta:
    // - L'agente deve restituire i dati in un formato strutturato (yaml o json) che includa solo i dati necessari per l'assistente principale.
    `;
    
    this.description = `Uno strumento per interrogare l'API di Vtiger FA. L'input dovrebbe essere un prompt per l'agente per recuperare la query string. L'output sarà la risposta grezza in formato testuale dall'API.`;

    this.schema = this.schema.extend({
      data_requested: z.string().optional().describe('Specifica i dati necessari richiesti all\'API per rispondere efficacemente alla domanda originale dell\'utente. Da utilizzare solo ed esclusivamente se il prompt non è sufficiente per rispondere alla domanda. Lasciare vuoto se non necessario.'),
    });

  }

}

module.exports = VtigerFAAPI;
