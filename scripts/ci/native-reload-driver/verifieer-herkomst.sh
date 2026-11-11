#!/bin/sh
# Herkomstcontrole van de twee vastgepinde Ubuntu-pakketten in deze map.
#
# Bewijst de hele keten, zonder iets te installeren:
#   1. dists/noble/InRelease draagt een geldige handtekening van de Ubuntu-archiefsleutel
#      (sleutelring uit het pakket ubuntu-keyring, /usr/share/keyrings/ubuntu-archive-keyring.gpg);
#   2. universe/binary-amd64/Packages.xz heeft de SHA-256 uit die ondertekende Release;
#   3. de pakketbestanden in deze map hebben de naam, grootte en SHA-256 uit die index.
#
# Alleen voor onderhoud (handmatig, op Ubuntu of Debian met gpgv, curl en xz). De CI-jobs draaien dit
# niet: die controleren de vaste SHA-256 uit de workflow en hebben geen pakketserver nodig.
#
# Gebruik: sh scripts/ci/native-reload-driver/verifieer-herkomst.sh
set -eu

MAP=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ARCHIEF=${UBUNTU_ARCHIEF:-http://archive.ubuntu.com/ubuntu}
SLEUTELRING=${UBUNTU_SLEUTELRING:-/usr/share/keyrings/ubuntu-archive-keyring.gpg}
SUITE=noble
INDEX=universe/binary-amd64/Packages.xz
VERSIE=1:3.20160805.1-5build1

test -r "$SLEUTELRING" || { echo "Sleutelring ontbreekt: $SLEUTELRING (pakket ubuntu-keyring)" >&2; exit 1; }
WERK=$(mktemp -d)
trap 'rm -rf -- "$WERK"' EXIT

curl -fsS --retry 3 --max-time 60 -o "$WERK/InRelease" "$ARCHIEF/dists/$SUITE/InRelease"
gpgv --quiet --keyring "$SLEUTELRING" --output "$WERK/Release" "$WERK/InRelease"
echo "1/3 InRelease ($SUITE): geldige handtekening van de Ubuntu-archiefsleutel"

VERWACHT=$(awk -v pad="$INDEX" '/^SHA256:/{sha=1;next} /^[^ ]/{sha=0} sha&&$3==pad{print $1;exit}' "$WERK/Release")
test -n "$VERWACHT" || { echo "Geen SHA-256 voor $INDEX in de ondertekende Release" >&2; exit 1; }
curl -fsS --retry 3 --max-time 180 -o "$WERK/Packages.xz" "$ARCHIEF/dists/$SUITE/$INDEX"
echo "$VERWACHT  $WERK/Packages.xz" | sha256sum --check --strict --quiet -
xz -dc "$WERK/Packages.xz" > "$WERK/Packages"
echo "2/3 $INDEX: SHA-256 gelijk aan de ondertekende Release"

for PAKKET in libxdo3 xdotool; do
  awk -v p="$PAKKET" 'BEGIN{RS="";FS="\n"} $1=="Package: "p{print}' "$WERK/Packages" > "$WERK/$PAKKET.stanza"
  veld() { sed -n "s/^$1: //p" "$WERK/$PAKKET.stanza"; }
  test "$(veld Version)" = "$VERSIE" || { echo "$PAKKET: index noemt versie $(veld Version), verwacht $VERSIE" >&2; exit 1; }
  test "$(veld Architecture)" = amd64 || { echo "$PAKKET: architectuur is niet amd64" >&2; exit 1; }
  BESTAND=$(basename "$(veld Filename)")
  test -f "$MAP/$BESTAND" || { echo "$PAKKET: $BESTAND ontbreekt in $MAP" >&2; exit 1; }
  test "$(wc -c < "$MAP/$BESTAND" | tr -d ' ')" = "$(veld Size)" || { echo "$PAKKET: grootte wijkt af van de index" >&2; exit 1; }
  echo "$(veld SHA256)  $MAP/$BESTAND" | sha256sum --check --strict --quiet -
  echo "    $PAKKET $(veld Version) amd64"
  echo "    sha256  $(veld SHA256)"
  echo "    depends $(veld Depends)"
done
echo "3/3 beide pakketbestanden: naam, grootte en SHA-256 gelijk aan de ondertekende index"
