---
name: DDR Academy
description: Gestionale palestra squadrato, diretto, senza fronzoli — dove ogni bordo ha uno scopo
colors:
  yellow-accent: "#facc15"
  yellow-accent-border: "#eab308"
  green-positive: "#16a34a"
  red-danger: "#dc2626"
  neutral-bg-light: "#fafafa"
  neutral-bg-dark: "#0a0a0a"
  surface-light: "#ffffff"
  surface-dark: "#171717"
  ink-light: "#171717"
  ink-dark: "#ededed"
  border-light: "#e5e5e5"
  border-dark: "#262626"
typography:
  display:
    fontFamily: "Clash Display, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Satoshi, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  none: "0px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.yellow-accent-border}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.yellow-accent}"
    textColor: "{colors.ink-light}"
  button-positive:
    backgroundColor: "transparent"
    textColor: "{colors.green-positive}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.red-danger}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
---

# Design System: DDR Academy

## 1. Overview

**Creative North Star: "Il Pannello Comandi"**

DDR Academy non prova a sembrare un'app consumer da abbonato in palestra: è lo strumento che lo staff apre decine di volte al giorno tra un cliente e l'altro, e si comporta come un pannello comandi — squadrato, diretto, senza decorazione che non serva a orientarsi. Ogni elemento ha un bordo netto di 2px, zero angoli arrotondati, zero ombre: la gerarchia visiva viene dal bordo e dal colore, mai da un effetto di profondità. Il giallo è l'unico vero accento, usato con parsimonia da segnaletica industriale — dice "agisci qui" senza mai diventare decorazione diffusa.

Il sistema rifiuta esplicitamente due derive: il gestionale SaaS anonimo (card identiche ovunque, badge blu generici, gradient text da dashboard-template) e l'app-fitness da consumer store (progress ring, badge gamificati, confetti). Non è un prodotto da esplorare con calma — è un attrezzo da usare in fretta, con fiducia.

**Key Characteristics:**
- Zero border-radius ovunque (unica eccezione reale: i pallini di stato circolari)
- Accento giallo unico, riservato alle azioni che contano
- Verde/rosso solo per coppie di stato decisionali (mai per un semplice "crea")
- Piatto per disciplina: nessuna ombra, la separazione viene dal bordo
- Tipografia a due voci: display per i titoli, body per tutto il resto

## 2. Colors

Palette quasi monocroma (bianco/nero/grigio) con un unico vero accento cromatico, più due colori riservati a stati binari.

