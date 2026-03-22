# Homeassistant Lovelace Background-Loader

## Zweck

Der Background Loader ersetzt die andere Integrationen wie 
„lovelace-animated-background" durch ein eigenes Script, das
Hintergrundbilder ohne Dashboard-Reload aktualisiert.

## Kurzüberblick

-   Pro Dashboard aktivierbar (`bg_loader`)
-   Dynamisches Overlay für bessere Lesbarkeit
-   Steuerung über feste URL oder Entität
-   Optionaler Intervall oder rein eventbasiert
-   Kein Flackern durch Double Buffering

------------------------------------------------------------------------

## Beispiel-Konfiguration

``` yaml
bg_loader:
  enabled: true
  entity: input_text.background_url
  entity_mode: url
  default_overlay: 0.46
  min_overlay: 0.22
  max_overlay: 0.76
  fade_duration: 30
  interval: 0
  reload_on_foreground: false
  debug: true
```

------------------------------------------------------------------------

## Optionen

### enabled

Aktiviert das Script für das Dashboard.

### url

Feste Bild-URL (Fallback oder Standard).

### entity

HA-Entität zur Steuerung.

### entity_mode

-   trigger → Entität löst nur Reload aus
-   url → Entität enthält Bild-URL

### default_overlay

Startwert für Abdunklung.

### min_overlay / max_overlay

Grenzen für Overlay.

### fade_duration

Übergangszeit zwischen Bildern (ms).

### interval

Zeitgesteuertes Nachladen (ms), 0 = deaktiviert.

### reload_on_foreground

Neuladen bei Fokuswechsel: - true → aktiv - false → deaktiviert

### debug

Konsole-Logs aktivieren.

------------------------------------------------------------------------

## Betriebsarten

### Zentral gesteuert (empfohlen)

``` yaml
entity_mode: url
interval: 0
reload_on_foreground: false
```

→ Steuerung komplett über Entität

------------------------------------------------------------------------

## Automation Beispiel

``` yaml
alias: Hintergrundbild laden
triggers:
  - trigger: time_pattern
    minutes: "/5"
actions:
  - action: input_text.set_value
    target:
      entity_id: input_text.background_url
    data:
      value: "http://example.local/cam.jpg?ts={{ now().timestamp() | int }}"
```

------------------------------------------------------------------------

## Voraussetzungen

### CORS notwendig

``` apache
Header set Access-Control-Allow-Origin "*"
```

------------------------------------------------------------------------

## Hinweise

-   Script nutzt interne HA-Strukturen → stabil, aber nicht offiziell
    dokumentiert
-   Overlay-Werte müssen individuell angepasst werden
-   Ideal für Wandtablets

------------------------------------------------------------------------

## Fazit

Beste Kombination für dein Setup:

``` yaml
entity_mode: url
interval: 0
reload_on_foreground: false
```

→ volle Kontrolle, kein unnötiger Reload, saubere Darstellung


# Installation Method 1: Manual
Step 1
Install background loader by copying background-loader.js from this repo to <config directory>/www/background-loader.js on your Home Assistant instance.

Step 2
Add the resource to your configuration. If you are in yaml mode follow the lovelace docs. If you are using the UI to manage resources then go you <your-ha-address>/config/lovelace/resources and add the URL /local/animated-background.js as a javascript module.

Step 3
Add the custom element in the root of your ui-lovelace.yaml (or Lovelace raw configuration if not in yaml mode), not in a view or card.

Installation Method 2: HACS
Step 1
Make sure you have HACS installed, add https://github.com/oc1rn3/lovelace-background-loader as custom repo and find Animated Background in the plug section, and install.

Step 2
Add the resource to your configuration. If you are in yaml mode follow the lovelace docs and add the URL /hacsfiles/lovelace-background-loader/background-loader.js as a module. If you are using the UI to manage resources then click the button at the top of the Animated Background HACS page to automatically add it to your resources.

Step 3
Add the custom element in the root of your ui-lovelace.yaml (or Lovelace raw configuration if not in yaml mode), not in a view or card.

