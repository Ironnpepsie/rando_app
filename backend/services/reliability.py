from datetime import datetime

from models import Signalement, SignalementStatut

SEUIL_INVALIDE = 0  # score en dessous duquel un signalement est masqué


def confirmer(signalement: Signalement) -> Signalement:
    signalement.upvotes += 1
    signalement.score_fiabilite += 1
    return signalement


def recalculer_statut(signalement: Signalement) -> Signalement:
    if signalement.statut == SignalementStatut.invalide:
        return signalement

    now = datetime.utcnow()
    if now >= signalement.expire_at:
        signalement.statut = SignalementStatut.expire
    elif signalement.score_fiabilite <= SEUIL_INVALIDE:
        signalement.statut = SignalementStatut.invalide
    return signalement
