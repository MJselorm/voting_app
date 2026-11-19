"""Add organisation contact phone fields for direct creation.

Revision ID: 0005_direct_creation_phone
Revises: 0004_organization_memberships
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_direct_creation_phone"
down_revision: Union[str, None] = "0004_organization_memberships"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("contact_phone", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "organization_requests",
        sa.Column("contact_phone", sa.String(length=40), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("organization_requests", "contact_phone")
    op.drop_column("organizations", "contact_phone")
