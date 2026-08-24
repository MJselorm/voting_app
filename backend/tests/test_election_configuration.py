from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.election import (
    Election,
    ElectionApproval,
    ElectionAuditLog,
    ElectionOfficialAssignment,
    ElectionPosition,
    ElectionStatus,
    ResultVisibility,
)
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.election import (
    ElectionCreateRequest,
    ElectionUpdateRequest,
    EligibilityCriteriaSchema,
    PositionCreateRequest,
)
from app.services.elections import (
    calculate_eligibility_estimate,
    create_election,
    ensure_can_access_election,
    ensure_can_create_election,
    get_election_by_id,
    record_official_approval,
    record_rejection,
    submit_election_for_approval,
    super_admin_final_approval,
    update_election,
    validate_for_submission,
)

test_engine = create_async_engine(
    settings.async_database_url,
    poolclass=NullPool,
)
TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def run_in_session(test_func):
    async with TestAsyncSessionLocal() as session:
        try:
            await test_func(session)
        finally:
            await session.rollback()


# ── 1, 2, 3: Role-based creation permissions ─────────────────────────────────

def test_super_admin_and_official_can_create_student_cannot():
    admin = User(id=uuid.uuid4(), firebase_uid="u1", full_name="Admin", email="a@u.edu", role=UserRole.SUPER_ADMIN)
    official = User(id=uuid.uuid4(), firebase_uid="u2", full_name="Official", email="o@u.edu", role=UserRole.ELECTION_OFFICIAL)
    student = User(id=uuid.uuid4(), firebase_uid="u3", full_name="Student", email="s@u.edu", role=UserRole.STUDENT)

    # Super Admin and Official pass
    ensure_can_create_election(admin)
    ensure_can_create_election(official)

    # Student fails with 403
    with pytest.raises(HTTPException) as exc:
        ensure_can_create_election(student)
    assert exc.value.status_code == 403


# ── 4, 5: Draft election saving incomplete and editing ───────────────────────

def test_draft_election_save_and_update():
    async def _test(db_session):
        official = User(
            id=uuid.uuid4(),
            firebase_uid=f"uid_off_{uuid.uuid4().hex[:6]}",
            full_name="Official User",
            email=f"off_{uuid.uuid4().hex[:6]}@univ.edu",
            role=UserRole.ELECTION_OFFICIAL,
            is_active=True,
        )
        db_session.add(official)
        await db_session.flush()

        # Save minimal draft
        create_req = ElectionCreateRequest(
            name="CSE Election 2026 Draft",
            department="Computer Science and Engineering",
            election_type="Departmental Election",
        )
        election = await create_election(db_session, official, create_req)
        assert election.status == ElectionStatus.DRAFT
        assert election.name == "CSE Election 2026 Draft"
        assert election.created_by == official.id

        # Edit draft
        update_req = ElectionUpdateRequest(
            name="CSE Election 2026 Updated",
            description="Updated description",
        )
        updated = await update_election(db_session, election.id, official, update_req)
        assert updated.name == "CSE Election 2026 Updated"
        assert updated.description == "Updated description"

    asyncio.run(run_in_session(_test))


# ── 6, 7: Date validation (end > start) ──────────────────────────────────────

def test_invalid_dates_rejected():
    async def _test(db_session):
        official = User(
            id=uuid.uuid4(),
            firebase_uid=f"uid_dates_{uuid.uuid4().hex[:6]}",
            full_name="Official Dates",
            email=f"dates_{uuid.uuid4().hex[:6]}@univ.edu",
            role=UserRole.ELECTION_OFFICIAL,
            is_active=True,
        )
        db_session.add(official)
        await db_session.flush()

        now = datetime.now(timezone.utc)
        # End before start
        req = ElectionCreateRequest(
            name="Invalid Dates Election",
            start_at=now + timedelta(days=2),
            end_at=now + timedelta(days=1),
        )
        with pytest.raises(HTTPException) as exc:
            await create_election(db_session, official, req)
        assert exc.value.status_code == 400
        assert "end time must be after start time" in exc.value.detail.lower()

    asyncio.run(run_in_session(_test))


# ── 8, 9, 10, 11: Position management and reordering ────────────────────────

def test_position_addition_editing_removal_reordering():
    async def _test(db_session):
        official = User(
            id=uuid.uuid4(),
            firebase_uid=f"uid_pos_{uuid.uuid4().hex[:6]}",
            full_name="Official Pos",
            email=f"pos_{uuid.uuid4().hex[:6]}@univ.edu",
            role=UserRole.ELECTION_OFFICIAL,
            is_active=True,
        )
        db_session.add(official)
        await db_session.flush()

        create_req = ElectionCreateRequest(
            name="Positions Test Election",
            positions=[
                PositionCreateRequest(name="President", display_order=1, number_of_winners=1),
                PositionCreateRequest(name="Vice President", display_order=2, number_of_winners=1),
                PositionCreateRequest(name="Secretary", display_order=3, number_of_winners=1),
            ],
        )
        election = await create_election(db_session, official, create_req)
        assert len(election.positions) == 3

        # Update positions: Reorder and remove Secretary, add Treasurer
        update_req = ElectionUpdateRequest(
            positions=[
                PositionCreateRequest(name="Vice President", display_order=1, number_of_winners=1),
                PositionCreateRequest(name="President", display_order=2, number_of_winners=1),
                PositionCreateRequest(name="Treasurer", display_order=3, number_of_winners=1),
            ]
        )
        updated = await update_election(db_session, election.id, official, update_req)
        pos_names = [p.name for p in sorted(updated.positions, key=lambda p: p.display_order)]
        assert pos_names == ["Vice President", "President", "Treasurer"]

    asyncio.run(run_in_session(_test))


