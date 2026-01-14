# 📦 Sistema di Calcolo Automatico del Riordino Prodotti

## Documentazione Operativa per Utenti Aziendali

**Versione:** 1.0  
**Data:** Dicembre 2024  
**Target:** Titolare, Responsabili Acquisti, Team Logistica

---

## 📋 Indice

1. [Introduzione](#introduzione)
2. [Concetti Base](#concetti-base)
3. [Come Funziona il Calcolo](#come-funziona-il-calcolo)
4. [Parametri Configurabili](#parametri-configurabili)
5. [Esempi Pratici](#esempi-pratici)
6. [Interpretare i Risultati](#interpretare-i-risultati)
7. [Domande Frequenti](#domande-frequenti)

---

## 🎯 Introduzione

Questo sistema automatico analizza le vendite storiche dei vostri prodotti e calcola:

- ✅ **QUANDO** ordinare un prodotto
- ✅ **QUANTO** ordinare
- ✅ **QUALI** prodotti necessitano di riordino oggi

**Obiettivo principale:** Evitare rotture di stock mantenendo le scorte ottimali (né troppo né troppo poco).

---

## 📚 Concetti Base

### 1. Lead Time (Tempo di Consegna)
Il tempo che intercorre tra quando fai un ordine e quando la merce arriva in magazzino.

- **Default:** 80 giorni
- **Esempio:** Se ordini oggi (10 dicembre), la merce arriva il 28 febbraio

### 2. Punto di Riordino (Reorder Point)
La quantità di stock sotto la quale devi fare un nuovo ordine per non rimanere senza merce.

```
Punto di Riordino = Vendite Previste durante Lead Time + Scorta di Sicurezza
```

### 3. Scorta di Sicurezza (Safety Stock)
Una "riserva" di prodotti per gestire picchi di vendita imprevisti o ritardi nelle consegne.

### 4. Livello di Servizio (Service Level)
La probabilità di NON rimanere senza stock. Più alto il livello, più scorta di sicurezza serve.

- **90%** → Rischio 10% di rottura stock (scorta minima)
- **95%** → Rischio 5% (default, buon compromesso)
- **99%** → Rischio 1% (scorta massima)

---

## 🔧 Come Funziona il Calcolo

### FASE 1: Analisi Storico Vendite con Peso Dinamico

Il sistema analizza i dati di vendita degli ultimi 12 mesi (configurabile) ma **NON tutti i mesi hanno lo stesso peso**.

#### Peso Esponenziale dei Dati
```
Peso = 0.85 ^ (mesi fa)
```

**Esempi:**
- Dicembre 2024 (mese corrente): peso = 1.00 (100%)
- Novembre 2024 (1 mese fa): peso = 0.85 (85%)
- Ottobre 2024 (2 mesi fa): peso = 0.72 (72%)
- Settembre 2024 (3 mesi fa): peso = 0.61 (61%)
- ...
- Gennaio 2024 (11 mesi fa): peso = 0.17 (17%)

**Perché?** I dati recenti sono più affidabili per prevedere il futuro. Se c'è un trend di crescita o un cambiamento nel mercato, il sistema lo cattura meglio.

### FASE 2: Calcolo Stagionalità

Il sistema raggruppa le vendite per **mese dell'anno** (gennaio, febbraio, marzo, ecc.).

**Esempio pratico:**
```
GENNAIO:
- Gennaio 2024: 120 pezzi venduti (peso: 100%)
- Gennaio 2023: 100 pezzi venduti (peso: 17%)
→ Media pesata gennaio: ~118 pezzi

DICEMBRE:
- Dicembre 2023: 200 pezzi venduti (peso: 85%)
- Dicembre 2022: 180 pezzi venduti (peso: 14%)
→ Media pesata dicembre: ~197 pezzi
```

Il sistema riconosce automaticamente che a dicembre si vende di più!

### FASE 3: Previsione Domanda Durante Lead Time

Il sistema calcola quanti pezzi venderai durante i prossimi 80 giorni (o il tuo lead time).

**Esempio concreto (oggi è 10 dicembre):**

Lead Time: 80 giorni = 2 mesi e 20 giorni

```
Gennaio 2025 completo:    118 pezzi (media gennaio)
Febbraio 2025 completo:   95 pezzi (media febbraio)
Primi 20 giorni di marzo: 30 pezzi (67% di 45 pezzi - media marzo)
────────────────────────────────────────────────────
TOTALE DOMANDA PREVISTA:  243 pezzi
```

### FASE 4: Calcolo Crescita (se configurata)

Se l'azienda sta crescendo, il sistema aumenta le previsioni progressivamente.

**Esempio con crescita annuale +10%:**

```
Crescita mensile = (1.10)^(1/12) - 1 = 0.797% al mese

Gennaio 2025:  118 × 1.008 = 119 pezzi     (+0.8%)
Febbraio 2025: 95 × 1.016 = 97 pezzi       (+1.6%)
Marzo 2025:    45 × 1.024 × 0.67 = 31 pezzi (+2.4%)
────────────────────────────────────────────
TOTALE con crescita: 247 pezzi
```

### FASE 5: Calcolo Scorta di Sicurezza

La scorta di sicurezza dipende da:
1. **Variabilità delle vendite** (deviazione standard)
2. **Livello di servizio** desiderato
3. **Fattori di smorzamento** per evitare scorte eccessive

**Formula:**
```
Safety Stock = Z × Deviazione Standard × Fattore Smorzamento
```

**Valori di Z per livello di servizio:**
- 90% → Z = 1.28
- 95% → Z = 1.645  ← default
- 99% → Z = 2.326

**Limiti applicati:**
- **Minimo:** 5 pezzi (configurabile)
- **Massimo:** 50% della domanda prevista

**Esempio numerico:**
```
Deviazione standard: 25 pezzi
Livello servizio: 95% → Z = 1.645
Fattore smorzamento: 0.85
────────────────────────────────
Safety Stock = 1.645 × 25 × 0.85 = 35 pezzi
```

### FASE 6: Punto di Riordino Finale

```
Punto di Riordino = Domanda Durante Lead Time + Safety Stock

Esempio:
  247 pezzi (domanda) + 35 pezzi (safety) = 282 pezzi
```

**Significato:** Quando il tuo stock scende sotto 282 pezzi, devi ordinare!

### FASE 7: Calcolo Quantità da Ordinare

Il sistema considera:
- Stock attuale in magazzino
- Ordini già fatti ma non ancora arrivati

```
Stock Disponibile = Stock Attuale + Ordini in Arrivo

Quantità da Ordinare = MAX(0, Punto di Riordino - Stock Disponibile)
```

**Esempio completo:**

```
Punto di Riordino:  282 pezzi
Stock attuale:      85 pezzi
Ordini in arrivo:   150 pezzi (arrivano tra 30 giorni)
────────────────────────────────────────
Stock Disponibile:  85 + 150 = 235 pezzi
Devi ordinare:      282 - 235 = 47 pezzi ✅
```

**Se invece:**
```
Punto di Riordino:  282 pezzi
Stock attuale:      200 pezzi
Ordini in arrivo:   100 pezzi
────────────────────────────────────────
Stock Disponibile:  300 pezzi
Devi ordinare:      0 pezzi ❌ (hai già abbastanza)
```

---

## ⚙️ Parametri Configurabili

### Parametri Principali

| Parametro | Default | Descrizione | Quando Modificarlo |
|-----------|---------|-------------|-------------------|
| **Lead Time** | 80 giorni | Tempo consegna dal fornitore | Se cambia il fornitore |
| **Service Level** | 95% | Probabilità di non esaurire scorte | 99% per prodotti critici, 90% per prodotti secondari |
| **Historical Months** | 12 mesi | Quanti mesi analizzare | 24 mesi per prodotti molto stagionali |
| **Annual Growth** | 0% | Crescita annuale vendite | +10% se in crescita, -5% se in calo |
| **Weighting Factor** | 0.85 | Quanto pesano i dati recenti | 0.90 per trend più stabili, 0.80 per mercati volatili |
| **Min Operational Stock** | 5 pezzi | Scorta minima operativa | Basato su MOQ del fornitore |

### Parametri di Filtraggio

- **excludeCustomers:** Escludi certi clienti dall'analisi (es: ordini anomali)
- **excludeProducts:** Escludi prodotti specifici dalla scansione
- **productPattern:** Pattern per selezionare prodotti (es: "VS%" per tutti i prodotti che iniziano con VS)
- **warehouse:** Magazzino da analizzare (default: "rogno")

---

## 💼 Esempi Pratici

### Esempio 1: Caso Standard (Prodotto Stabile)

**Prodotto:** VS001 - Vite M10  
**Lead Time:** 80 giorni  
**Service Level:** 95%

**Dati:**
```
Vendite mensili medie: 100 pezzi/mese
Variabilità: Bassa (std dev: 15 pezzi)
Stock attuale: 150 pezzi
Ordini in arrivo: 0 pezzi
```

**Calcolo:**
```
1. Domanda durante lead time (2.67 mesi): 267 pezzi
2. Safety stock (95%): 1.645 × 15 = ~25 pezzi
3. Punto di riordino: 267 + 25 = 292 pezzi
4. Stock disponibile: 150 pezzi
5. DA ORDINARE: 292 - 150 = 142 pezzi ✅
```

### Esempio 2: Prodotto Stagionale

**Prodotto:** VS045 - Decorazione Natalizia  
**Lead Time:** 80 giorni  
**Service Level:** 99% (critico non rimanere senza)

**Dati:**
```
Settembre-Ottobre: 10 pezzi/mese
Novembre: 50 pezzi
Dicembre: 200 pezzi
Gennaio: 30 pezzi
Resto anno: 5 pezzi/mese
Stock attuale: 80 pezzi (oggi: 10 dicembre)
```

**Calcolo (ordinare ora per ricevere fine febbraio):**
```
1. Domanda durante lead time:
   - Gennaio completo: 30 pezzi
   - Febbraio completo: 5 pezzi
   - 20 giorni marzo: 3 pezzi
   Totale: 38 pezzi

2. Safety stock (99%): 2.326 × 8 = ~19 pezzi
3. Punto di riordino: 38 + 19 = 57 pezzi
4. Stock disponibile: 80 pezzi
5. DA ORDINARE: 0 pezzi ❌
```

**Nota:** Il picco natalizio è passato, non serve ordinare subito!

### Esempio 3: Azienda in Crescita

**Prodotto:** VS090 - Nuovo Prodotto  
**Lead Time:** 80 giorni  
**Crescita annuale:** +20%

**Dati:**
```
Vendite attuali: 50 pezzi/mese
Crescita mensile: (1.20)^(1/12) = 1.53% al mese
Stock attuale: 80 pezzi
```

**Calcolo:**
```
1. Domanda durante lead time CON crescita:
   Mese 1: 50 × 1.015 = 51 pezzi
   Mese 2: 50 × 1.031 = 52 pezzi
   20 gg mese 3: 50 × 1.046 × 0.67 = 35 pezzi
   Totale: 138 pezzi

2. Safety stock: 20 pezzi
3. Punto di riordino: 158 pezzi
4. DA ORDINARE: 158 - 80 = 78 pezzi ✅
```

### Esempio 4: Con Ordini già in Arrivo

**Prodotto:** VS120  
**Lead Time:** 80 giorni

**Dati:**
```
Punto di riordino calcolato: 300 pezzi
Stock attuale: 50 pezzi
Ordini in arrivo:
  - 200 pezzi (arrivano tra 15 giorni)
  - 100 pezzi (arrivano tra 45 giorni)
```

**Calcolo:**
```
1. Stock disponibile: 50 + 200 + 100 = 350 pezzi
2. Punto di riordino: 300 pezzi
3. DA ORDINARE: 0 pezzi ❌
```

**Motivo:** Gli ordini già fatti coprono il fabbisogno!

---

## 📊 Interpretare i Risultati

### Report del Sistema

Quando esegui una scansione, il sistema restituisce:

```json
{
  "scannedProducts": 150,
  "productsNeedingReorder": 23,
  "products": [
    {
      "productCode": "VS001",
      "description": "Vite M10 zincata",
      "reorderPoint": 282,
      "reorderQuantity": 142,
      "reorderDate": "2025-02-28",
      "totalForecast": 247,
      "safetyStock": 35,
      "availableStock": 235,
      "onHandStock": 85,
      "incomingStock": 150,
      "needsReorder": true
    }
  ]
}
```

### Legenda Campi

| Campo | Significato | Usa per |
|-------|-------------|---------|
| **reorderPoint** | Soglia sotto cui ordinare | Confronta con stock attuale |
| **reorderQuantity** | Quantità consigliata da ordinare | Crea ordine d'acquisto |
| **reorderDate** | Data prevista arrivo merce | Pianificazione |
| **totalForecast** | Vendite previste durante lead time | Capire la domanda |
| **safetyStock** | Scorta di sicurezza | Buffer per imprevisti |
| **availableStock** | Stock reale disponibile | Include ordini in arrivo |
| **onHandStock** | Stock fisico oggi | Solo magazzino |
| **incomingStock** | Ordini già fatti in arrivo | Quanto arriva |

### Semaforo Decisionale

🔴 **URGENTE - Ordinare Subito**
- `needsReorder: true`
- `availableStock` molto sotto `reorderPoint`
- `reorderDate: "today"`

🟡 **ATTENZIONE - Pianificare Ordine**
- `needsReorder: true`
- `availableStock` vicino a `reorderPoint`
- `incomingStock: 0` (nessun ordine pendente)

🟢 **OK - Stock Sufficiente**
- `needsReorder: false`
- `availableStock > reorderPoint`

---

## ❓ Domande Frequenti

### 1. Perché il sistema vuole che ordini così tanto?

**Risposta:** Probabilmente hai impostato un `serviceLevel` troppo alto (99%) o c'è molta variabilità nelle vendite. 

**Soluzione:** 
- Abbassa il service level a 95% per prodotti non critici
- Verifica che i dati storici siano corretti
- Escludi ordini anomali con `excludeCustomers`

### 2. Il sistema dice di non ordinare ma io penso di aver bisogno

**Risposta:** Il sistema considera gli ordini già in arrivo (`incomingStock`). Verifica:

```
Stock Disponibile = Stock Attuale + Ordini in Arrivo
```

Se hai ordini che arriveranno presto, il sistema li conta già.

### 3. Come gestire prodotti nuovi senza storico?

**Risposta:** Per prodotti nuovi (<6 mesi di dati):

- Il sistema abbassa automaticamente la `confidence` (fiducia nel calcolo)
- Usa `minOperationalStock` più alto (es: 20 invece di 5)
- Monitora manualmente i primi mesi
- Considera ordini più piccoli e frequenti inizialmente

### 4. Il picco di dicembre falsifica i calcoli tutto l'anno?

**Risposta:** No! Il sistema usa:

1. **Stagionalità:** Riconosce che dicembre è diverso da febbraio
2. **Peso temporale:** Dicembre 2024 conta più di dicembre 2023
3. **Previsione mese-specifica:** Prevede le vendite mese per mese

### 5. Posso fidarmi al 100% del sistema?

**Risposta:** Il sistema è uno strumento di supporto decisionale, non sostituisce il giudizio umano.

**Quando fidarti:**
- ✅ Prodotti con storico lungo (>12 mesi)
- ✅ Vendite relativamente stabili
- ✅ Lead time affidabili

**Quando usare prudenza:**
- ⚠️ Prodotti nuovi
- ⚠️ Mercato in forte cambiamento
- ⚠️ Eventi eccezionali (pandemia, crisi, ecc.)
- ⚠️ Cambio fornitore/lead time

### 6. Cosa fare se i lead time variano molto?

**Risposta:** Usa il lead time **più lungo** + 10% come margine di sicurezza.

**Esempio:**
- Lead time normale: 60 giorni
- Lead time peggiore: 90 giorni
- **Usa:** 90 + 9 = 99 giorni (arrotonda a 100)

### 7. Come escludere ordini anomali?

**Risposta:** Usa `excludeCustomers` per escludere:

```json
{
  "excludeCustomers": ["00000638", "00001680"],
  "productCodes": ["VS001", "VS002"]
}
```

**Esempi di ordini da escludere:**
- Ordini una-tantum molto grandi
- Clienti di test
- Ordini promozionali eccezionali

### 8. Ogni quanto eseguire la scansione?

**Raccomandazioni:**

- **Settimanale:** Prodotti ad alta rotazione
- **Mensile:** Prodotti a media rotazione
- **Trimestrale:** Prodotti a bassa rotazione
- **Dopo eventi speciali:** Promozioni, fiere, cambi di stagione

---

## 📈 Best Practices

### ✅ Da Fare

1. **Aggiorna regolarmente i parametri** se cambiano i fornitori o i lead time
2. **Monitora la confidence** dei risultati (più dati = più affidabilità)
3. **Confronta le previsioni** con le vendite reali per validare il sistema
4. **Usa livelli di servizio differenziati**: 99% per best-seller, 90% per prodotti marginali
5. **Escludi anomalie** note dai dati storici

### ❌ Da Evitare

1. **Non ignorare gli avvisi** del sistema senza motivazione
2. **Non cambiare parametri** troppo frequentemente (serve tempo per vedere gli effetti)
3. **Non usare lo stesso service level** per tutti i prodotti
4. **Non dimenticare** di aggiornare gli ordini in arrivo nel sistema
5. **Non ordinare manualmente** senza verificare le previsioni del sistema

---

## 🎓 Conclusioni

Questo sistema di calcolo automatico del riordino è uno strumento potente che:

- ✅ Riduce le rotture di stock
- ✅ Ottimizza il capitale immobilizzato
- ✅ Riconosce automaticamente la stagionalità
- ✅ Si adatta alla crescita dell'azienda
- ✅ Fornisce decisioni basate sui dati

**Ricorda:** Il sistema è un assistente intelligente, non un sostituto del vostro know-how. Usatelo per prendere decisioni più informate e veloci!

---

## 📞 Supporto

Per domande tecniche o modifiche ai parametri, contattare il team IT.

**Versione documento:** 1.0  
**Ultimo aggiornamento:** Dicembre 2024

---

*Questo documento è proprietà aziendale e contiene informazioni confidenziali sui processi operativi.*