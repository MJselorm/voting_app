"""Add organisation profile visibility.

Revision ID: 0008_org_profile_visibility
Revises: 0007_in_app_notifications
"""
from alembic import op
import sqlalchemy as sa
revision = "0008_org_profile_visibility"
down_revision = "0007_in_app_notifications"
branch_labels = None
depends_on = None
def upgrade(): op.add_column("organizations", sa.Column("is_public_profile", sa.Boolean(), nullable=False, server_default=sa.true()))
def downgrade(): op.drop_column("organizations", "is_public_profile")
