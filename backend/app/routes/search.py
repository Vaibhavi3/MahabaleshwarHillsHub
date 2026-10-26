from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user_optional

router = APIRouter()

MIN_TERM_LENGTH = 2


def _normalize(term: str) -> str:
    return " ".join(term.strip().lower().split())


@router.post("/search/log", status_code=204)
def log_search_query(
    payload: schemas.SearchQueryLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """Record a real, submitted search (called once a search actually lands
    on the results page), so "Trending Searches" reflects what shoppers
    are genuinely searching for - never a seeded or fabricated list.
    Logging a search is a side-effect, not a user-facing action, so a
    failure here never surfaces as an error to the shopper."""
    term = _normalize(payload.term)
    if len(term) < MIN_TERM_LENGTH:
        return
    db.add(models.SearchQuery(term=term, user_id=current_user.id if current_user else None))
    db.commit()


@router.get("/search/trending", response_model=list[schemas.TrendingSearchTerm])
def get_trending_searches(
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """The most common real search terms shoppers have actually typed, most
    searched first. Returns an empty list until the store has real search
    history to draw on - the panel hides itself rather than show anything
    made up (see SearchBox.js)."""
    rows = (
        db.query(models.SearchQuery.term, func.count(models.SearchQuery.id).label("cnt"))
        .group_by(models.SearchQuery.term)
        .order_by(func.count(models.SearchQuery.id).desc(), models.SearchQuery.term.asc())
        .limit(limit)
        .all()
    )
    return [schemas.TrendingSearchTerm(term=term, count=cnt) for term, cnt in rows]
