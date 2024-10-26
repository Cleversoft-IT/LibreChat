const DifyFA = require('./DifyFA');

class GOFAAPI extends DifyFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'go_fa_api';
    this.difyApiKey = this.getEnvVariable('DIFY_GO_API_KEY');

    this.description_for_model = `
    //
    // Funzionalità Principali:
    // - Recupero Articoli: Accesso ai dati relativi ai prodotti aziendali come vasche, lavabi e altre attrezzature.
    // - Ordini e Movimenti di Magazzino: Recupero di dati relativi agli ordini di vendita, ordini di acquisto e movimenti di magazzino.
    // - Clienti e Fornitori: Accesso alle informazioni su clienti e fornitori, inclusi i dati di contatto e indirizzi di spedizione.
    // - Listini di Vendita: Accesso ai prezzi degli articoli e sconti riservati ai clienti.
    // - Dati di Fatturazione e Scadenze: Accesso a dati di fatturazione, fatture elettroniche, e scadenze di pagamento.
    // - Provvigioni Agenti: Recupero delle provvigioni assegnate agli agenti di vendita.
    // - Inventario e Giacenze Magazzino: Accesso a informazioni sull'inventario e giacenze attuali di magazzino.
    // - Tempi di Consegna: Calcolo dei tempi di consegna degli articoli ordinati.
    // - Altri Dati Generici: Accesso a dati aziendali generici non specificati in altri strumenti.
    //
    // Formato della Risposta:
    // - L'agente deve restituire i dati in un formato strutturato (yaml o json) che includa solo i dati necessari per l'assistente principale.
    `;
    
    this.description = `Uno strumento per interrogare l'API di GO FA. L'input dovrebbe essere un prompt per l'agente per recuperare la query string. L'output sarà la risposta grezza in formato testuale dall'API.`;
  }

}

module.exports = GOFAAPI;
