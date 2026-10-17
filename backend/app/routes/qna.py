from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.auth import get_current_user

router = APIRouter()


def _display_name(user: models.User) -> str:
    """First name + last-initial, e.g. "Vaibhavi B." - same convention as
    review display names, never the full name or email."""
    name = (user.first_name or user.username or "Customer").strip()
    if user.last_name:
        name = f"{name} {user.last_name.strip()[0]}."
    return name


def _answer_to_response(answer: models.ProductAnswer) -> schemas.AnswerResponse:
    return schemas.AnswerResponse(
        id=answer.id,
        question_id=answer.question_id,
        user_id=answer.user_id,
        answer=answer.answer,
        is_seller_answer=answer.is_seller_answer,
        answerer_name=_display_name(answer.user),
        created_at=answer.created_at,
    )


def _question_to_response(question: models.ProductQuestion) -> schemas.QuestionResponse:
    return schemas.QuestionResponse(
        id=question.id,
        product_id=question.product_id,
        user_id=question.user_id,
        question=question.question,
        asker_name=_display_name(question.user),
        answers=[_answer_to_response(a) for a in question.answers],
        created_at=question.created_at,
    )


@router.get("/products/{product_id}/questions", response_model=list[schemas.QuestionResponse])
def get_product_questions(product_id: int, db: Session = Depends(get_db)):
    """Get all customer questions (with their answers) for a product,
    newest first - inspired by Nykaa's product Q&A."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    questions = (
        db.query(models.ProductQuestion)
        .filter(models.ProductQuestion.product_id == product_id)
        .order_by(models.ProductQuestion.created_at.desc())
        .all()
    )
    return [_question_to_response(q) for q in questions]


@router.post("/questions", response_model=schemas.QuestionResponse)
def create_question(
    question: schemas.QuestionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ask a question about a product. Visible to every shopper, same as
    answers - no question is private."""
    product = db.query(models.Product).filter(models.Product.id == question.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_question = models.ProductQuestion(
        product_id=question.product_id,
        user_id=current_user.id,
        question=question.question.strip(),
    )
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return _question_to_response(db_question)


@router.post("/questions/{question_id}/answers", response_model=schemas.QuestionResponse)
def create_answer(
    question_id: int,
    answer: schemas.AnswerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Answer a question. Any logged-in customer can answer, same as
    Nykaa's community-answered Q&A; the store owner's own answers are
    flagged is_seller_answer so shoppers can tell them apart."""
    db_question = db.query(models.ProductQuestion).filter(models.ProductQuestion.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.add(
        models.ProductAnswer(
            question_id=question_id,
            user_id=current_user.id,
            answer=answer.answer.strip(),
            is_seller_answer=current_user.is_admin,
        )
    )
    db.commit()
    db.refresh(db_question)
    return _question_to_response(db_question)


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete your own question (or any question, if you're the admin)."""
    db_question = db.query(models.ProductQuestion).filter(models.ProductQuestion.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")
    if db_question.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(db_question)
    db.commit()
    return {"detail": "Question deleted successfully"}


@router.delete("/answers/{answer_id}")
def delete_answer(
    answer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete your own answer (or any answer, if you're the admin)."""
    db_answer = db.query(models.ProductAnswer).filter(models.ProductAnswer.id == answer_id).first()
    if not db_answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    if db_answer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(db_answer)
    db.commit()
    return {"detail": "Answer deleted successfully"}
