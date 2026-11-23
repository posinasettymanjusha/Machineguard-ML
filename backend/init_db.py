
from sqlalchemy import text

from backend.app.database import Base, engine
from backend.app import models  # noqa: F401


def initialize_database():
    if engine is None:
        raise RuntimeError(
            "DATABASE_URL is missing. Check your project-root .env file."
        )

    print("Connecting to Neon PostgreSQL...")

    with engine.begin() as connection:
        Base.metadata.create_all(bind=connection)

        result = connection.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN (
                    'machines',
                    'monitoring_sessions',
                    'sensor_readings',
                    'predictions',
                    'anomaly_events'
                )
                ORDER BY table_name
            """)
        )

        tables = [row[0] for row in result]

    print("\nDatabase initialization successful.")
    print("Tables created or already existing:")

    for table in tables:
        print(f"  - {table}")

    if len(tables) != 5:
        raise RuntimeError(
            f"Expected 5 tables, but found {len(tables)}."
        )


if __name__ == "__main__":
    initialize_database()
