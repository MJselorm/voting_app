import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.models.election import (
    Election,
    ElectionApproval,
    ElectionOfficialAssignment,
    ElectionPosition,
    ElectionStatus,
    ResultVisibility,
)
from app.models.user import User, UserRole
from app.schemas.admin import AssignOfficialRequest, UserRoleUpdateRequest, UserStatusUpdateRequest
from app.services.admin import (
    assign_user_as_official,
    get_admin_approvals_overview,
    get_election_officials_summary,
    get_users_list,
    get_users_stats,
    update_user_role,
    update_user_status,
)
from app.services.elections import create_election, submit_election_for_approval, record_official_approval, super_admin_final_approval
from app.schemas.election import ElectionCreateRequest, PositionCreateRequest

test_engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    poolclass=NullPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@pytest.fixture
def run_async():
    def _runner(coro):
        return asyncio.run(coro)
    return _runner


def test_users_list_and_stats(run_async):
    async def _test():
        async with TestingSessionLocal() as session:
            # Create a test admin and test student
            uid = uuid.uuid4().hex[:8]
            admin = User(
                id=uuid.uuid4(),
                firebase_uid=f"adm_{uid}",
                full_name="Admin Test",
                email=f"adm_{uid}@test.edu",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True,
            )
            student = User(
                id=uuid.uuid4(),
                firebase_uid=f"stu_{uid}",
                full_name="Student Test",
                email=f"stu_{uid}@test.edu",
                student_id=f"S_{uid}",
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=False,
            )
            session.add_all([admin, student])
            await session.commit()

            # Test stats
            stats = await get_users_stats(session)
            assert stats.total_users >= 2
            assert stats.total_admins >= 1
            assert stats.total_students >= 1

            # Test list with search
            res = await get_users_list(session, search="Student Test")
            assert any(u.id == student.id for u in res.users)

            # Test list with role filter
            res_admins = await get_users_list(session, role="SUPER_ADMIN")
            assert any(u.id == admin.id for u in res_admins.users)
            assert not any(u.id == student.id for u in res_admins.users)

            # Clean up
            await session.execute(text(f"DELETE FROM users WHERE id IN ('{admin.id}', '{student.id}');"))
            await session.commit()

    run_async(_test())


def test_user_role_and_status_update(run_async):
    async def _test():
        async with TestingSessionLocal() as session:
            uid = uuid.uuid4().hex[:8]
            admin = User(
                id=uuid.uuid4(),
                firebase_uid=f"adm_{uid}",
                full_name="Admin Test",
                email=f"adm_{uid}@test.edu",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True,
            )
            target_user = User(
                id=uuid.uuid4(),
                firebase_uid=f"tgt_{uid}",
                full_name="Target Test",
                email=f"tgt_{uid}@test.edu",
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            session.add_all([admin, target_user])
            await session.commit()

            # Promote student to election official
            updated = await update_user_role(session, admin, target_user.id, UserRole.ELECTION_OFFICIAL)
            assert updated.role == UserRole.ELECTION_OFFICIAL

            # Test self-demotion protection
            with pytest.raises(Exception) as exc:
                await update_user_role(session, admin, admin.id, UserRole.STUDENT)
            assert "cannot demote your own Super Admin" in str(exc.value)

            # Test deactivating target user
            deact = await update_user_status(session, admin, target_user.id, False)
            assert deact.is_active is False

            # Test self-deactivation protection
            with pytest.raises(Exception) as exc:
                await update_user_status(session, admin, admin.id, False)
            assert "cannot deactivate your own" in str(exc.value)

            # Clean up
            await session.execute(text(f"DELETE FROM users WHERE id IN ('{admin.id}', '{target_user.id}');"))
            await session.commit()

    run_async(_test())


def test_officials_summary_and_assignment(run_async):
    async def _test():
        async with TestingSessionLocal() as session:
            uid = uuid.uuid4().hex[:8]
            admin = User(
                id=uuid.uuid4(),
                firebase_uid=f"adm_{uid}",
                full_name="Admin Test",
                email=f"adm_{uid}@test.edu",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True,
            )
            official = User(
                id=uuid.uuid4(),
                firebase_uid=f"off_{uid}",
                full_name="Official Test",
                email=f"off_{uid}@test.edu",
                role=UserRole.ELECTION_OFFICIAL,
                is_active=True,
                is_verified=True,
            )
            session.add_all([admin, official])
            await session.commit()

            officials_summary = await get_election_officials_summary(session)
            assert any(o.id == official.id for o in officials_summary)

            # Clean up
            await session.execute(text(f"DELETE FROM users WHERE id IN ('{admin.id}', '{official.id}');"))
            await session.commit()

    run_async(_test())


def test_admin_approvals_overview(run_async):
    async def _test():
        async with TestingSessionLocal() as session:
            uid = uuid.uuid4().hex[:8]
            admin = User(
                id=uuid.uuid4(),
                firebase_uid=f"adm_{uid}",
                full_name="Admin Test",
                email=f"adm_{uid}@test.edu",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True,
            )
            official = User(
                id=uuid.uuid4(),
                firebase_uid=f"off_{uid}",
                full_name="Official Test",
                email=f"off_{uid}@test.edu",
                role=UserRole.ELECTION_OFFICIAL,
                is_active=True,
                is_verified=True,
            )
            session.add_all([admin, official])
            await session.commit()

            # Create an election submitted for approval
            start = datetime.now(timezone.utc) + timedelta(days=2)
            end = start + timedelta(days=1)
            create_req = ElectionCreateRequest(
                name=f"Approvals Test Election {uid}",
                department="Computer Science and Engineering",
                election_type="DEPARTMENTAL",
                start_at=start,
                end_at=end,
                result_visibility=ResultVisibility.PUBLIC_AFTER_ELECTION,
                assigned_official_ids=[official.id],
                positions=[PositionCreateRequest(name="President", display_order=1, number_of_winners=1)],
            )
            election = await create_election(session, official, create_req)
            election = await submit_election_for_approval(session, election.id, official)

            # Check approvals overview - should be under official review
            overview = await get_admin_approvals_overview(session)
            assert any(e.id == election.id for e in overview.under_official_review)

            # Official approves
            election = await record_official_approval(session, election.id, official, comment="Approved by official")

            # Check approvals overview - should now be ready for final approval
            overview_ready = await get_admin_approvals_overview(session)
            assert any(e.id == election.id for e in overview_ready.ready_for_final_approval)

            # Admin grants final approval
            election = await super_admin_final_approval(session, election.id, admin)
            assert election.status in (ElectionStatus.APPROVED, ElectionStatus.SCHEDULED)

            # Clean up
            await session.execute(text(f"DELETE FROM election_audit_logs WHERE election_id = '{election.id}';"))
            await session.execute(text(f"DELETE FROM election_approvals WHERE election_id = '{election.id}';"))
            await session.execute(text(f"DELETE FROM election_official_assignments WHERE election_id = '{election.id}';"))
            await session.execute(text(f"DELETE FROM election_positions WHERE election_id = '{election.id}';"))
            await session.execute(text(f"DELETE FROM elections WHERE id = '{election.id}';"))
            await session.execute(text(f"DELETE FROM users WHERE id IN ('{admin.id}', '{official.id}');"))
            await session.commit()

    run_async(_test())
