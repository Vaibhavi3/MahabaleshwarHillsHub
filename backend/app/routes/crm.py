from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.utils.auth import get_current_admin_user

router = APIRouter()

LEAD_STATUSES = {"new", "contacted", "qualified", "proposal", "won", "lost"}
ACTIVITY_TYPES = {"note", "call", "email", "meeting", "task"}


def _name(user):
    return " ".join(part for part in [user.first_name, user.last_name] if part).strip() or user.username


def _customer_summary(user, stats):
    value = stats.get(user.id, {})
    return {
        "id": user.id,
        "name": _name(user),
        "email": user.email,
        "phone": user.phone,
        "city": user.city,
        "created_at": user.created_at,
        "order_count": value.get("order_count", 0),
        "lifetime_value": float(value.get("lifetime_value", 0) or 0),
        "last_order_at": value.get("last_order_at"),
    }


def _activity_response(activity, db):
    customer = db.query(models.User).filter(models.User.id == activity.customer_id).first() if activity.customer_id else None
    lead = db.query(models.CRMLead).filter(models.CRMLead.id == activity.lead_id).first() if activity.lead_id else None
    return {
        "id": activity.id,
        "customer_id": activity.customer_id,
        "lead_id": activity.lead_id,
        "created_by_id": activity.created_by_id,
        "type": activity.type,
        "title": activity.title,
        "description": activity.description,
        "due_date": activity.due_date,
        "completed": activity.completed,
        "created_at": activity.created_at,
        "updated_at": activity.updated_at,
        "customer_name": _name(customer) if customer else None,
        "lead_name": " ".join(part for part in [lead.first_name, lead.last_name] if part).strip() if lead else None,
    }


