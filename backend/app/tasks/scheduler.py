"""APScheduler setup for background tasks."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.tasks.expiry_monitor import check_expiring_items
from app.tasks.statement_refresh import refresh_expiring_statements

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_scheduler() -> AsyncIOScheduler:
    """Configure and return the scheduler with all jobs."""
    settings = get_settings()

    scheduler.add_job(
        refresh_expiring_statements,
        "interval",
        hours=settings.statement_refresh_interval_hours,
        id="statement_refresh",
        name="Refresh expiring statements",
        replace_existing=True,
    )

    scheduler.add_job(
        check_expiring_items,
        "interval",
        hours=6,
        id="expiry_monitor",
        name="Monitor expiring items",
        replace_existing=True,
    )

    return scheduler
