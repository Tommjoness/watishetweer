# Mobiele themakeuze — 15 september 2026

Doel: de compacte mobiele header niet langer laten eindigen in een gepropte `AUTO + zon/switch/maan`-cel.

Op viewports t/m 430 px wordt de bestaande bediening als één volle derde rij gepresenteerd: `AUTO | ☀ LICHT | ☾ DONKER`. De bestaande desktopbediening en het bestaande switch-/toegankelijkheidscontract blijven functioneel intact.

`AUTO` is de veilige standaard. Handmatige `Licht`/`Donker`-keuzes worden in `sessionStorage` bewaard onder `weerbriefing.thema.sessie`. De oudere `localStorage`-voorkeur `weerbriefing.thema` is niet langer bron van waarheid en wordt bij een nieuwe weather-documentstart eerst verwijderd. Daardoor kan een oude geforceerde lichte stand geen nieuwe browsersessie 's nachts licht openen. Een tijdelijke localStorage-mirror blijft uitsluitend bestaan voor bestaande subnavigatiecompatibiliteit binnen dezelfde sessie.

De locatiegebonden Auto-logica blijft `autoThemaOpZon(S.d, weatherNowActueleLokaleTijd())` gebruiken en schakelt via de bestaande minuutklok op zonnegrenzen. Forecast-, provider- en interpretatielogica worden niet gewijzigd.
