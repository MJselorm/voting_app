"""Add platform and organization RBAC foundation.

Revision ID: 0003_rbac_foundation
Revises: 0002_organization_foundation
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_rbac_foundation"
down_revision: Union[str, None] = "0002_organization_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


platform_role = sa.Enum(
    "PLATFORM_SUPER_ADMIN",
    name="platform_role",
    native_enum=False,
    create_constraint=True,
)
organization_role = sa.Enum(
    "ORGANISATION_OWNER",
    "ORGANISATION_ADMIN",
    "ELECTION_OFFICIAL",
    "MEMBER",
    name="organization_role",
    native_enum=False,
    create_constraint=True,
)
assignment_status = sa.Enum(
    "ACTIVE",
    "REVOKED",
    name="assignment_status",
    native_enum=False,
    create_constraint=True,
)


def upgrade() -> None:
    op.create_table(
        "platform_role_assignments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", platform_role, nullable=False),
        sa.Column("status", assignment_status, server_default="ACTIVE", nullable=False),
        sa.Column("assigned_by", sa.Uuid(), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_platform_role_user", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], name="fk_platform_role_assigned_by", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_platform_role_assignments"),
    )
    op.create_index("ix_platform_role_user_status", "platform_role_assignments", ["user_id", "status"])
    op.create_index("ix_platform_role_role_status", "platform_role_assignments", ["role", "status"])

    op.create_table(
        "organization_role_assignments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", organization_role, nullable=False),
        sa.Column("status", assignment_status, server_default="ACTIVE", nullable=False),
        sa.Column("assigned_by", sa.Uuid(), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_org_role_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_org_role_user", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], name="fk_org_role_assigned_by", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_org_role_assignments"),
    )
    op.create_index("ix_org_role_org_user_status", "organization_role_assignments", ["organization_id", "user_id", "status"])
    op.create_index("ix_org_role_user_status", "organization_role_assignments", ["user_id", "status"])
    op.create_index(
        "uq_org_single_active_owner",
        "organization_role_assignments",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("role = 'ORGANISATION_OWNER' AND status = 'ACTIVE'"),
        sqlite_where=sa.text("role = 'ORGANISATION_OWNER' AND status = 'ACTIVE'"),
    )

    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], name="fk_platform_settings_updated_by", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("key", name="pk_platform_settings"),
    )


def downgrade() -> None:
    op.drop_table("platform_settings")
    op.drop_index("uq_org_single_active_owner", table_name="organization_role_assignments")
    op.drop_index("ix_org_role_user_status", table_name="organization_role_assignments")
    op.drop_index("ix_org_role_org_user_status", table_name="organization_role_assignments")
    op.drop_table("organization_role_assignments")
    op.drop_index("ix_platform_role_role_status", table_name="platform_role_assignments")
    op.drop_index("ix_platform_role_user_status", table_name="platform_role_assignments")
    op.drop_table("platform_role_assignments")
