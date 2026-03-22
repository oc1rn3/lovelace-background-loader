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


# Installationsmethode 1: Manuell
## Schritt 1
Installieren Sie den Hintergrundlader, indem Du die Datei background-loader.js aus diesem Repository in das Verzeichnis <Konfigurationsverzeichnis>/www/background-loader.js Ihre Home Assistant-Instanz kopierst.

## Schritt 2
Fügen die Ressource Deiner Konfiguration hinzu. Wenn Sie im YAML-Modus arbeiten, folgen Sie der Lovelace-Dokumentation. Wenn Sie die Benutzeroberfläche zur Ressourcenverwaltung verwenden, gehen Sie zu <Ihre-HA-Adresse>/config/lovelace/resources und fügen Sie die URL /local/background-loader.js als JavaScript-Modul hinzu.

## Schritt 3
Fügen Sie das benutzerdefinierte Element im Stammverzeichnis Ihrer ui-lovelace.yaml-Datei (oder in der Lovelace-Rohkonfiguration, falls Sie nicht im YAML-Modus arbeiten) hinzu, nicht in einer Ansicht oder Karte.

# Installationsmethode 2: HACS
## Schritt 1
Stellen Sie sicher, dass HACS installiert ist. Fügen Sie https://github.com/oc1rn3/lovelace-background-loader als benutzerdefiniertes Repository hinzu, suchen Sie im Bereich „Plugins“ nach „Homeassistant Lovelace Background-Loader“ und installieren Sie es.

## Schritt 2
Fügen Sie die Ressource Ihrer Konfiguration hinzu. Wenn Sie im YAML-Modus arbeiten, folgen Sie der Lovelace-Dokumentation und fügen Sie die URL /hacsfiles/lovelace-background-loader/background-loader.js als Modul hinzu. Wenn Sie die Benutzeroberfläche zur Ressourcenverwaltung verwenden, klicken Sie auf die Schaltfläche oben auf der HACS-Seite für „Homeassistant Lovelace Background-Loader“, um die Ressource automatisch hinzuzufügen.

## Schritt 3
Fügen Sie das benutzerdefinierte Element im Stammverzeichnis Ihrer ui-lovelace.yaml (oder der Lovelace-Rohkonfiguration, falls Sie nicht im YAML-Modus arbeiten) hinzu, nicht in einer Ansicht oder Karte.
