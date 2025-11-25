const DifyFA = require('./DifyFA');

class GOFAAPI extends DifyFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'go_fa_api';
    this.difyApiKey = this.getEnvVariable('DIFY_GO_API_KEY');

    this.description_for_model = `
    // IMPORTANTE: Questo è il primo tool da utilizzare per generare e validare le query SQL!
    //
    // Scopo: Questo tool ha l'intelligenza per generare query SQL corrette e validate, identificando
    // le tabelle e i nomi delle colonne appropriati. È SEMPRE il primo strumento da utilizzare quando
    // si necessita di dati dal database GO.
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
    // - L'agente deve restituire unicamente la query SQL da eseguire per ottenere i dati richiesti.
    //
    // NOTA 1: Solo se questo tool restituisce dati incompleti o parziali, allora, e SOLO allora,
    // utilizzare il tool "go_workflow_fa_api" con la query esatta fornita da questo tool.
    // NOTA 2: NON utilizzare MAI il tool "go_workflow_fa_api" senza prima aver utilizzato questo tool.
    `;
    // Non è possibile superare i 1024 caratteri per la descrizione del tool.
    // summarize the description_for_model to 1024 characters
    this.description = 'Use this tool to generate and validate SQL queries to access GO data. Use this tool when you need to access GO data to retrieve information about products, orders, customers, suppliers, and other data.';
  }

}

module.exports = GOFAAPI;
