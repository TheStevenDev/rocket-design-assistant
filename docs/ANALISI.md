# Rocket Design Assistant — Analisi e architettura dell'MVP

Data: 12 ottobre 2026 · Stato: MVP 0.1 implementato nella cartella `app/`

Documento di progettazione iniziale: analisi dei requisiti, stack, architettura dei moduli, dipendenze, strutture dati e roadmap. Alcuni dettagli dell'interfaccia sono cambiati dopo la prima versione (percorso guidato in quattro passi, modalità esperto, interfaccia in inglese e italiano); il codice in `app/src` è il riferimento aggiornato.

---

## 1. Analisi dei requisiti

### 1.1 Obiettivo
Strumento web, semplice e locale, per definire la geometria di un razzo amatoriale monostadio, stimarne masse e baricentro, stimare il centro di pressione con un modello semplificato dichiarato e visualizzare il modello 3D aggiornato in tempo reale. **Non è uno strumento di certificazione**: ogni risultato è una stima legata a ipotesi esplicite.

### 1.2 Requisiti funzionali

| ID | Area | Requisito | Priorità MVP |
|---|---|---|---|
| F1 | Design | Corpo: diametro esterno, lunghezza, spessore parete, materiale | Must |
| F2 | Design | Ogiva: forma (conica, ogiva tangente, ellittica, parabolica, potenza, Von Kármán), lunghezza, spessore, piena/cava, materiale | Must |
| F3 | Design | Pinne: numero, corda alla radice/estremità, apertura, freccia, spessore, posizione dal fondo, materiale | Must |
| F4 | Design | Masse strutturali calcolate dalla geometria, sostituibili da masse misurate | Must |
| F5 | Masse | Lista componenti (nome, massa, posizione CG, lunghezza, origine misurata/stimata, incertezze) | Must |
| F6 | Masse | Motore con massa a vuoto e massa di propellente | Must |
| F7 | Masse | Grafico della distribuzione delle masse lungo l'asse e CG complessivo | Must |
| F8 | Stabilità | CG, CP (Barrowman), margine statico in calibri | Must |
| F9 | Stabilità | Margine al variare delle configurazioni di massa (decollo, burnout, configurazioni utente) e del propellente residuo | Must |
| F10 | Stabilità | Sensibilità alle incertezze (tornado one-at-a-time + Monte Carlo) | Must |
| F11 | Stabilità | Avviso quando la stima non è attendibile, con elenco dei dati mancanti | Must |
| F12 | Pinne/struttura | Raccolta dati: geometria nominale, vincoli di fabbricazione, proprietà del materiale, ipotesi, incertezze | Must |
| F13 | Pinne/struttura | Area informativa sul flutter, senza alcun verdetto di "immunità" | Must |
| F14 | 3D | Rotazione/zoom, corpo/ogiva/pinne, marker CG e CP, attiva/disattiva elementi, quote e assi | Must |
| F15 | Dashboard | Dimensioni, massa, CG, CP, margine, completezza dati, avvisi su ipotesi e limiti | Must |
| F16 | Progetti | Nuovo, salva (locale), apri, duplica, elimina, importa/esporta JSON, annulla/ripeti | Must |
| F17 | Unità | SI interno; visualizzazione in mm, cm o m e in g o kg | Must |

### 1.3 Requisiti non funzionali
- **Separazione netta** tra UI, modello geometrico, masse, modelli fisici, 3D, validazione, I/O (vedi §3).
- **Funzioni di calcolo pure** e testate: stesso input → stesso output, nessuna dipendenza dalla UI.
- **Tracciabilità delle ipotesi**: ogni modello fisico esporta l'elenco delle proprie ipotesi e dei limiti di validità, mostrati in UI accanto ai risultati.
- **Distinzione misurato/stimato/calcolato** su ogni massa.
- **Validazione immediata** sul campo (errore/avviso) e validazione globale del progetto (configurazioni geometriche non valide).
- **Funzionamento offline**, nessun backend: i dati restano nel browser dell'utente.
- **Formato progetto versionato** (`schemaVersion`) per poter migrare i file in futuro.

### 1.4 Linguaggio dei risultati (vincolo esplicito)
- Nessuna etichetta "sicuro", "approvato", "immune dal flutter".
- Il margine statico viene classificato solo come "nell'intervallo tipico di riferimento (1–2 cal) secondo il modello semplificato", "basso", "elevato" o "negativo (instabile secondo il modello)".
- Ogni risultato di stabilità mostra il modello usato e le sue ipotesi.

### 1.5 Fuori ambito per l'MVP (dichiarato in UI)
Transizioni/boattail, più stadi, effetti di comprimibilità (Mach > ~0,3), portanza del corpo ad alto angolo d'attacco, calcolo traiettoria, calcolo del flutter, analisi strutturale FEM, CAD esportabile (STEP/STL).

---

## 2. Stack tecnologico proposto

