from pathlib import Path
import subprocess


RUNNER = Path(__file__)
EIGEN_BRON = RUNNER.read_text()


def lees_blokken():
    bron = Path('.github/workflows/apply-interpretatie-engine.yml').read_text().splitlines()
    blokken = []
    i = 0
    while i < len(bron):
        if bron[i].startswith('        run: |'):
            i += 1
            regels = []
            while i < len(bron) and not bron[i].startswith('      - name:') and not bron[i].startswith('      - uses:'):
                regels.append(bron[i][10:] if bron[i].startswith('          ') else bron[i])
                i += 1
            blokken.append('\n'.join(regels).rstrip() + '\n')
            continue
        i += 1
    return blokken


def commit_diagnose(tekst):
    if not RUNNER.exists():
        RUNNER.write_text(EIGEN_BRON)
    Path('INTERPRETATIE_DIAGNOSE.txt').write_text(tekst)
    subprocess.run(['git', 'config', 'user.name', 'WeatherNow Agent'], check=True)
    subprocess.run(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], check=True)
    subprocess.run(['git', 'add', 'INTERPRETATIE_DIAGNOSE.txt', 'run_staged.py'], check=True)
    subprocess.run(['git', 'commit', '-m', 'Leg interpretatie-enginefout vast'], check=True)
    subprocess.run(['git', 'push', 'origin', 'HEAD:agent/interpretatie-engine'], check=True)


def main():
    Path('INTERPRETATIE_DIAGNOSE.txt').unlink(missing_ok=True)
    blokken = lees_blokken()
    if len(blokken) != 5:
        commit_diagnose(f'Verwacht 5 uitvoerstappen, gevonden {len(blokken)}\n')
        raise SystemExit(1)

    log = []
    for nr, tekst in enumerate(blokken, 1):
        if nr == 5:
            RUNNER.unlink(missing_ok=True)
        pad = Path(f'/tmp/interpretatie-stap-{nr}.sh')
        pad.write_text('set -euo pipefail\n' + tekst)
        resultaat = subprocess.run(['bash', str(pad)], text=True, capture_output=True)
        log.append(
            f'===== STAP {nr} exit {resultaat.returncode} =====\n'
            f'STDOUT:\n{resultaat.stdout}\nSTDERR:\n{resultaat.stderr}\n'
        )
        if resultaat.returncode != 0:
            commit_diagnose(f'Stap {nr} faalde.\n\n' + '\n'.join(log))
            raise SystemExit(resultaat.returncode)


if __name__ == '__main__':
    main()
