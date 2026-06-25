# -*- coding: utf-8 -*-
"""Construit les listes de mots Motus, classées par longueur et difficulté."""
import json, unicodedata, re

# 1. Dictionnaire de validation (mots français réels)
with open("dict.json", encoding="utf-8") as f:
    valid = set(w.lower() for w in json.load(f))

# 2. Liste de fréquence (ordre = du plus courant au plus rare)
freq = []
with open("freq.txt", encoding="utf-8") as f:
    for line in f:
        parts = line.split()
        if parts:
            freq.append(parts[0].lower())

ALLOWED = set("abcdefghijklmnopqrstuvwxyz")
ACCENTS = "àâäçéèêëîïôöùûüÿ"

def strip_accents(s):
    nfd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")

# mots à éviter (vulgaires / désagréables)
BLACKLIST = {"putain", "salope", "connard", "enculer", "encule", "encules",
             "merdes", "couilles", "couille", "salopes", "connards", "bordel",
             "chiotte", "chiottes", "pisser", "niquer", "nique", "niques"}

def normalize(w):
    base = strip_accents(w)
    if any(c not in ALLOWED for c in base):
        return None  # contient œ, æ, tiret, apostrophe, chiffre...
    return base

TARGETS = {6: 200, 7: 200, 8: 200, 9: 250}
TIERS = ["tres_facile", "facile", "moyen", "difficile", "tres_difficile"]

result = {}
for length, total in TARGETS.items():
    seen = set()
    pool = []  # mots valides, ordonnés par fréquence
    for w in freq:
        if w in BLACKLIST:
            continue
        if w not in valid:
            continue
        base = normalize(w)
        if base is None or len(base) != length:
            continue
        up = base.upper()
        if up in seen:
            continue
        seen.add(up)
        pool.append(up)
    # Découpe le pool en 5 bandes de fréquence, prend les plus courants de chaque bande
    per_tier = total // 5
    M = len(pool)
    band = M // 5
    tiers = {}
    for i, name in enumerate(TIERS):
        start = i * band
        end = start + band if i < 4 else M
        tiers[name] = pool[start:start + per_tier] if i < 4 else pool[start:start + per_tier]
        # ajuste si bande trop petite
        tiers[name] = pool[start:end][:per_tier]
    result[str(length)] = tiers
    counts = {k: len(v) for k, v in tiers.items()}
    print(f"{length} lettres: pool={M}, tiers={counts}")

with open("words.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=0)
print("words.json écrit")