| Livello | Scelta | Motivazione |
|---|---|---|
| Linguaggio | **TypeScript** | Tipi forti per strutture dati fisiche e unità; refactoring sicuro |
| Build | **Vite** | Avvio immediato, configurazione minima, build statica |
| UI | **React 19** | Ecosistema maturo, componenti riusabili per i campi con unità |
| Stato | **Zustand** | Store minimale, facile da leggere; annulla/ripeti implementabile in poche righe |
| 3D | **Three.js** (diretto, senza wrapper) | La libreria più diffusa e documentata; un solo modulo `viewer/` la incapsula, quindi è sostituibile. Si evita React-Three-Fiber per tenere il 3D indipendente da React e ridurre le dipendenze |
| Grafici | **SVG scritto a mano** | I grafici sono pochi e semplici (barre, linee, tornado): niente libreria da mantenere |
| Validazione file | **Zod** | Valida i progetti importati e produce errori leggibili |
| Test | **Vitest** | Stessa configurazione di Vite; test dei moduli di calcolo |

Distribuzione: build statica (una cartella o un singolo HTML) apribile in qualsiasi browser; può essere pubblicata come pagina o servita da GitHub Pages quando verrà collegato un repository.

---

## 3. Architettura dei moduli

```
src/
├── core/          Tipi, unità, materiali, progetto di default (nessuna dipendenza)
├── geometry/      Modello geometrico: profili ogiva, grandezze derivate pinne/corpo
├── mass/          Proprietà di massa: masse strutturali, componenti, CG, configurazioni
├── physics/       Modelli fisici con ipotesi dichiarate: Barrowman, margine, sensibilità
├── validation/    Validazione campi e progetto, completezza dati
├── analysis/      Orchestratore: Project → AnalysisResult (funzione pura)
├── io/            Import/export JSON (Zod), salvataggio locale, migrazioni di schema
├── state/         Store Zustand (progetto, cronologia annulla/ripeti, preferenze UI)
├── viewer/        Three.js: costruzione mesh dal modello geometrico, marker, quote
└── ui/            Componenti React per le aree: Dashboard, Design, Masse, Stabilità, Pinne, 3D
```

Regole di dipendenza (unidirezionali):

```
ui ──► state ──► analysis ──► physics ──► mass ──► geometry ──► core
 │                 │             └──────► validation ─────────┘
 └──► viewer ──► geometry
 └──► io ──► core
```

- `core`, `geometry`, `mass`, `physics`, `validation`, `analysis` **non importano** React né Three.js: sono testabili in Node.
- `viewer` riceve geometria derivata e posizioni CG/CP, non conosce lo store.
- `ui` non contiene formule: chiama `analyzeProject()` (memoizzata) e mostra i risultati.

### 3.1 Flusso dei dati
1. L'utente modifica un campo → il campo converte dall'unità di visualizzazione a SI e valida localmente.
2. Lo store aggiorna il `Project` (immutabile) e registra lo stato precedente per annulla/ripeti.
3. `analyzeProject(project)` produce un `AnalysisResult` (geometria derivata, masse, stabilità, configurazioni, sensibilità, completezza, avvisi).
4. UI e viewer 3D si aggiornano dai nuovi dati; il progetto viene salvato automaticamente in locale.

---

## 4. Dipendenze e librerie

Runtime: `react`, `react-dom`, `three`, `zustand`, `zod`.
Sviluppo: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/three`, `vitest`, `vite-plugin-singlefile` (per produrre un unico file HTML portabile).

Nessun servizio esterno, nessun backend, nessuna chiave API.

---

## 5. Strutture dati

Unità interne: **metri, chilogrammi, kg/m³, pascal**. Origine dell'asse longitudinale: **punta dell'ogiva**, x positiva verso la coda.

```ts
type MassSource = 'measured' | 'estimated' | 'computed';

interface Project {
  schemaVersion: 1;
  meta: { id: string; name: string; description: string; createdAt: string; updatedAt: string };
  geometry: RocketGeometry;
  components: MassComponent[];        // payload, elettronica, paracadute, motore, zavorra…
  configurations: MassConfiguration[];
  finStructure: FinStructureInfo;     // vincoli di fabbricazione, ipotesi, incertezze
  settings: { lengthUnit: 'mm' | 'cm' | 'm'; massUnit: 'g' | 'kg' };
}

interface RocketGeometry {
  nose: { shape: NoseShape; length: number; wallThickness: number; solid: boolean;
          shapeParameter: number; materialId: string; massOverride: MassOverride | null };
  body: { outerDiameter: number; length: number; wallThickness: number;
          materialId: string; massOverride: MassOverride | null };
  fins: { count: number; rootChord: number; tipChord: number; span: number; sweepLength: number;
          thickness: number; aftOffset: number; crossSection: 'square' | 'rounded' | 'airfoil';
          materialId: string; massOverride: MassOverride | null };
}

interface MassOverride { mass: number; massUncertainty: number }   // massa misurata

