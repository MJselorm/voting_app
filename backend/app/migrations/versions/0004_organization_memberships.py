"""Add organization membership requests and memberships.

Revision ID: 0004_organization_memberships
Revises: 0003_rbac_foundation
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_organization_memberships"
down_revision: Union[str, None] = "0003_rbac_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


membership_request_status = sa.Enum(
    "PENDING",
    "APPROVED",
    "REJECTED",
    name="organization_membership_request_status",
    native_enum=False,
    create_constraint=True,
)
membership_status = sa.Enum(
    "ACTIVE",
    "SUSPENDED",
    "REMOVED",
    name="organization_membership_status",
    native_enum=False,
    create_constraint=True,
)


def upgrade() -> None:
    op.create_table(
        "organization_memberships",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("status", membership_status, server_default="ACTIVE", nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_org_membership_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_org_membership_user", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], name="fk_org_membership_reviewer", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_org_memberships"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_membership_org_user"),
    )
    op.create_index("ix_org_membership_user_status", "organization_memberships", ["user_id", "status"])
    op.create_index("ix_org_membership_org_status", "organization_memberships", ["organization_id", "status"])

    op.create_table(
        "organization_membership_requests",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("status", membership_request_status, server_default="PENDING", nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_org_membership_request_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_org_membership_request_user", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], name="fk_org_membership_request_reviewer", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_org_membership_requests"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_membership_request_org_user"),
    )
    op.create_index(
        "ix_org_membership_request_status",
        "organization_membership_requests",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_org_membership_request_org_status",
        "organization_membership_requests",
        ["organization_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_org_membership_request_org_status", table_name="organization_membership_requests")
    op.drop_index("ix_org_membership_request_status", table_name="organization_membership_requests")
    op.drop_table("organization_membership_requests")
    op.drop_index("ix_org_membership_org_status", table_name="organization_memberships")
    op.drop_index("ix_org_membership_user_status", table_name="organization_memberships")
    op.drop_table("organization_memberships")