### Primary
- **Giallo Energia/Allerta** (#eab308 bordo, #facc15 hover fill): l'accento funzionale del sistema, usato per ogni CTA d'azione — creare, salvare, pubblicare, aggiungere. Come un cartello di sicurezza in un'officina: attira l'occhio solo dove serve agire, mai come sfondo o decorazione diffusa.

### Secondary (stati binari, non accenti)
- **Verde Positivo** (#16a34a / dark #22c55e): riservato a controlli di stato accoppiati (Approva/Rifiuta, Presente/Assente, Riattiva). Non è mai usato per un bottone "crea" generico.
- **Rosso Pericolo** (#dc2626 / dark #ef4444): controparte del verde nelle stesse coppie, più errori e azioni distruttive (rimuovi, disattiva).

### Neutral
- **Superficie chiara** (#ffffff) / **Superficie scura** (#171717): sfondo di card e pannelli.
- **Sfondo pagina chiaro** (#fafafa) / **Sfondo pagina scuro** (#0a0a0a): il livello dietro le superfici.
- **Inchiostro chiaro** (#171717) / **Inchiostro scuro** (#ededed): testo primario.
- **Bordo chiaro** (#e5e5e5) / **Bordo scuro** (#262626): separatori e contorni di card/tabelle.
- Testo secondario/muted usa la scala `neutral-400/500/600` di Tailwind, mai un grigio più chiaro sul corpo del testo.

### Named Rules
**La Regola dell'Unica Voce.** Il giallo è l'unico accento cromatico vero del sistema. Se un elemento non è un'azione primaria, non prende il giallo — prende neutro, o (solo per stati binari) verde/rosso.

## 3. Typography

**Display Font:** Clash Display (con fallback ui-sans-serif/system-ui)
**Body Font:** Satoshi (con fallback ui-sans-serif/system-ui)

**Character:** coppia a contrasto deciso: Clash Display porta autorevolezza geometrica ai titoli (h1/h2/h3), Satoshi resta discreto e leggibile nel corpo — nessuna delle due voci compete con l'altra, non ci sono più di due famiglie in gioco.

### Hierarchy
- **Display** (700, ~1.25rem+ / clamp per hero pubblico, line-height 1.2): titoli di pagina e sezione, sempre in Clash Display.
- **Title** (700/600, text-xl, line-height 1.3): titoli di card e modali (`pageTitle`).
- **Body** (400/500, text-sm, line-height 1.5, max 65-75ch): testo di default in tutta l'interfaccia, sia admin che pubblico.
- **Label** (500, text-xs, uppercase, tracking-wide): intestazioni di tabella e badge di stato.
- **Subtitle** (400, text-sm, colore attenuato): sottotitoli di pagina (`pageSubtitle`).

### Named Rules
**La Regola delle Due Voci.** Solo due famiglie in tutto il sistema. Se serve un terzo registro (es. dati tabellari), si usa un peso o una dimensione diversa di Satoshi, mai una terza famiglia.

## 4. Elevation

Sistema piatto per disciplina, non per mancanza di scelta: nessuna ombra in tutta l'interfaccia. La separazione tra elementi (card, tabelle, modali) viene esclusivamente dal bordo di 1-2px e dal contrasto tra superficie e sfondo pagina. Un pannello che galleggia sopra un altro (es. i modali) si distingue con un overlay scuro semi-trasparente dietro, non con un'ombra portata.

### Named Rules
**La Regola del Bordo, Non dell'Ombra.** Ogni confine tra elementi è un bordo esplicito (`border`/`border-2`), mai un box-shadow. Se un elemento sembra "staccato" dal resto senza un bordo visibile, è un errore da correggere, non un effetto da rifinire.

## 5. Components

### Buttons
- **Shape:** angoli vivi, zero radius, bordo 2px sempre visibile anche a riposo.
- **Primary** (`btnPrimary`): sfondo trasparente, bordo e testo giallo (#eab308 light / #facc15 dark); hover riempie di giallo con testo quasi nero. Riservato a create/aggiungi/salva/pubblica — mai a coppie di stato.
- **Positive/Danger** (`btnPositive`/`btnDanger`): stesso schema (trasparente → riempimento colore in hover) in verde/rosso, usati solo per decisioni di stato accoppiate (Approva/Rifiuta, Presente/Assente).
- **Neutral/Ghost** (`btnNeutral`/`btnGhost`): grigio pieno o trasparente, per azioni secondarie (annulla, chiudi).
- **Focus/Touch:** ogni bottone/controllo interattivo target minimo 44×44px (`min-h-11`/`h-11 w-11`), incluso su controlli custom accanto a `IconButton`.

### Tables
- **Style:** header con testo uppercase tenue (`th`), righe separate da `border-t`, mai zebra-striping.
- **Numbers/actions:** colonne numeriche o con badge/azioni sempre `whitespace-nowrap`; solo la colonna testo/nome si adatta liberamente.
- **Row actions:** icone con tooltip nativo (`IconButton`/`IconLink`), mai testo semplice; oltre 2-3 azioni per riga → `ActionsMenu` a kebab, non una fila di icone.

### Cards / Containers
- **Corner Style:** zero radius.
- **Background:** bianco (light) / neutral-900 (dark).
- **Shadow Strategy:** nessuna — vedi Elevation.
- **Border:** 1px `neutral-200`/`neutral-800`.
- **Internal Padding:** `p-4` standard.

### Inputs / Fields
- **Style:** bordo 1px neutro, sfondo bianco/neutral-800, zero radius, testo 16px sotto `sm:` (evita lo zoom automatico iOS al focus), 14px da `sm:` in su.
- **Focus:** bordo + ring giallo (`focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500`).
- **Disabled:** opacità 40%.

### List page pattern (Signature)
Ogni pagina lista (Servizi, Abbonamenti, Clienti, Fatture) segue lo stesso schema: creazione mai come form inline sempre visibile — un bottone `btnPrimary` "+ Nuovo X" apre/chiude un pannello di creazione; la lista resta di sola lettura con azioni nel kebab; filtri = campo ricerca + bottone "Filtri" con badge contatore che rivela un pannello `card` di filtri aggiuntivi.

### Loading state (Signature)
`Skeleton`/`SkeletonCards`/`SkeletonLines`/`SkeletonTableRows` sostituiscono ogni "Caricamento..." testuale: una pagina vuota durante il caricamento comunica "rotto", non "in corso".

## 6. Do's and Don'ts

### Do:
- **Do** usare bordi 2px come unico segnale di confine e stato (default/hover/focus), mai un'ombra.
- **Do** riservare il giallo (#eab308/#facc15) esclusivamente alle azioni primarie — create, salva, pubblica, aggiungi.
- **Do** usare verde/rosso solo per coppie di decisione di stato accoppiate (Approva/Rifiuta, Presente/Assente), mai come colore di un bottone "crea".
- **Do** garantire 44×44px minimo su ogni controllo interattivo, inclusi controlli custom.
- **Do** mostrare skeleton durante il caricamento di ogni lista o dettaglio, mai un semplice testo "Caricamento...".
- **Do** aprire la creazione con un bottone "+ Nuovo X" che rivela un pannello, mai un form sempre visibile in cima alla lista.

### Don't:
- **Don't** aggiungere border-radius in nessun componente (eccetto i pallini di stato circolari, l'unica eccezione reale).
- **Don't** usare box-shadow per separare elementi — è sempre un bordo esplicito.
- **Don't** far somigliare l'interfaccia a un gestionale SaaS anonimo: niente card identiche a raffica, niente badge blu generici, niente gradient text da dashboard-template.
- **Don't** far scivolare il tono verso l'app-fitness da consumer store: niente progress ring, badge gamificati, confetti — è uno strumento di lavoro per lo staff, non un'app da abbonato.
- **Don't** usare il verde per un'azione "crea" generica o il giallo per una decisione di stato accoppiata — i due registri di colore non si mescolano.
- **Don't** lasciare bottoni testuali semplici nelle righe di tabella: sempre icone con tooltip, o `ActionsMenu` oltre 2-3 azioni.