@router.get("/crm/overview", response_model=schemas.CRMOverviewResponse)
def get_overview(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    total_customers = db.query(models.User).filter(models.User.is_admin == False).count()
    total_orders = db.query(models.Order).count()
    total_revenue = db.query(func.coalesce(func.sum(models.Order.total_amount), 0)).scalar() or 0
    active_leads = db.query(models.CRMLead).filter(models.CRMLead.status.notin_(["won", "lost"])).count()
    open_tasks = db.query(models.CRMActivity).filter(models.CRMActivity.type == "task", models.CRMActivity.completed == False).count()

    pipeline_rows = db.query(models.CRMLead.status, func.count(models.CRMLead.id), func.coalesce(func.sum(models.CRMLead.value), 0)).group_by(models.CRMLead.status).all()
    pipeline = {status: {"count": count, "value": float(value or 0)} for status, count, value in pipeline_rows}

    recent_rows = db.query(models.Order, models.User).join(models.User, models.User.id == models.Order.user_id).order_by(models.Order.created_at.desc()).limit(8).all()
    recent_orders = [{
        "id": order.id,
        "order_number": order.order_number,
        "customer_name": _name(user),
        "total_amount": order.total_amount,
        "status": order.status,
        "created_at": order.created_at,
    } for order, user in recent_rows]

    return {
        "total_customers": total_customers,
        "total_orders": total_orders,
        "total_revenue": float(total_revenue),
        "active_leads": active_leads,
        "open_tasks": open_tasks,
        "recent_orders": recent_orders,
        "pipeline": pipeline,
    }


@router.get("/crm/customers", response_model=list[schemas.CRMCustomerSummary])
def list_customers(
    search: Optional[str] = Query(None, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    query = db.query(models.User).filter(models.User.is_admin == False)
    if search:
        term = "%" + search.strip() + "%"
        query = query.filter(or_(models.User.username.ilike(term), models.User.email.ilike(term), models.User.first_name.ilike(term), models.User.last_name.ilike(term)))
    users = query.order_by(models.User.created_at.desc()).offset(skip).limit(limit).all()
    user_ids = [user.id for user in users]
    stats = {}
    if user_ids:
        rows = db.query(models.Order.user_id, func.count(models.Order.id), func.coalesce(func.sum(models.Order.total_amount), 0), func.max(models.Order.created_at)).filter(models.Order.user_id.in_(user_ids)).group_by(models.Order.user_id).all()
        stats = {user_id: {"order_count": count, "lifetime_value": value, "last_order_at": last_order_at} for user_id, count, value, last_order_at in rows}
    return [_customer_summary(user, stats) for user in users]


@router.get("/crm/customers/{customer_id}", response_model=schemas.CRMCustomerDetail)
def get_customer(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    customer = db.query(models.User).filter(models.User.id == customer_id, models.User.is_admin == False).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    rows = db.query(models.Order.user_id, func.count(models.Order.id), func.coalesce(func.sum(models.Order.total_amount), 0), func.max(models.Order.created_at)).filter(models.Order.user_id == customer_id).group_by(models.Order.user_id).all()
    stats = {customer_id: {"order_count": rows[0][1], "lifetime_value": rows[0][2], "last_order_at": rows[0][3]}} if rows else {}
    orders = db.query(models.Order).filter(models.Order.user_id == customer_id).order_by(models.Order.created_at.desc()).limit(50).all()
    activities = db.query(models.CRMActivity).filter(models.CRMActivity.customer_id == customer_id).order_by(models.CRMActivity.created_at.desc()).limit(50).all()
    return {
        "customer": _customer_summary(customer, stats),
        "orders": [{"id": order.id, "order_number": order.order_number, "total_amount": order.total_amount, "status": order.status, "payment_status": order.payment_status, "created_at": order.created_at} for order in orders],
        "activities": [_activity_response(activity, db) for activity in activities],
    }


@router.get("/crm/leads", response_model=list[schemas.CRMLeadResponse])
def list_leads(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    query = db.query(models.CRMLead)
    if status:
        query = query.filter(models.CRMLead.status == status)
    if search:
        term = "%" + search.strip() + "%"
        query = query.filter(or_(models.CRMLead.first_name.ilike(term), models.CRMLead.last_name.ilike(term), models.CRMLead.email.ilike(term), models.CRMLead.company.ilike(term)))
    return query.order_by(models.CRMLead.created_at.desc()).all()


@router.post("/crm/leads", response_model=schemas.CRMLeadResponse, status_code=201)
def create_lead(lead: schemas.CRMLeadCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    if lead.status not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid lead status")
    db_lead = models.CRMLead(**lead.model_dump())
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead


@router.patch("/crm/leads/{lead_id}", response_model=schemas.CRMLeadResponse)
def update_lead(lead_id: int, lead: schemas.CRMLeadUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_lead = db.query(models.CRMLead).filter(models.CRMLead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    updates = lead.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid lead status")
    for key, value in updates.items():
        setattr(db_lead, key, value)
    db.commit()
    db.refresh(db_lead)
    return db_lead


@router.get("/crm/activities", response_model=list[schemas.CRMActivityResponse])
def list_activities(
    customer_id: Optional[int] = Query(None),
    lead_id: Optional[int] = Query(None),
    open_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user),
):
    query = db.query(models.CRMActivity)
    if customer_id:
        query = query.filter(models.CRMActivity.customer_id == customer_id)
    if lead_id:
        query = query.filter(models.CRMActivity.lead_id == lead_id)
    if open_only:
        query = query.filter(models.CRMActivity.completed == False)
    activities = query.order_by(models.CRMActivity.completed.asc(), models.CRMActivity.due_date.asc(), models.CRMActivity.created_at.desc()).limit(100).all()
    return [_activity_response(activity, db) for activity in activities]


@router.post("/crm/activities", response_model=schemas.CRMActivityResponse, status_code=201)
def create_activity(activity: schemas.CRMActivityCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    if activity.type not in ACTIVITY_TYPES:
        raise HTTPException(status_code=400, detail="Invalid activity type")
    if not activity.customer_id and not activity.lead_id:
        raise HTTPException(status_code=400, detail="An activity needs a customer or lead")
    if activity.customer_id and not db.query(models.User).filter(models.User.id == activity.customer_id, models.User.is_admin == False).first():
        raise HTTPException(status_code=404, detail="Customer not found")
    if activity.lead_id and not db.query(models.CRMLead).filter(models.CRMLead.id == activity.lead_id).first():
        raise HTTPException(status_code=404, detail="Lead not found")
    db_activity = models.CRMActivity(**activity.model_dump(), created_by_id=current_user.id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return _activity_response(db_activity, db)


@router.patch("/crm/activities/{activity_id}", response_model=schemas.CRMActivityResponse)
def update_activity(activity_id: int, activity: schemas.CRMActivityUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_activity = db.query(models.CRMActivity).filter(models.CRMActivity.id == activity_id).first()
    if not db_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    updates = activity.model_dump(exclude_unset=True)
    if "type" in updates and updates["type"] not in ACTIVITY_TYPES:
        raise HTTPException(status_code=400, detail="Invalid activity type")
    for key, value in updates.items():
        setattr(db_activity, key, value)
    db.commit()
    db.refresh(db_activity)
    return _activity_response(db_activity, db)
