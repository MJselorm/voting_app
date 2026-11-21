"""Add shared in-app notifications.

Revision ID: 0007_in_app_notifications
Revises: 0006_configurable_membership
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision = "0007_in_app_notifications"
down_revision = "0006_configurable_membership"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
def upgrade():
    op.create_table("user_notifications", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("recipient_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("event_id", sa.String(160), nullable=False), sa.Column("event_key", sa.String(120), nullable=False), sa.Column("category", sa.String(60), nullable=False), sa.Column("title", sa.String(255), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("action_url", sa.String(500)), sa.Column("resource_type", sa.String(80)), sa.Column("resource_id", sa.String(80)), sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")), sa.Column("channel", sa.String(20), nullable=False, server_default="IN_APP"), sa.Column("delivery_status", sa.String(20), nullable=False, server_default="DELIVERED"), sa.Column("read_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.UniqueConstraint("recipient_user_id", "event_id", name="uq_notification_recipient_event"))
    op.create_index("ix_notification_recipient_created", "user_notifications", ["recipient_user_id", "created_at"])
    op.create_index("ix_notification_recipient_unread", "user_notifications", ["recipient_user_id", "read_at"])
def downgrade():
    op.drop_table("user_notifications")
