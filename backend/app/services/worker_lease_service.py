from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import WorkerLease


class WorkerLeaseService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def acquire(self, *, lock_key: str, owner_id: str, lease_seconds: int) -> bool:
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=max(1, lease_seconds))

        lease = self.db.get(WorkerLease, lock_key)
        if lease is None:
            self.db.add(
                WorkerLease(
                    lock_key=lock_key,
                    owner_id=owner_id,
                    lease_expires_at=expires_at,
                    updated_at=now,
                )
            )
            try:
                self.db.commit()
                return True
            except IntegrityError:
                self.db.rollback()
                lease = self.db.get(WorkerLease, lock_key)

        if lease is None:
            return False

        lease_expires_at = self._as_utc(lease.lease_expires_at)
        expired = lease_expires_at <= now
        if lease.owner_id == owner_id or expired:
            lease.owner_id = owner_id
            lease.lease_expires_at = expires_at
            lease.updated_at = now
            self.db.add(lease)
            self.db.commit()
            return True

        return False

    def release(self, *, lock_key: str, owner_id: str) -> None:
        lease = self.db.get(WorkerLease, lock_key)
        if lease is None:
            return
        if lease.owner_id != owner_id:
            return
        self.db.delete(lease)
        self.db.commit()

    def _as_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
