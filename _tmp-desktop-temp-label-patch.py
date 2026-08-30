from pathlib import Path
import re
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
         een latere presentatielaag identieke afgeronde waarden wegfiltert. Index 0
         valt bewust onder het rode actuele label; vanaf index 3 moet ieder rasterpunt
         zichtbaar blijven. */
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


def patch_final_presentation():
    p = Path("scripts/apply-final-presentation-consistency.js")
    s = p.read_text()

    s = s.replace(
        "  10. De desktop-etmaalgrafiek houdt extrema en echte veranderingen, maar laat\n      overbodige identieke afgeronde rasterlabels wijken. */",
        "  10. De desktop-etmaalgrafiek behoudt ieder vast drie-uursreferentiepunt;\n      extrema en echte veranderingen mogen daar alleen extra labels aan toevoegen. */",
    )
    s = s.replace(
        "/* Mobiel gebruikt al een rustige zes-uursselectie. Desktop heeft meer ruimte,\n   maar hoeft identieke afgeronde temperaturen op nabije vaste rasterpunten niet\n   telkens opnieuw te schrijven. Extrema en prominente lokale punten blijven. */",
        "/* Mobiel gebruikt bewust een rustige zes-uursselectie. Desktop heeft genoeg\n   ruimte om in de 24-uursweergave ieder vaste drie-uursreferentiepunt te behouden.\n   Extrema en prominente lokale punten blijven daar als extra context bovenop staan. */",
    )

    pattern = re.compile(r"const GRAFIEK_LABELS_NIEUW=`[\s\S]*?`;(\n\n/\* Deze wrapper)")
    replacement = '''const GRAFIEK_LABELS_NIEUW=`  let kandidaten=n<=24?(M
    ?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0&&!kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=1)))
    :kandidatenRuw
  ):kandidatenRuw.filter((k,pos)=>{`;

/* Deze wrapper'''
    s2, count = pattern.subn(replacement, s, count=1)
    if count != 1:
        raise SystemExit(f"Verwacht exact één GRAFIEK_LABELS_NIEUW-blok, vervangen {count}")
    p.write_text(s2)

    v = Path("scripts/verify-final-presentation-consistency.js")
    t = v.read_text()
    old = '''ok(html.includes('const belangrijkNabij=kandidatenRuw.some'),"desktop etmaalgrafiek herkent redundante labels naast een belangrijk punt");
ok(html.includes('alle.slice(0,pos).some(g=>g.rang===1&&g.i<k.i&&k.i-g.i<=stap*2&&Math.round(T[g.i])===afgerond)'),"desktop etmaalgrafiek onderdrukt alleen nabije identieke afgeronde rasterwaarden");
ok(html.includes('?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0'),"mobiele rustige zes-uursselectie blijft behouden");'''
    new = '''ok(html.includes('?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0'),"mobiele rustige zes-uursselectie blijft behouden");
ok(html.includes(':kandidatenRuw\\n  ):kandidatenRuw.filter((k,pos)=>{'),"desktop etmaalgrafiek behoudt het volledige vaste drie-uursraster");
ok(!html.includes('const belangrijkNabij=kandidatenRuw.some'),"finale presentatielaag filtert desktop rasterlabels niet meer op afgerond gelijke temperatuur");'''
    if old not in t:
        raise SystemExit("Verwachte oude verifierchecks voor desktop grafieklabels ontbreken")
    v.write_text(t.replace(old, new))


def patch_source_comment():
    # De canonieke runtime in index.html hield desktop al onverkort; alleen de
    # postbuildlaag was fout. Laat de bronlogica daarom functioneel ongemoeid.
    p = Path("index.html")
    s = p.read_text()
    old = "  // drie-uursraster), alleen waar nog geen belangrijker punt staat"
    new = "  // drie-uursraster), alleen waar nog geen belangrijker punt staat"
    if old not in s:
        raise SystemExit("Canonieke drie-uursrasterbron niet gevonden")
    if new != old:
        p.write_text(s.replace(old, new))


if mode in ("test", "all"):
    patch_test()
if mode in ("final", "all"):
    patch_final_presentation()
if mode in ("source", "all"):
    patch_source_comment()
if mode not in ("test", "final", "source", "all"):
    raise SystemExit("Gebruik: test, final, source of all")
