from sqlalchemy.ext.declarative import declarative_base

# Single shared Base for all SQLAlchemy models.
# Import this in every model file and use it as the parent class.
Base = declarative_base()
