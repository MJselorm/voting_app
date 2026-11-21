"""Add configurable membership policies, verifications, and invitations.

Revision ID: 0006_configurable_membership
Revises: 0005_direct_creation_phone
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_configurable_membership"
down_revision: Union[str, None] = "0005_direct_creation_phone"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


verification_mode = sa.Enum(
    "NONE",
    "INSTITUTIONAL_EMAIL",
    "ADMIN_REVIEW",
    name="organization_membership_verification_mode",
    native_enum=False,
    create_constraint=True,
)
invitation_status = sa.Enum(
    "PENDING",
    "ACCEPTED",
    "EXPIRED",
    "REVOKED",
    name="organization_invitation_status",
    native_enum=False,
    create_constraint=True,
)
invitation_verification_mode = sa.Enum(
    "NONE",
    "INSTITUTIONAL_EMAIL",
    "ADMIN_REVIEW",
    name="organization_invitation_verification_mode",
    native_enum=False,
    create_constraint=True,
)
verification_request_mode = sa.Enum(
    "NONE",
    "INSTITUTIONAL_EMAIL",
    "ADMIN_REVIEW",
    name="organization_membership_verification_request_mode",
    native_enum=False,
    create_constraint=True,
)
verification_status = sa.Enum(
    "PENDING",
    "VERIFIED",
    "REJECTED",
    "CANCELLED",
    name="organization_membership_verification_status",
    native_enum=False,
    create_constraint=True,
)
request_verification_mode = sa.Enum(
    "NONE",
    "INSTITUTIONAL_EMAIL",
    "ADMIN_REVIEW",
    name="membership_request_verification_mode",
    native_enum=False,
    create_constraint=True,
)


def upgrade() -> None:
    with op.batch_alter_table("organizations") as batch:
        batch.add_column(
            sa.Column(
                "membership_requires_approval",
                sa.Boolean(),
                server_default=sa.true(),
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column(
                "membership_requires_invitation",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column(
                "membership_verification_mode",
                verification_mode,
                server_default="NONE",
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column(
                "membership_verified_email_domains",
                sa.JSON(),
                server_default=sa.text("'[]'"),
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column("membership_verification_instructions", sa.Text(), nullable=True)
        )

    op.create_table(
        "organization_invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            invitation_status,
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("invited_by", sa.Uuid(), nullable=True),
        sa.Column("accepted_by", sa.Uuid(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "membership_requires_approval",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "verification_mode",
            invitation_verification_mode,
            server_default="NONE",
            nullable=False,
        ),
        sa.Column(
            "verified_email_domains",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
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
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["invited_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["accepted_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_org_invitation_token_hash"),
    )
    op.create_index(
        "uq_org_invitation_pending_email",
        "organization_invitations",
        ["organization_id", "email"],
        unique=True,
        sqlite_where=sa.text("status = 'PENDING'"),
        postgresql_where=sa.text("status = 'PENDING'"),
    )
    op.create_index(
        "ix_org_invitation_status_expires",
        "organization_invitations",
        ["organization_id", "status", "expires_at"],
    )

    with op.batch_alter_table("organization_membership_requests") as batch:
        batch.drop_constraint("uq_org_membership_request_org_user", type_="unique")
        batch.add_column(
            sa.Column(
                "membership_requires_approval",
                sa.Boolean(),
                server_default=sa.true(),
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column(
                "membership_requires_invitation",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column(
                "verification_mode",
                request_verification_mode,
                server_default="NONE",
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column(
                "verified_email_domains",
                sa.JSON(),
                server_default=sa.text("'[]'"),
                nullable=False,
            )
        )
        batch.add_column(
            sa.Column(
                "invitation_id",
                sa.Uuid(),
                sa.ForeignKey(
                    "organization_invitations.id",
                    name="fk_org_membership_request_invitation",
                    ondelete="SET NULL",
                ),
                nullable=True,
            )
        )
        batch.create_index(
            "uq_org_membership_request_pending",
            ["organization_id", "user_id"],
            unique=True,
            sqlite_where=sa.text("status = 'PENDING'"),
            postgresql_where=sa.text("status = 'PENDING'"),
        )

    op.create_table(
        "organization_membership_verifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("membership_request_id", sa.Uuid(), nullable=True),
        sa.Column("invitation_id", sa.Uuid(), nullable=True),
        sa.Column(
            "verification_mode",
            verification_request_mode,
            nullable=False,
        ),
        sa.Column(
            "status",
            verification_status,
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "membership_requires_approval",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "verified_email_domains",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column("submission_note", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["membership_request_id"],
            ["organization_membership_requests.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["invitation_id"],
            ["organization_invitations.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_org_membership_verification_pending",
        "organization_membership_verifications",
        ["organization_id", "user_id"],
        unique=True,
        sqlite_where=sa.text("status = 'PENDING'"),
        postgresql_where=sa.text("status = 'PENDING'"),
    )
    op.create_index(
        "ix_org_membership_verification_org_status",
        "organization_membership_verifications",
        ["organization_id", "status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_org_membership_verification_org_status",
        table_name="organization_membership_verifications",
    )
    op.drop_index(
        "uq_org_membership_verification_pending",
        table_name="organization_membership_verifications",
    )
    op.drop_table("organization_membership_verifications")

    with op.batch_alter_table("organization_membership_requests") as batch:
        batch.drop_index("uq_org_membership_request_pending")
        batch.drop_column("invitation_id")
        batch.drop_column("verified_email_domains")
        batch.drop_column("verification_mode")
        batch.drop_column("membership_requires_invitation")
        batch.drop_column("membership_requires_approval")
        batch.create_unique_constraint(
            "uq_org_membership_request_org_user",
            ["organization_id", "user_id"],
        )

    op.drop_index(
        "ix_org_invitation_status_expires",
        table_name="organization_invitations",
    )
    op.drop_index(
        "uq_org_invitation_pending_email",
        table_name="organization_invitations",
    )
    op.drop_table("organization_invitations")

    with op.batch_alter_table("organizations") as batch:
        batch.drop_column("membership_verification_instructions")
        batch.drop_column("membership_verified_email_domains")
        batch.drop_column("membership_verification_mode")
        batch.drop_column("membership_requires_invitation")
        batch.drop_column("membership_requires_approval")