interface MassComponent {
  id: string; name: string; kind: 'generic' | 'motor';
  mass: number;            // per il motore: massa al decollo (inclusa carica)
  propellantMass: number;  // solo motore
  cgX: number;             // posizione del CG dalla punta
  length: number; diameter: number;   // opzionali (0 = non specificato), per la vista
  source: 'measured' | 'estimated';
  massUncertainty: number; positionUncertainty: number;  // ±, in SI
  notes: string;
}

interface MassConfiguration { id: string; name: string;
  excludedComponentIds: string[]; propellantFraction: number }  // 1 = pieno, 0 = burnout

interface Material { id: string; name: string; density: number;
  youngModulus: number | null; shearModulus: number | null; poissonRatio: number | null;
  confidence: 'typical' | 'datasheet' | 'tested' | 'unknown'; notes: string }
```

Risultati (prodotti da `analyzeProject`, mai salvati):

```ts
interface AnalysisResult {
  derived: DerivedGeometry;      // lunghezza totale, area di riferimento, finezza, pinne (area, AR, rapporto di rastremazione, MAC, posizioni)
  mass: MassBreakdown;           // voci con origine, massa totale, CG, incertezza
  stability: StabilityResult;    // CG, CP, CNα per contributo, margine [cal], affidabilità + motivi
  configurations: ConfigurationResult[];
  propellantSweep: { fraction: number; cg: number; margin: number }[];
  sensitivity: { tornado: TornadoEntry[]; monteCarlo: { samples, p05, p50, p95, min, max } };
  completeness: { score: number; items: CompletenessItem[] };
  issues: Issue[];               // { severity: 'error' | 'warning' | 'info', area, field?, message }
  assumptions: ModelAssumption[];// ipotesi dei modelli usati
}
```

---

## 6. Modelli fisici adottati (MVP)

**Masse strutturali** (stime da geometria, sostituibili da misure):
- Corpo: guscio cilindrico, `m = ρ·π/4·(D² − (D−2t)²)·L`, CG a metà lunghezza.
- Ogiva: integrazione numerica del profilo (guscio sottile `2πr·ds·t` oppure solido `πr²·dx`).
- Pinne: piastra trapezoidale `N·A·t·ρ`, CG nel baricentro del trapezio.

**Centro di pressione — metodo di Barrowman** (subsonico, piccoli angoli d'attacco):
- Ogiva: `CNα = 2`, `X_N = L − V/A_base` (corpo di rivoluzione snello; dà 2/3 L per il cono).
- Pinne trapezoidali: `CNα = K·4N(s/d)² / (1 + √(1 + (2l/(Cr+Ct))²))`, con `K = 1 + R/(s+R)` e posizione del CP secondo Barrowman.
- Il corpo cilindrico non contribuisce (ipotesi di Barrowman).
- `CP = Σ(CNα·X)/ΣCNα`; **margine statico = (CP − CG)/D** in calibri.

**Ipotesi dichiarate in UI**: flusso subsonico incomprimibile, angolo d'attacco piccolo (< ~10°), corpo rigido e assialsimmetrico, pinne piane sottili, nessuna transizione, nessun effetto di rotazione, interferenza solo tramite fattore K, formula di Barrowman esatta per 3–4 pinne (approssimata per altri numeri).

**Sensibilità**: tornado one-at-a-time (± incertezza su ogni massa, posizione e dimensione pinna) e Monte Carlo (campionamento uniforme entro le incertezze, 400 campioni, seme fisso per risultati ripetibili).

**Flutter**: nessun calcolo nell'MVP; solo raccolta dati e ipotesi, con indicazione esplicita che servono analisi aeroelastiche/prove specialistiche.

---

## 7. Roadmap incrementale

| Fase | Contenuto | Esito verificabile |
|---|---|---|
| **0 — Fondamenta** | Progetto Vite/TS, tipi, unità, materiali, progetto di default | Build e test vuoti verdi |
| **1 — Geometria + 3D** | Profili ogiva, pinne, viewer Three.js con aggiornamento live, toggle, assi, quote | Modifico un parametro e il 3D cambia |
| **2 — Masse** | Masse strutturali, componenti, motore, CG, grafico distribuzione, misurato/stimato | CG totale verificato su casi di test |
| **3 — Stabilità** | Barrowman, margine, configurazioni, curva vs propellente, avvisi di affidabilità | Confronto con valori di riferimento (cono 2/3 L, ecc.) |
| **4 — Sensibilità** | Tornado e Monte Carlo | Ranking dei parametri più influenti |
| **5 — Pinne/flutter** | Raccolta dati strutturali, ipotesi, area informativa | Nessun verdetto di sicurezza mostrato |
| **6 — Dashboard + progetti** | Riepilogo, completezza, salvataggio locale, import/export, annulla/ripeti | Esporto, reimporto e ottengo lo stesso progetto |
| **← MVP** | | |
| 7 — Estensioni | Transizioni/boattail, correzione di Mach, portanza del corpo, simulazione traiettoria, curve di spinta (.eng), export STL, confronto tra progetti, momenti d'inerzia | |
| 8 — Validazione | Confronto sistematico con OpenRocket e dati di volo, test unitari estesi | |
