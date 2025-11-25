const DifyFA = require('./DifyFA');

class DrupalFAAPI extends DifyFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'drupal_fa_api';
    this.difyApiKey = this.getEnvVariable('DIFY_DRUPAL_API_KEY');

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato per accedere a informazioni aziendali generiche di Forma Aquae come articoli (prodotti aziendali come vasche o lavabi), procedure aziendali e dati non espressamente indicati in altri strumenti. Questo agente fornisce un accesso centralizzato e standardizzato ai contenuti aziendali attraverso l'API di Drupal.
    //
    // Funzionalità Principali:
    // - Procedure Aziendali: Accesso alle procedure aziendali standard e altri documenti operativi.
    //
    // Formato della Risposta:
    // - L'agente deve restituire i dati in un formato strutturato (yaml o json) che includa solo i dati necessari per l'assistente principale.
    `;
    
    this.description = `Uno strumento per interrogare l'API di Drupal FA. L'input dovrebbe essere un prompt per l'agente per recuperare la query string. L'output sarà la risposta grezza in formato testuale dall'API.`;
  }

}

module.exports = DrupalFAAPI;
