"""Add raw_json to Transcript

Revision ID: 6a84cdfdb121
Revises: ad4db6708c51
Create Date: 2025-01-19 21:42:48.546709

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a84cdfdb121'
down_revision: Union[str, None] = 'ad4db6708c51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('transcripts', sa.Column('raw_json', sa.Text(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('transcripts', 'raw_json')
    # ### end Alembic commands ###
