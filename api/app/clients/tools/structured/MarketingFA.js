const DifyFA = require('./DifyFA');

class MarketingFAAPI extends DifyFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'marketing_fa_api';
    this.difyApiKey = this.getEnvVariable('DIFY_MARKETING_API_KEY');

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato per accedere a informazioni di marketing di Forma Aquae come campagne pubblicitarie, strategie di marketing e dati non espressamente indicati in altri strumenti. Questo tool interagisce in linguaggio naturale con un agente che fornisce un accesso centralizzato e standardizzato ai contenuti di marketing attraverso la sua conversazione.
    // Funzionalità Principali:
    // - Recupero Campagne Pubblicitarie: Accesso alle campagne pubblicitarie e statistiche.
    // - Recupero Strategie di Marketing: Accesso alle strategie di marketing e statistiche.
    // - Recupero Dati Generici: Accesso ai dati di marketing generici non specificati in altri strumenti.
    // - Dati Generici: Accesso a dati aziendali generici non specificati in altri strumenti.
   `;
    
    this.description = `Uno strumento per interrogare l'API di Marketing FA. L'input dovrebbe essere un prompt per l'agente. L'output sarà la risposta dell'agente.`;
  }

}

module.exports = MarketingFAAPI;
