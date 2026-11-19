"""Add the organisation management foundation.

Revision ID: 0002_organization_foundation
Revises: 0001_create_users
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_organization_foundation"
down_revision: Union[str, None] = "0001_create_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


organization_type = sa.Enum(
    "UNIVERSITY",
    "DEPARTMENT",
    "COMPANY",
    "ASSOCIATION",
    "CLUB",
    "OTHER",
    name="organization_type",
    native_enum=False,
    create_constraint=True,
)
organization_status = sa.Enum(
    "PENDING_APPROVAL",
    "ACTIVE",
    "REJECTED",
    "SUSPENDED",
    "ARCHIVED",
    name="organization_status",
    native_enum=False,
    create_constraint=True,
)
organization_request_type = sa.Enum(
    "UNIVERSITY",
    "DEPARTMENT",
    "COMPANY",
    "ASSOCIATION",
    "CLUB",
    "OTHER",
    name="organization_request_type",
    native_enum=False,
    create_constraint=True,
)
organization_request_status = sa.Enum(
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    name="organization_request_status",
    native_enum=False,
    create_constraint=True,
)
organization_management_role = sa.Enum(
    "ORGANISATION_OWNER",
    "ORGANISATION_ADMIN",
    name="organization_management_role",
    native_enum=False,
    create_constraint=True,
)


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_platform_super_admin",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.create_table(
        "organizations",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("organization_type", organization_type, nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("contact_email", sa.String(length=320), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column(
            "status",
            organization_status,
            server_default="ACTIVE",
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("approved_by", sa.Uuid(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name="fk_organizations_created_by_users", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["approved_by"], ["users.id"], name="fk_organizations_approved_by_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
        sa.UniqueConstraint("slug", name="uq_organizations_slug"),
    )
    op.create_index(
        "ix_organizations_status_created_at",
        "organizations",
        ["status", "created_at"],
    )

    op.create_table(
        "organization_requests",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("organization_type", organization_request_type, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("contact_email", sa.String(length=320), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column("supporting_information", sa.Text(), nullable=True),
        sa.Column(
            "status",
            organization_request_status,
            server_default="PENDING_APPROVAL",
            nullable=False,
        ),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("requested_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["users.id"],
            name="fk_organization_requests_requested_by_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            name="fk_organization_requests_reviewed_by_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_organization_requests_organization_id_organizations",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_organization_requests"),
    )
    op.create_index(
        "ix_organization_requests_status_created_at",
        "organization_requests",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_organization_requests_requested_by",
        "organization_requests",
        ["requested_by"],
    )

    op.create_table(
        "organization_management_assignments",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", organization_management_role, nullable=False),
        sa.Column("assigned_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_org_mgmt_org",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_organization_management_assignments_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_by"],
            ["users.id"],
            name="fk_organization_management_assignments_assigned_by_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_organization_management_assignments"),
        sa.UniqueConstraint(
            "organization_id", "user_id", name="uq_org_management_org_user"
        ),
    )
    op.create_index(
        "ix_org_management_user_role",
        "organization_management_assignments",
        ["user_id", "role"],
    )
    op.create_index(
        "uq_org_management_single_owner",
        "organization_management_assignments",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("role = 'ORGANISATION_OWNER'"),
        sqlite_where=sa.text("role = 'ORGANISATION_OWNER'"),
    )

    op.create_table(
        "organization_audit_logs",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("request_id", sa.Uuid(), nullable=True),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column(
            "details",
            sa.JSON(),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_organization_audit_logs_organization_id_organizations",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["organization_requests.id"],
            name="fk_organization_audit_logs_request_id_organization_requests",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name="fk_organization_audit_logs_actor_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_organization_audit_logs"),
    )
    op.create_index(
        "ix_organization_audit_org_created_at",
        "organization_audit_logs",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_organization_audit_request_created_at",
        "organization_audit_logs",
        ["request_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_organization_audit_request_created_at",
        table_name="organization_audit_logs",
    )
    op.drop_index(
        "ix_organization_audit_org_created_at",
        table_name="organization_audit_logs",
    )
    op.drop_table("organization_audit_logs")
    op.drop_index(
        "uq_org_management_single_owner",
        table_name="organization_management_assignments",
    )
    op.drop_index(
        "ix_org_management_user_role",
        table_name="organization_management_assignments",
    )
    op.drop_table("organization_management_assignments")
    op.drop_index(
        "ix_organization_requests_requested_by",
        table_name="organization_requests",
    )
    op.drop_index(
        "ix_organization_requests_status_created_at",
        table_name="organization_requests",
    )
    op.drop_table("organization_requests")
    op.drop_index(
        "ix_organizations_status_created_at",
        table_name="organizations",
    )
    op.drop_table("organizations")
    op.drop_column("users", "is_platform_super_admin")
