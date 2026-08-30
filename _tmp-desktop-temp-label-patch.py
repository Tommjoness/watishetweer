from pathlib import Path
import sys

mode = sys.argv[1] if len(sys.argv) > 1 else "all"


def patch_test():
    p = Path("graph-stress-browser.test.js")
    s = p.read_text()
    if "const rasterDekking=rasterTempIndices.every" in s:
        return

    marker = "      const temperatuurDekking=tempIndices.length>=5&&maxTempGap<=6;"
    if s.count(marker) != 1:
        raise SystemExit(f"Verwacht exact één temperatuurDekking-marker, gevonden {s.count(marker)}")
    toevoeging = """      /* Desktop 24 uur heeft genoeg horizontale ruimte voor het vaste drie-uursraster.
         Dat raster is het minimale visuele contract: lokale pieken/dalen mogen extra
         labels toevoegen, maar nooit 06:00/09:00-achtige gaten veroorzaken doordat
         ze eerder in de collision queue terechtkomen. Index 0 valt bewust onder het
         rode actuele label; vanaf index 3 moet ieder rasterpunt zichtbaar blijven. */
      const rasterTempIndices=[3,6,9,12,15,18,21,24];
      const rasterDekking=rasterTempIndices.every(i=>tempIndices.includes(i));"""
    s = s.replace(marker, marker + "\n" + toevoeging)

    old_result = "const resultaat=!!(chart&&regenGroep&&temperatuurDekking&&brackets.length>=4"
    new_result = "const resultaat=!!(chart&&regenGroep&&temperatuurDekking&&rasterDekking&&brackets.length>=4"
    if s.count(old_result) != 1:
        raise SystemExit(f"Verwacht exact één resultaatmarker, gevonden {s.count(old_result)}")
    s = s.replace(old_result, new_result)

    dataset_marker = "      document.body.dataset.graphStressMaxTempGap=String(maxTempGap);"
    if s.count(dataset_marker) != 1:
        raise SystemExit(f"Verwacht exact één datasetmarker, gevonden {s.count(dataset_marker)}")
    s = s.replace(dataset_marker, dataset_marker + "\n      document.body.dataset.graphStressRaster=rasterDekking?'ok':'fout';")

    error_marker = 'maxTempGap="+waarde("graph-stress-max-temp-gap")+", perioden='
    if s.count(error_marker) != 1:
        raise SystemExit(f"Verwacht exact één foutmeldingsmarker, gevonden {s.count(error_marker)}")
    s = s.replace(error_marker, 'maxTempGap="+waarde("graph-stress-max-temp-gap")+", raster="+waarde("graph-stress-raster")+", perioden=')

    s = s.replace(
        "temperatuurreferenties maximaal zes uur uit elkaar, meerdere regenperioden en geen labelbotsingen.",
        "alle drie-uursreferenties zichtbaar, temperatuurreferenties maximaal zes uur uit elkaar, meerdere regenperioden en geen labelbotsingen.",
    )
    p.write_text(s)


def patch_runtime():
    p = Path("index.html")
    s = p.read_text()
    new_block = """  // 6: reguliere, gelijkmatig verdeelde referentiepunten. Op desktop is het
  // drie-uursraster binnen 24 uur het minimale leesbaarheidscontract: die vaste
  // referenties gaan vóór extra lokale pieken/dalen, zodat een rustige of licht
  // golvende periode nooit zes tot negen uur zonder temperatuurcijfer kan raken.
  for(let i=0;i<T.length;i++){
    if(!geldig(i)||i%stap!==0) continue;
    zet(i,n<=24&&!M?4:1);
  }"""
    if new_block in s:
        return
    old_block = """  // 6: reguliere, gelijkmatig verdeelde referentiepunten (het bestaande
  // drie-uursraster), alleen waar nog geen belangrijker punt staat
  for(let i=0;i<T.length;i++){
    if(!geldig(i)||i%stap!==0) continue;
    if(!kandKaart.has(i)) kandKaart.set(i,1);
  }"""
    if s.count(old_block) != 1:
        raise SystemExit(f"Verwacht exact één rasterkandidaat-anker, gevonden {s.count(old_block)}")
    s = s.replace(old_block, new_block)
    p.write_text(s)


if mode in ("test", "all"):
    patch_test()
if mode in ("runtime", "all"):
    patch_runtime()
if mode not in ("test", "runtime", "all"):
    raise SystemExit("Gebruik: test, runtime of all")