# ── 12, 13: Official assignment without altering historical elections ────────

def test_official_assignments_history_preserved():
    async def _test(db_session):
        off1 = User(id=uuid.uuid4(), firebase_uid=f"u1_{uuid.uuid4().hex[:6]}", full_name="Official 1", email=f"o1_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.ELECTION_OFFICIAL, is_active=True)
        off2 = User(id=uuid.uuid4(), firebase_uid=f"u2_{uuid.uuid4().hex[:6]}", full_name="Official 2", email=f"o2_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.ELECTION_OFFICIAL, is_active=True)
        off3 = User(id=uuid.uuid4(), firebase_uid=f"u3_{uuid.uuid4().hex[:6]}", full_name="Official 3", email=f"o3_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.ELECTION_OFFICIAL, is_active=True)
        admin = User(id=uuid.uuid4(), firebase_uid=f"ua_{uuid.uuid4().hex[:6]}", full_name="Admin", email=f"adm_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.SUPER_ADMIN, is_active=True)
        db_session.add_all([off1, off2, off3, admin])
        await db_session.flush()

        # Election 2026: Assign off1 & off2
        e2026_req = ElectionCreateRequest(
            name="CSE 2026 Election",
            official_user_ids=[off1.id, off2.id],
        )
        e2026 = await create_election(db_session, admin, e2026_req)

        # Election 2027: Assign off2 & off3
        e2027_req = ElectionCreateRequest(
            name="CSE 2027 Election",
            official_user_ids=[off2.id, off3.id],
        )
        e2027 = await create_election(db_session, admin, e2027_req)

        # Verify e2026 assignments remain intact!
        e2026_reloaded = await get_election_by_id(db_session, e2026.id)
        e2027_reloaded = await get_election_by_id(db_session, e2027.id)
        assigned_2026_ids = {a.user_id for a in e2026_reloaded.official_assignments}
        assigned_2027_ids = {a.user_id for a in e2027_reloaded.official_assignments}

        assert assigned_2026_ids == {off1.id, off2.id}
        assert assigned_2027_ids == {off2.id, off3.id}

    asyncio.run(run_in_session(_test))


# ── 14, 15: Live eligibility estimate without student data duplication ───────

def test_live_eligibility_estimation():
    async def _test(db_session):
        st1 = Student(id=uuid.uuid4(), student_id=f"S1_{uuid.uuid4().hex[:4]}", full_name="S One", department="Computer Science and Engineering", level="200", class_="CSE-A", status="ACTIVE")
        st2 = Student(id=uuid.uuid4(), student_id=f"S2_{uuid.uuid4().hex[:4]}", full_name="S Two", department="Computer Science and Engineering", level="300", class_="CSE-B", status="ACTIVE")
        st3 = Student(id=uuid.uuid4(), student_id=f"S3_{uuid.uuid4().hex[:4]}", full_name="S Three", department="Computer Science and Engineering", level="200", class_="CSE-A", status="INACTIVE")
        st4 = Student(id=uuid.uuid4(), student_id=f"S4_{uuid.uuid4().hex[:4]}", full_name="S Four", department="Electrical Engineering", level="200", class_="EE-A", status="ACTIVE")
        db_session.add_all([st1, st2, st3, st4])
        await db_session.flush()

        # Estimate for active CSE level 200
        criteria = EligibilityCriteriaSchema(
            departments=["Computer Science and Engineering"],
            levels=["200"],
            statuses=["ACTIVE"],
        )
        count, _ = await calculate_eligibility_estimate(db_session, criteria)
        assert count >= 1

    asyncio.run(run_in_session(_test))


# ── 16: Result visibility persistence ────────────────────────────────────────

def test_result_visibility_persists():
    async def _test(db_session):
        admin = User(id=uuid.uuid4(), firebase_uid=f"u_rv_{uuid.uuid4().hex[:6]}", full_name="Admin", email=f"rv_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.SUPER_ADMIN, is_active=True)
        db_session.add(admin)
        await db_session.flush()

        req = ElectionCreateRequest(
            name="Visibility Election",
            result_visibility=ResultVisibility.PUBLIC_LIVE,
        )
        election = await create_election(db_session, admin, req)
        assert election.result_visibility == ResultVisibility.PUBLIC_LIVE

        updated = await update_election(
            db_session, election.id, admin,
            ElectionUpdateRequest(result_visibility=ResultVisibility.HIDDEN_UNTIL_ENDED),
        )
        assert updated.result_visibility == ResultVisibility.HIDDEN_UNTIL_ENDED

    asyncio.run(run_in_session(_test))


# ── 17-28: Complete Approval Lifecycle ───────────────────────────────────────

def test_complete_approval_workflow():
    async def _test(db_session):
        off1 = User(id=uuid.uuid4(), firebase_uid=f"u_wf1_{uuid.uuid4().hex[:6]}", full_name="Off One", email=f"wf1_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.ELECTION_OFFICIAL, is_active=True)
        off2 = User(id=uuid.uuid4(), firebase_uid=f"u_wf2_{uuid.uuid4().hex[:6]}", full_name="Off Two", email=f"wf2_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.ELECTION_OFFICIAL, is_active=True)
        unassigned_off = User(id=uuid.uuid4(), firebase_uid=f"u_wfu_{uuid.uuid4().hex[:6]}", full_name="Off Unassigned", email=f"wfu_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.ELECTION_OFFICIAL, is_active=True)
        admin = User(id=uuid.uuid4(), firebase_uid=f"u_wfa_{uuid.uuid4().hex[:6]}", full_name="Super Admin", email=f"wfa_{uuid.uuid4().hex[:6]}@u.edu", role=UserRole.SUPER_ADMIN, is_active=True)
        db_session.add_all([off1, off2, unassigned_off, admin])
        await db_session.flush()

        now = datetime.now(timezone.utc)
        start_time = now + timedelta(days=2)
        end_time = now + timedelta(days=4)

        # 1. Create complete draft
        create_req = ElectionCreateRequest(
            name="CSE Full Workflow Election 2026",
            department="Computer Science and Engineering",
            election_type="Departmental Election",
            start_at=start_time,
            end_at=end_time,
            positions=[
                PositionCreateRequest(name="President", display_order=1, number_of_winners=1),
                PositionCreateRequest(name="Vice President", display_order=2, number_of_winners=1),
            ],
            official_user_ids=[off1.id, off2.id],
            result_visibility=ResultVisibility.OFFICIALS_DURING_VOTING,
        )
        election = await create_election(db_session, off1, create_req)
        assert election.status == ElectionStatus.DRAFT

        # 2. Submit for approval
        submitted = await submit_election_for_approval(db_session, election.id, off1)
        assert submitted.status == ElectionStatus.PENDING_APPROVAL
        assert len(submitted.approvals) == 2
        assert all(a.approval_status == "PENDING" for a in submitted.approvals)

        # 3. Unassigned official cannot approve (403)
        with pytest.raises(HTTPException) as exc:
            await record_official_approval(db_session, election.id, unassigned_off, "I try to approve")
        assert exc.value.status_code == 403

        # 4. Super Admin cannot final-approve before all assigned officials approve
        with pytest.raises(HTTPException) as exc:
            await super_admin_final_approval(db_session, election.id, admin)
        assert exc.value.status_code == 400
        assert "All required assigned Election Officials must approve" in exc.value.detail

        # 5. Official 1 approves
        await record_official_approval(db_session, election.id, off1, "Looks great to me")

        # Still cannot final-approve because off2 is pending
        with pytest.raises(HTTPException) as exc:
            await super_admin_final_approval(db_session, election.id, admin)
        assert exc.value.status_code == 400

        # 6. Official 2 rejects with reason
        rejected_election = await record_rejection(db_session, election.id, off2, "Start date clashes with exams")
        assert rejected_election.status == ElectionStatus.DRAFT

        # Creator updates schedule and resubmits
        new_start = now + timedelta(days=7)
        new_end = now + timedelta(days=9)
        await update_election(
            db_session,
            election.id,
            off1,
            ElectionUpdateRequest(start_at=new_start, end_at=new_end),
        )
        resubmitted = await submit_election_for_approval(db_session, election.id, off1)
        assert resubmitted.status == ElectionStatus.PENDING_APPROVAL

        # Both officials approve
        await record_official_approval(db_session, election.id, off1, "Approved with new dates")
        await record_official_approval(db_session, election.id, off2, "Approved after exam check")

        # Super Admin Final Approval
        final_election = await super_admin_final_approval(db_session, election.id, admin)
        assert final_election.status in (ElectionStatus.APPROVED, ElectionStatus.SCHEDULED)

        # Verify audit logs exist
        audit_actions = [log.action for log in final_election.audit_logs]
        assert "ELECTION_CREATED" in audit_actions
        assert "ELECTION_SUBMITTED" in audit_actions
        assert "ELECTION_APPROVED" in audit_actions
        assert "ELECTION_REJECTED" in audit_actions
        assert "ELECTION_FINAL_APPROVED" in audit_actions

    asyncio.run(run_in_session(_test))
